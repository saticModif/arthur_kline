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


  constructor(options: DataFeedWsOptions) {
    const { api, strId, scale = 2, resolutions = DEFAULT_RESOLUTIONS } = options;
    const [base, quote, type] = strId.split('-');

    // 验证 resolutions
    if (!resolutions.every(r => DEFAULT_RESOLUTIONS.includes(r as ResolutionString))) {
      throw new Error(`Invalid resolutions: ${resolutions}`);
    }

    this.api = api;
    this.strId = strId;
    this.symbol = `${base}-${quote}`;
    this.type = type;
    this.resolutions = resolutions as ResolutionString[];
    this.scale = scale;
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
      ticker: "",
      supported_resolutions: this.resolutions,
      pricescale: Math.pow(10, this.scale || 2),
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      volume_precision: 4,
      type: "crypto",
    };

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

    try {
      const startTime = from * 1000
      const endTime = firstDataRequest ? Date.now() : to * 1000
      console.log(`[DateFeed][拉取] 开始获取k线数据 ==> 从 ${startTime} 到 ${endTime} interval: ${interval}`);
      const data = await this.api.getKline(
        this.strId, {
        interval: interval,
        startTime: startTime,
        endTime: endTime
      })

      const bars: Bar[] = data.map((item: any) => ({
        time: parseFloat(item[0]),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
      }));

      console.log(`[DateFeed][拉取] 获取到k线数据已放入图表 ==> ${JSON.stringify(bars)}`);
      onHistoryCallback(bars, { noData: bars.length === 0 });
    } catch (e) {
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

    console.log(`[DataFeed] 订阅K线 - 交易所: ${this.api.implType}, 交易对: ${this.strId}, 时间周期: ${interval}`);

    this.api.subscribeKline(this.strId, { interval }).then(async (stream) => {
      if (!stream) {
        console.log(`[DateFeed][推送] 订阅${this.strId} 失败 - stream为空`);
        return;
      }

      console.log(`[DateFeed][推送] 订阅${this.strId} 数据成功`);
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

        console.log(`[DateFeed][推送] 接受到k线推送数据已放入图表 ==> ${JSON.stringify(bars)}`);
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
