import type {
  IBasicDataFeed, IDatafeedChartApi, IExternalDatafeed, IDatafeedQuotesApi,
  ResolutionString, LibrarySymbolInfo, Bar, SearchSymbolResultItem
} from "charting_library";

import { apiService, type ExchangeApi } from '@/services/ApiService'


const DEFAULT_RESOLUTIONS = ["1", "5", "15", "60", "240", "1D", "1W", "1M",] as ResolutionString[];

const resolutionMap = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "240": "4h",
  "1D": "1d",
  "1W": "1w",
  "1M": "1M"
} as Record<string, string>;

export interface DataFeedOptions {
  strId: string;
  resolutions?: string[]; // 可选，默认全量
  pricescale?: number;  // 100 价格 = 123.45 → 内部存储为 12345
}

export default class DataFeed implements IBasicDataFeed {
  private api: ExchangeApi;
  private strId: string;
  private symbol: string;
  private type: string;
  private resolutions: ResolutionString[];
  private pricescale: number;

  // K线数据缓存，按分辨率分组
  private cacheBars: Map<string, Bar[]> = new Map();           // 数据本体，按插入顺序
  private cacheIndex: Map<string, Map<number, Bar>> = new Map(); // 索引，快速查找


  // 当前使用的interval
  private currentInterval: string = '';

  // getBars请求Promise，用于同步时序
  private getBarsPromise: Promise<void> | null = null;

  constructor(options: DataFeedOptions) {
    const { strId, pricescale = 100, resolutions = DEFAULT_RESOLUTIONS } = options;
    const [base, quote, type] = strId.split('-');

    // 验证 resolutions
    if (!resolutions.every(r => DEFAULT_RESOLUTIONS.includes(r as ResolutionString))) {
      throw new Error(`Invalid resolutions: ${resolutions}`);
    }

    this.api = apiService.api;
    this.strId = strId;
    this.symbol = `${base}-${quote}`;
    this.type = type;
    this.resolutions = resolutions as ResolutionString[];
    this.pricescale = pricescale;

    // 根据resolutions初始化缓存结构
    this.resolutions.forEach(resolution => {
      const interval = resolutionMap[resolution];
      if (interval) {
        this.cacheBars.set(interval, []);
        this.cacheIndex.set(interval, new Map<number, Bar>());
      }
    });
  }

  onReady(callback: (config: any) => void) {
    const config = {
      exchanges: [],
      supported_resolutions: this.resolutions,
      supports_group_request: false,
      supports_marks: false,
      supports_search: false,
      supports_time: true,
      supports_timescale_marks: false,
    };

    setTimeout(() => callback(config), 0);
  }

  resolveSymbol(
    _symbolName: string,
    onSymbolResolvedCallback: (symbol: LibrarySymbolInfo) => void,
    __onResolveErrorCallback: (error: string) => void
  ) {
    const data: LibrarySymbolInfo = {
      name: this.symbol,
      description: this.symbol,
      session: "24x7",
      timezone: "Asia/Shanghai",
      ticker: this.symbol,
      exchange: "Binance",           // 新增
      listed_exchange: "Binance",    // 新增
      format: "price",               // 新增，通常 "price" 或 "volume"
      minmov: 1,                     // 新增，最小价格变动单位
      supported_resolutions: this.resolutions,
      pricescale: this.pricescale,
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      volume_precision: 4,
      type: "crypto",
    };

    setTimeout(() => onSymbolResolvedCallback(data), 0);
  }

