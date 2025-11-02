import mqtt from "mqtt"


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


export default class DataFeedMqtt {
  private _datafeedURL: string;
  private coin: CoinInfo;
  private mqttClient: mqtt.MqttClient;
  private scale: number;

  constructor(url: string, coin: CoinInfo, mqttClient: mqtt.MqttClient, scale = 2) {
    this._datafeedURL = url;
    this.coin = coin;
    this.mqttClient = mqttClient;
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
      name: this.coin.symbol,
      description: this.coin.symbol,
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
    let mappedResolution: string = '5m';

    // if (resolution === "240") mappedResolution = "4h";
    // else if (resolution === "1D") mappedResolution = "1D";
    // else if (resolution === "1W") mappedResolution = "1W";
    // else if (resolution === "1M") mappedResolution = "1M";

    if (resolution === "240") mappedResolution = "4h";
    else if (resolution === "1D") mappedResolution = "1D";
    else if (resolution === "1W") mappedResolution = "1W";
    else if (resolution === "1M") mappedResolution = "1M";
    

    try {
      // const params = new URLSearchParams({
      //   symbol: symbolInfo.name.replace("-", "/"),
      //   from: String(from * 1000),
      //   to: String(firstDataRequest ? Date.now() : to * 1000),
      //   resolution: mappedResolution,
      // });

      // const response = await fetch(`${this._datafeedURL}/swap/history?${params}`);

      const params = new URLSearchParams({
        pair: symbolInfo.name.replace("-", "/"),
        start: String(from * 1000),
        end: String(firstDataRequest ? Date.now() : to * 1000),
        type: mappedResolution,
      });
      const url = `${this._datafeedURL}/exchange/api/v1/kline?${params}`
      const response = await fetch(url);
      const data = await response.json();

      const bars: Bar[] = data.data.map((item: any) => ({
        time: item[0],
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
      }));

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
    const topic = `exchange-kline/${symbolInfo.name.replace("/", "-")}`;

    this.mqttClient.subscribe(topic, { qos: 0 }, (err) => {
      if (err) {
        console.error("订阅失败:", err);
        return;
      }

      this.mqttClient.on("message", (topic, message) => {
        if (!topic.startsWith("exchange-kline")) return;

        try {
          const resp = JSON.parse(message.toString());

          const bar: Bar = {
            time: resp.time,
            open: resp.openPrice,
            high: resp.highestPrice,
            low: resp.lowestPrice,
            close: resp.closePrice,
            volume: resp.volume,
          };

          onRealtimeCallback(bar);
        } catch (err) {
          console.error("消息解析错误:", err);
        }
      });
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
