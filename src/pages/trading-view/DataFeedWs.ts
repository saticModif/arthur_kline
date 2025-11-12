import type { ExchangeApi } from "@/services/api/api";

// export interface CoinInfo {
//   symbol: string;
// }

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LibrarySymbolInfo {
  name: string;
  description: string;
  session: string;
  timezone: string;
  ticker: string;
  supported_resolutions: string[];
  pricescale: number;
  has_intraday: boolean;
  has_daily?: boolean;
  has_weekly_and_monthly?: boolean;
  volume_precision?: number;
  type?: string;
  data_status?: string;
}

export type SubscribeBarsCallback = (bar: Bar) => void;

export type ResolutionString = "1" | "5" | "15" | "60" | "240" | "1D" | "1W" | "1M";

const DEFAULT_RESOLUTIONS: ResolutionString[] = ["1", "5", "15", "60", "240", "1D", "1W", "1M",];

export interface DataFeedWsOptions {
  api: ExchangeApi;
  strId: string;
  resolutions?: string[]; // 可选，默认全量
  scale?: number; // 可选，默认 2
}

export default class DataFeedWs {
  private api: ExchangeApi;
  private strId: string;
  private symbol: string;
  private type: string;
  private resolutions: ResolutionString[];
  private scale: number;
  private pendingRequest: Map<string, Promise<any[]>> = new Map(); // 防重复请求
  private lastRequestTime: Map<string, number> = new Map(); // 记录上次请求时间


  constructor(options: DataFeedWsOptions) {
    const { api, strId, scale = 2, resolutions = DEFAULT_RESOLUTIONS } = options;
    const [base, quote, type] = strId.split('-');

    // 验证 resolutions
    if (!resolutions.every(r => DEFAULT_RESOLUTIONS.includes(r as ResolutionString))) {
      throw new Error(`Invalid resolutions: ${resolutions}`);
    }

    // 验证并设置价格精度
    // scale表示小数位数，pricescale = 10^scale
    // 例如：scale=2 -> pricescale=100 (支持2位小数，如0.01)
    //      scale=3 -> pricescale=1000 (支持3位小数，如0.003)
    //      scale=5 -> pricescale=100000 (支持5位小数，如0.00001)
    const validatedScale = (scale !== undefined && scale >= 0 && scale <= 10) ? scale : 2;
    if (validatedScale !== scale) {
      console.warn(`[DataFeed] 无效的价格精度参数 ${scale}，使用默认值 2`);
    }

    this.api = api;
    this.strId = strId;
    this.symbol = `${base}-${quote}`;
    this.type = type;
    this.resolutions = resolutions as ResolutionString[];
    this.scale = validatedScale;
    
    console.log(`[DataFeed] 初始化: ${this.symbol}, 价格精度: ${this.scale}位小数 (pricescale=${Math.pow(10, this.scale)})`);
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
    const pricescale = Math.pow(10, this.scale);
    const data: LibrarySymbolInfo = {
      name: this.symbol,
      description: this.symbol,
      session: "24x7",
      timezone: "Asia/Shanghai",
      ticker: "",
      supported_resolutions: this.resolutions,
      pricescale: pricescale,
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      volume_precision: 4,
      type: "crypto",
    };

    console.log(`[DataFeed] resolveSymbol: ${this.symbol}, pricescale=${pricescale} (支持${this.scale}位小数)`);
    setTimeout(() => onSymbolResolvedCallback(data), 0);
  }