  getBars(
    _symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: { from: number; to: number; firstDataRequest: boolean },
    onResult: (bars: Bar[], meta: { noData: boolean }) => void,
    onError: (error: string) => void
  ): void {
    const { from, to, firstDataRequest } = periodParams;
    const interval = resolutionMap[resolution] || '1m';

    // 记录当前使用的interval
    this.currentInterval = interval;

    console.log(`[DataFeed][拉取] strId: ${this.strId}, interval: ${interval}, 时间范围: ${from} ~ ${to}`);

    // 缓存中没有数据，从API获取
    this.api.getKline(this.strId, { interval, startTime: from * 1000, endTime: firstDataRequest ? Date.now() : to * 1000 })
      .then((data) => {
        const bars: Bar[] = data.map((item: any) => ({
          time: parseFloat(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        }));
        onResult(bars, { noData: bars.length === 0 });

        // 缓存数据到对应的interval
        this._cacheBars(interval, bars);
      })
      .catch((err) => {
        onError(err.message);
        throw err; // 重新抛出错误，让Promise reject
      });
  }

  subscribeBars(
    _symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onRealtimeCallback: (bar: Bar) => void,
    __listenerGUID: string,
    __onResetCacheNeededCallback: () => void
  ) {
    const interval = resolutionMap[resolution] || '1m';

    console.log(`[DataFeed][订阅] strId: ${this.strId}, interval: ${interval}`);
    // return
    this.api.subscribeKline(this.strId, { interval }).then(async (stream) => {
      if (!stream) {
        console.error(`[DateFeed][订阅] 订阅 ${this.strId} 失败 - stream为空`);
        return;
      }
      console.log(`[DateFeed][推送] 订阅 ${this.strId} 成功`);

      const reader = stream.getReader()
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const bars: Bar[] = value.map((item: any) => ({
          time: parseFloat(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        }));

        bars.forEach(bar => {
          // 获取当前缓存的最后一个元素
          const barsArray = this.cacheBars.get(interval);
          if(!barsArray) return;
          const lastBar = barsArray[-1];

          // 如果获取不到，或者时间小于等于最后一个元素的时间，就跳过
          if (!lastBar || bar.time <= lastBar.time) {
            // console.log(`[DateFeed][推送] 跳过过时或重复数据: ${JSON.stringify(bar)}`);
            return;
          }

          // 缓存实时数据到当前interval
          this._cacheBars(interval, [bar]);

          console.log(`[DateFeed][推送] 接受到k线推送数据已放入图表 ==> ${JSON.stringify(bar)}`);
          onRealtimeCallback(bar);
        });
      }
    });
  }

  unsubscribeBars(__subscriberUID: string) { }

  searchSymbols(
    __userInput: string,
    __exchange: string,
    __symbolType: string,
    onResult: (symbols: SearchSymbolResultItem[]) => void
  ) {
    const results: SearchSymbolResultItem[] = [];
    onResult(results);
  }

  // 缓存K线数据
  private _cacheBars(interval: string, bars: Bar[]): void {
    if (!this.cacheBars.has(interval)) {
      this.cacheBars.set(interval, []);
      this.cacheIndex.set(interval, new Map<number, Bar>());
    }

    const barsArray = this.cacheBars.get(interval)!;
    const indexMap = this.cacheIndex.get(interval)!;

    bars.forEach(bar => {
      // 如果索引中不存在，则添加到数组末尾
      if (!indexMap.has(bar.time)) {
        barsArray.push(bar);
        indexMap.set(bar.time, bar);
      } else {
        // 如果已存在，更新数据（保留数组中的引用）
        const existingBar = indexMap.get(bar.time)!;
        Object.assign(existingBar, bar);
      }
    });
  }

  // 根据时间戳获取最近的K线数据
  public getBarByTime(time: number): Bar | null {
    // 如果没有当前interval，返回null
    if (!this.currentInterval || !this.cacheIndex.has(this.currentInterval)) {
      return null;
    }

    const indexMap = this.cacheIndex.get(this.currentInterval)!;

    // 查找精确匹配的时间
    if (indexMap.has(time)) {
      return indexMap.get(time) || null;
    }

    // 查找最近的时间
    let closestBar: Bar | null = null;
    let minDiff = Infinity;

    for (const [cachedTime, bar] of indexMap.entries()) {
      const diff = Math.abs(cachedTime - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestBar = bar;
      }
    }

    return closestBar;
  }

  // 获取指定时间范围内的所有K线数据
  public getBarsByTimeRange(from: number, to: number): Bar[] {
    const result: Bar[] = [];

    // 如果没有当前interval，返回空数组
    if (!this.currentInterval || !this.cacheBars.has(this.currentInterval)) {
      return result;
    }

    const barsArray = this.cacheBars.get(this.currentInterval)!;

    // 由于barsArray是按时间插入顺序存储的，直接遍历即可
    for (const bar of barsArray) {
      if (bar.time >= from && bar.time <= to) {
        result.push(bar);
      } else if (bar.time > to) {
        // 由于是按时间顺序排列，可以提前退出
        break;
      }
    }

    return result;
  }

  // 清除缓存
  public clearCache(): void {
    // 重新根据resolutions初始化缓存结构
    this.cacheBars.clear();
    this.cacheIndex.clear();
    this.resolutions.forEach(resolution => {
      const interval = resolutionMap[resolution];
      if (interval) {
        this.cacheBars.set(interval, []);
        this.cacheIndex.set(interval, new Map<number, Bar>());
      }
    });
    this.currentInterval = '';
    console.log(`[DataFeed][缓存] 已清除所有缓存数据并重新初始化`);
  }

  // 获取缓存统计信息
  public getCacheStats(): Record<string, number> {
    const stats: Record<string, number> = {
      'total': 0
    };

    for (const [interval, barsArray] of this.cacheBars.entries()) {
      stats[interval] = barsArray.length;
      stats['total'] += barsArray.length;
    }

    return stats;
  }

  // 获取指定interval的最后一个bar的时间戳
  public getLastTime(interval: string): number {
    if (!this.cacheBars.has(interval) || this.cacheBars.get(interval)!.length === 0) {
      return 0;
    }
    const barsArray = this.cacheBars.get(interval)!;
    return barsArray[barsArray.length - 1].time;
  }
}
