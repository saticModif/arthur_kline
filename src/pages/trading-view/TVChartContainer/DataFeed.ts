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
  pricePrecision?: number; // 价格精度（小数位数），例如 2 表示保留 2 位小数
}

export default class DataFeed implements IBasicDataFeed {
  private api: ExchangeApi;
  private strId: string;
  private symbol: string;
  private type: string;
  private resolutions: ResolutionString[];
  private pricescale: number;
  private pricePrecision: number;

  // K线数据缓存，按分辨率分组
  // 使用Map存储，key为时间戳，value为Bar数据，利用Map的特性实现快速更新和查询
  private cacheBarsMap: Map<string, Map<number, Bar>> = new Map(); // 主要存储：interval -> (time -> Bar)


  // 当前使用的interval
  private currentInterval: string = '';

  // getBars请求Promise，用于同步时序
  private getBarsPromise: Promise<void> | null = null;

  constructor(options: DataFeedOptions) {
    const { strId, pricescale, resolutions = DEFAULT_RESOLUTIONS } = options;
    // 显式处理 pricePrecision，确保正确传递
    const pricePrecision = options.pricePrecision !== undefined ? options.pricePrecision : 2;
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
    this.pricePrecision = pricePrecision;
    // 如果指定了 pricescale 则使用，否则根据 pricePrecision 计算：pricescale = 10^pricePrecision
    this.pricescale = pricescale ?? Math.pow(10, pricePrecision);
    
    console.log(`[DataFeed] 初始化: ${this.symbol}, 价格精度: ${this.pricePrecision}位小数 (pricescale=${this.pricescale})`);

    // 根据resolutions初始化缓存结构
    this.resolutions.forEach(resolution => {
      const interval = resolutionMap[resolution];
      if (interval) {
        this.cacheBarsMap.set(interval, new Map<number, Bar>());
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
    console.log(`[DataFeed] resolveSymbol: ${this.symbol}, pricescale=${this.pricescale} (支持${this.pricePrecision}位小数)`);
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

        // 缓存数据到对应的interval（使用Map存储，自动处理新增和更新）
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

        // 打印从Stream读取的原始数组数据
        //console.log(`[DataFeed][Socket数据] 从Stream读取的原始数据:`, JSON.stringify(value, null, 2));

        const bars: Bar[] = value.map((item: any) => ({
          time: parseFloat(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        }));

        // 打印转换后的Bar格式数据
        //console.log(`[DataFeed][Socket数据] 转换后的Bar数据:`, JSON.stringify(bars, null, 2));

        bars.forEach(bar => {
          // 使用Map存储，key为时间戳，value为Bar数据
          // 后端返回的是增量数据，如果有对应的key就覆盖，没有就新增
          const barsMap = this.cacheBarsMap.get(interval);
          if (!barsMap) {
            console.warn(`[DataFeed][推送] interval ${interval} 的缓存Map不存在`);
            return;
          }

          // 检查是否是新增还是更新（在设置之前检查）
          const isUpdate = barsMap.has(bar.time);
          
          // 获取Map中最大的时间戳（设置之前的时间，用于判断是否应该通知TradingView）
          const lastTimeBeforeUpdate = barsMap.size > 0 ? Math.max(...Array.from(barsMap.keys())) : 0;
          
          // 直接set，Map会自动处理新增或覆盖（无论时间顺序如何，都更新缓存）
          barsMap.set(bar.time, bar);

          // TradingView要求新bar的时间必须 >= 最后一个bar的时间，否则会报"time order violation"
          // 如果时间更早，说明是历史数据补发，只更新缓存，不通知TradingView
          // 如果时间相同（更新当前K线）或更大（新K线），才通知TradingView更新图表
          if (bar.time >= lastTimeBeforeUpdate) {
            //console.log(`[DataFeed][推送] ${isUpdate ? '更新' : '新增'}K线数据 ==> ${JSON.stringify(bar)}`);
            // 调用回调通知TradingView更新图表
            onRealtimeCallback(bar);
          } else {
            // 历史数据补发，只更新缓存，不通知TradingView（避免time order violation错误）
            //console.log(`[DataFeed][推送] 历史数据补发，仅更新缓存，不通知图表: time=${bar.time}, lastTime=${lastTimeBeforeUpdate}, data=${JSON.stringify(bar)}`);
          }
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
  // 使用Map存储，key为时间戳，利用Map的特性：有key就覆盖，没有就新增
  private _cacheBars(interval: string, bars: Bar[]): void {
    // 确保interval对应的Map存在
    if (!this.cacheBarsMap.has(interval)) {
      this.cacheBarsMap.set(interval, new Map<number, Bar>());
    }

    const barsMap = this.cacheBarsMap.get(interval)!;

    bars.forEach(bar => {
      // 直接set，Map会自动处理：如果key存在就覆盖，不存在就新增
      barsMap.set(bar.time, bar);
    });
  }

  public getLatestBar(): Bar | null {
    if (!this.currentInterval || !this.cacheBarsMap.has(this.currentInterval)) {
      return null;
    }

    const barsMap = this.cacheBarsMap.get(this.currentInterval)!;
    if (barsMap.size === 0) {
      return null;
    }

    let latestTime = -Infinity;
    let latestBar: Bar | null = null;
    for (const [time, bar] of barsMap.entries()) {
      if (time > latestTime) {
        latestTime = time;
        latestBar = bar;
      }
    }

    return latestBar;
  }

  // 根据时间戳获取最近的K线数据
  public getBarByTime(time: number): Bar | null {
    if (!this.currentInterval || !this.cacheBarsMap.has(this.currentInterval)) {
      return null;
    }

    const normalizedTime = this.normalizeTimestamp(time);
    const barsMap = this.cacheBarsMap.get(this.currentInterval)!;

    if (barsMap.has(normalizedTime)) {
      return barsMap.get(normalizedTime) || null;
    }

    let closestBar: Bar | null = null;
    let minDiff = Infinity;

    for (const [cachedTime, bar] of barsMap.entries()) {
      const diff = Math.abs(cachedTime - normalizedTime);
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
    if (!this.currentInterval || !this.cacheBarsMap.has(this.currentInterval)) {
      return result;
    }

    const barsMap = this.cacheBarsMap.get(this.currentInterval)!;

    const normalizedFrom = this.normalizeTimestamp(from);
    const normalizedTo = this.normalizeTimestamp(to);

    // 从Map中获取所有数据，按时间戳排序后过滤
    const bars = Array.from(barsMap.values()).sort((a, b) => a.time - b.time);
    
    for (const bar of bars) {
      if (bar.time >= normalizedFrom && bar.time <= normalizedTo) {
        result.push(bar);
      } else if (bar.time > normalizedTo) {
        // 由于已排序，可以提前退出
        break;
      }
    }

    return result;
  }

  private normalizeTimestamp(time: number): number {
    if (!time && time !== 0) return time;
    // 13位视为毫秒，10位视为秒
    return time > 1e12 ? Math.round(time) : Math.round(time * 1000);
  }

  // 清除缓存
  public clearCache(): void {
    // 重新根据resolutions初始化缓存结构
    this.cacheBarsMap.clear();
    this.resolutions.forEach(resolution => {
      const interval = resolutionMap[resolution];
      if (interval) {
        this.cacheBarsMap.set(interval, new Map<number, Bar>());
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

    for (const [interval, barsMap] of this.cacheBarsMap.entries()) {
      stats[interval] = barsMap.size;
      stats['total'] += barsMap.size;
    }

    return stats;
  }

  // 获取指定interval的最后一个bar的时间戳
  public getLastTime(interval: string): number {
    if (!this.cacheBarsMap.has(interval) || this.cacheBarsMap.get(interval)!.size === 0) {
      return 0;
    }
    const barsMap = this.cacheBarsMap.get(interval)!;
    // 从Map中获取所有时间戳，取最大值
    const times = Array.from(barsMap.keys());
    return Math.max(...times);
  }
}