  async getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    from: number,
    to: number,
    onHistoryCallback: (bars: Bar[], meta: { noData: boolean }) => void,
    _onErrorCallback: (error: string) => void,
    firstDataRequest: boolean
  ) {
    let interval: string = '1m';

    // 现货支持周期：1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M
    if (resolution === "1") interval = "1m";
    else if (resolution === "5") interval = "5m";
    else if (resolution === "15") interval = "15m";
    else if (resolution === "60") interval = "1h";
    else if (resolution === "240") interval = "4h";
    else if (resolution === "1D") interval = "1d";
    else if (resolution === "1W") interval = "1w";
    else if (resolution === "1M") interval = "1M";

    const startTime = from * 1000
    const endTime = firstDataRequest ? Date.now() : to * 1000
    
    // 创建请求键，只基于 resolution（忽略 from/to 的差异）
    // 因为 TradingView 切换周期时可能会用不同的时间范围调用两次
    // 对于合约模式，两次请求的 from 值可能不同，所以只使用 resolution
    const requestKey = `${resolution}`;
    const now = Date.now();
    const lastTime = this.lastRequestTime.get(requestKey) || 0;
    const timeDiff = now - lastTime;
    
    // 如果相同的 resolution 在 10000ms 内有请求正在进行，复用该请求
    if (this.pendingRequest.has(requestKey) && timeDiff < 10000) {
      // 静默复用，不打印日志（减少日志量）
      try {
        const data = await this.pendingRequest.get(requestKey)!;
        const bars: Bar[] = data.map((item: any) => ({
          time: parseFloat(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        }));
        onHistoryCallback(bars, { noData: bars.length === 0 });
      } catch (e) {
        _onErrorCallback((e as Error).message);
      }
      return;
    }

    try {
      console.log(`[DataFeed] 请求: ${interval} (${resolution})`);
      
      // 先创建占位符Promise，立即保存到Map，确保后续请求能立即检测到
      let resolvePlaceholder!: (value: any) => void;
      let rejectPlaceholder!: (error: any) => void;
      const placeholderPromise = new Promise<any[]>((resolve, reject) => {
        resolvePlaceholder = resolve;
        rejectPlaceholder = reject;
      });
      
      // 立即保存占位符到 pendingRequest（同步操作）
      this.pendingRequest.set(requestKey, placeholderPromise);
      
      // 记录请求时间
      this.lastRequestTime.set(requestKey, now);
      
      // 创建真正的请求 Promise
      const requestPromise = this.api.getKline(
        this.strId, {
        interval: interval,
        startTime: startTime,
        endTime: endTime
      });
      
      // 处理真正的请求结果，resolve占位符
      requestPromise
        .then(data => {
          resolvePlaceholder(data);
        })
        .catch(error => {
          rejectPlaceholder(error);
        });
      
      const data = await placeholderPromise;

      // 请求完成后延迟移除（延迟 10000ms，确保后续重复请求能检测到）
      // TradingView 在切换周期时会快速发起多个历史数据请求，需要足够长的缓存时间
      setTimeout(() => {
        this.pendingRequest.delete(requestKey);
      }, 10000);

      const bars: Bar[] = data.map((item: any) => ({
        time: parseFloat(item[0]),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
      }));

      onHistoryCallback(bars, { noData: bars.length === 0 });
    } catch (e) {
      // 请求失败时也要延迟移除（延迟 10000ms，与成功情况保持一致）
      setTimeout(() => {
        this.pendingRequest.delete(requestKey);
      }, 10000);
      _onErrorCallback((e as Error).message);
    }
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onRealtimeCallback: SubscribeBarsCallback,
    ___listenerGUID: string,
    ____onResetCacheNeededCallback: () => void
  ) {
    // 将TradingView resolution映射为币安interval
    let interval: string = '1m';
    if (resolution === "1") interval = "1m";
    else if (resolution === "5") interval = "5m";
    else if (resolution === "15") interval = "15m";
    else if (resolution === "60") interval = "1h";
    else if (resolution === "240") interval = "4h";
    else if (resolution === "1D") interval = "1d";
    else if (resolution === "1W") interval = "1w";
    else if (resolution === "1M") interval = "1M";

    this.api.subscribeKline(this.strId, { interval }).then(async (stream) => {
      if (!stream) {
        console.warn(`[DataFeed] 订阅失败: ${this.strId}-${interval}`);
        return;
      }

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

        bars.forEach(bar => { onRealtimeCallback(bar); })
      }
    });

  }

  unsubscribeBars(_subscriberUID: string) {
    // Unsubscribe functionality can be implemented here if needed
  }

  periodLengthSeconds(resolution: string, requiredPeriodsCount: number): number {
    let daysCount = 0;

    if (resolution === "D") daysCount = requiredPeriodsCount;
    else if (resolution === "M") daysCount = 31 * requiredPeriodsCount;
    else if (resolution === "W") daysCount = 7 * requiredPeriodsCount;
    else if (resolution === "H")
      daysCount = (requiredPeriodsCount * parseInt(resolution)) / 24;
    else daysCount = (requiredPeriodsCount * parseInt(resolution)) / (24 * 60);

    return daysCount * 24 * 60 * 60;
  }
}
