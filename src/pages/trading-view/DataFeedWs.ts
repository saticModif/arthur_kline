import { ArthurApi } from "@/services/api/arthur-api";

export interface CoinInfo {
  symbol: string;
}

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

export type ResolutionString =
  | "1"
  | "5"
  | "15"
  | "30"
  | "60"
  | "240"
  | "1D"
  | "1W"
  | "1M";

export type SubscribeBarsCallback = (bar: Bar) => void;


export default class DataFeedWs {
  private api: ArthurApi;
  private symbol: string;
  // private type: string;
  private scale: number;

  constructor(api: ArthurApi, symbol: string, _type: string, scale = 2) {
    this.api = api;
    this.symbol = symbol;
    // this.type = type;
    this.scale = scale;
  }

  onReady(callback: (config: any) => void) {
    const config = {
      exchanges: [],
      supported_resolutions: [
        "1",
        "5",
        "15",
        "30",
        "60",
        "240",
        "1D",
        "1W",
        "1M",
      ],
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
      supported_resolutions: [
        "1",
        "5",
        "15",
        "30",
        "60",
        "1D",
        "1W",
        "1M",
      ],
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
    const symbol = symbolInfo.name
    let interval: string = '5m';

    // 现货 1m 5m 15m 30m 60m 2h 4h 6h 8h 12h 1d 1w 1M
    if (resolution === "1") interval = "1m";
    else if (resolution === "5") interval = "5m";
    else if (resolution === "15") interval = "15m";
    else if (resolution === "30") interval = "30m";
    else if (resolution === "60") interval = "60m";
    // else if (resolution === "240") interval = "4h";
    else if (resolution === "1D") interval = "1d";
    else if (resolution === "1W") interval = "1w";
    else if (resolution === "1M") interval = "1M";

    try {
      console.log(`[DateFeed][http] 开始获取k线数据`);
      const data = await this.api.market.getSpotKline({
        symbol: symbol, interval: interval,
        startTime: from * 1000, endTime: firstDataRequest ? Date.now() : to * 1000
      })

      const bars: Bar[] = data.map((item: any) => ({
        time: item[0],
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
      }));
      
      console.log(`[DateFeed][http] 获取到k线数据已放入图表 ==> ${JSON.stringify(bars)}`);
      onHistoryCallback(bars, { noData: bars.length === 0 });
    } catch (e) {
      _onErrorCallback((e as Error).message);
    }
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    __resolution: ResolutionString,
    onRealtimeCallback: SubscribeBarsCallback,
    ___listenerGUID: string,
    ____onResetCacheNeededCallback: () => void
  ) {
    const symbol = symbolInfo.name;
    this.api.market.subscribeSpotKline(symbol).then(async (stream) => {
      console.log(`[DateFeed][websocket] 订阅${symbol} 数据成功`);
      const reader = stream!.getReader()
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (!Array.isArray(value)) continue;

        console.log(`[DateFeed][websocket] 接受到k线推送数据已放入图表 ==> ${JSON.stringify(value)}`);
        // 处理实时数据
        onRealtimeCallback({
          time: value[0],
          open: value[1],
          high: value[2],
          low: value[3],
          close: value[4],
          volume: value[5]
        });
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
