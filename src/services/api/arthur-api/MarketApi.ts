import type { AxiosInstance } from 'axios';

import { WsApiClient, HttpApiClient } from '../_api-client';

const spotIntervalMap: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "60m",  // 注意：1h 映射为 60m
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
  "1M": "1M"
};

const futuresIntervalMap: Record<string, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",  // 注意：1h 映射为 60m
  "4h": "4h",
  "1d": "1D",
  "1w": "1W",
  "1M": "1M"
};

export default class MarketApi {
  private http: HttpApiClient;
  private spotWs: WsApiClient;
  private futuresWs: WsApiClient;

  constructor(options: { http: HttpApiClient, spotWs: WsApiClient, futuresWs: WsApiClient }) {
    this.http = options.http;
    this.spotWs = options.spotWs;
    this.futuresWs = options.futuresWs;
  }

  public async getKline(strId: string, options: {
    interval: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }) {
    const [base, quote, type] = strId.split('-');
    const symbol = `${base}-${quote}`;

    if (type === 'spot') {
      return this.getSpotKline({ symbol, ...options });
    } else {
      return this.getFuturesKline({ symbol, ...options });
    }
  }

  public async subscribeKline(strId: string, options: { interval?: string }) {
    const options_ = { interval: '5m', ...options };
    const [base, quote, type] = strId.split('-');
    const symbol = `${base}-${quote}`;

    if (type === 'spot') {
      return this.subscribeSpotKline(symbol, options_);
    } else {
      return this.subscribeFuturesKline(symbol, options_);
    }
  }

  public async getSpotKline(options: {
    symbol: string;
    interval: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }) {
    const [base, quote] = options.symbol.split('-');
    const symbol_ = `${base}/${quote}`.toUpperCase();
    const interval = futuresIntervalMap[options.interval] ?? '5m';

    const response = await this.http.get('/exchange/api/v1/kline', {
      params: {
        pair: symbol_,
        type: interval,
        start: options.startTime, // 可选参数，undefined 会被自动忽略
        end: options.endTime
      }
    });

    // 提取 response.data 中的 data 字段（确保是数组，若不存在返回空数组兜底）
    const klineData = response.data ?? [];

    // 校验返回的是否为数组（避免接口返回非数组格式导致下游出错）
    if (!Array.isArray(klineData)) {
      console.warn('K线接口返回的 data 不是数组，返回空数组');
      return [];
    }

    return klineData;
  }

  public async subscribeSpotKline(symbol: string, options: { interval: string }): Promise<(ReadableStream<any> | null)> {
    const [base, quote] = symbol.split('-');
    const symbol_ = `${base}/${quote}`.toUpperCase();
    const interval = spotIntervalMap[options.interval] ?? '5m';
    const topic = `kline_${symbol_}_${interval}`;

    const streams = await this.spotWs.subscribe([topic]);
    const stream = streams[0] ?? null;
    if (!stream) return null;
    const [streamCopy] = stream.tee();

    return streamCopy.pipeThrough(new TransformStream({
      transform(jsonData, controller) {
        const data = jsonData?.data;
        if (!data) return;

        // 将数据放到数组里一起传递到下游，与HTTP请求的返回格式保持一致
        const items = Array.isArray(data) ? data : [data];
        controller.enqueue(items);
      }
    }));
  }

  public async getFuturesKline(options: {
    symbol: string;
    interval: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }) {
    const [base, quote] = options.symbol.split('-');
    const symbol_ = `${base}/${quote}`.toUpperCase();
    const interval = futuresIntervalMap[options.interval] ?? '5';

    const response = await this.http.get('/swap/history', {
      params: {
        symbol: symbol_,
        resolution: interval,
        from: options.startTime, // 可选参数，undefined 会被自动忽略
        to: options.endTime
      }
    });

    // 提取 response.data 中的 data 字段（确保是数组，若不存在返回空数组兜底）
    const klineData = response || [];

    // 校验返回的是否为数组（避免接口返回非数组格式导致下游出错）
    if (!Array.isArray(klineData)) {
      console.warn('K线接口返回的 data 不是数组，返回空数组');
      return [];
    }

    return klineData;
  }

  public async subscribeFuturesKline(symbol: string, options: { interval: string }): Promise<(ReadableStream<any> | null)> {
    const symbol_ = symbol.toUpperCase();
    const interval = futuresIntervalMap[options.interval] ?? '5';
    const topic = `contract-kline/${symbol_}`;

    const streams = await this.futuresWs.subscribe([topic]);
    const stream = streams[0] ?? null;
    if (!stream) return null;
    const [streamCopy] = stream.tee();

    return streamCopy.pipeThrough(new TransformStream({
      transform(jsonData, controller) {
        const data = jsonData?.data;
        if (!data) return;

        // 转换合约数据格式为与现货一致的数组格式 [time, open, high, low, close, volume]
        const transformedData = [
          data.time,           // 时间戳
          data.openPrice,      // 开盘价
          data.highestPrice,   // 最高价
          data.lowestPrice,    // 最低价
          data.closePrice,     // 收盘价
          data.volume          // 成交量
        ];

        // 将数据放到数组里一起传递到下游，与HTTP请求的返回格式保持一致
        controller.enqueue([transformedData]);
      }
    }));
  }
}
