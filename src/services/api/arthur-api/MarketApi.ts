import type { AxiosInstance } from 'axios';

import { WsApiClient } from '../api-client';


export default class MarketApi {
  private http: AxiosInstance;
  private spotWs: WsApiClient;
  private futuresWs: WsApiClient;

  constructor(options: { http: any, spotWs: WsApiClient, futuresWs: WsApiClient }) {
    this.http = options.http;
    this.spotWs = options.spotWs;
    this.futuresWs = options.futuresWs;
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

    const intervalMap: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "60m",  // 注意：1h 映射为 60m
      "4h": "4h",
      "1d": "1d",
      "1w": "1w",
      "1M": "1M"
    };

    const interval = intervalMap[options.interval] ?? '5m';


    // 直接传 params 对象，axios 会自动拼接为 URL 参数
    const response = await this.http.get('/exchange/api/v1/kline', {
      params: {
        pair: symbol_,
        type: interval,
        start: options.startTime, // 可选参数，undefined 会被自动忽略
        end: options.endTime
      }
    });

    // 提取 response.data 中的 data 字段（确保是数组，若不存在返回空数组兜底）
    const klineData = response.data?.data || [];

    // 校验返回的是否为数组（避免接口返回非数组格式导致下游出错）
    if (!Array.isArray(klineData)) {
      console.warn('K线接口返回的 data 不是数组，返回空数组');
      return [];
    }

    return klineData;
  }

  public async subscribeSpotKline(symbol: string): Promise<(ReadableStream<any> | null)> {
    const [base, quote] = symbol.split('-');
    const symbol_ = `${base}/${quote}`.toUpperCase();

    const topic = `kline_${symbol_}_1m`;
    const streams = await this.spotWs.subscribe([topic]);
    const stream = streams[0] ?? null;
    if (!stream) return null;
    const [streamCopy] = stream.tee();

    return streamCopy.pipeThrough(new TransformStream({
      transform(jsonData, controller) {
        if (jsonData.data && Array.isArray(jsonData.data)) {
          controller.enqueue(jsonData.data);
        }
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

    const intervalMap: Record<string, string> = {
      "1m": "1",
      "5m": "5",
      "15m": "15",
      "1h": "60",  // 注意：1h 映射为 60m
      "4h": "4h",
      "1d": "1D",
      "1w": "1W",
      "1M": "1M"
    };

    const interval = intervalMap[options.interval] ?? '5';

    const response = await this.http.get('/swap/history', {
      params: {
        symbol: symbol_,
        type: interval,
        from: options.startTime, // 可选参数，undefined 会被自动忽略
        to: options.endTime
      }
    });

    // 提取 response.data 中的 data 字段（确保是数组，若不存在返回空数组兜底）
    const klineData = response.data || [];

    // 校验返回的是否为数组（避免接口返回非数组格式导致下游出错）
    if (!Array.isArray(klineData)) {
      console.warn('K线接口返回的 data 不是数组，返回空数组');
      return [];
    }

    return klineData;
  }

  public async subscribeFuturesKline(symbol: string): Promise<(ReadableStream<any> | null)> {
    const topic = `contract-kline/${symbol.toUpperCase()}`;

    const streams = await this.futuresWs.subscribe([topic]);
    const stream = streams[0] ?? null;
    if (!stream) return null;
    const [streamCopy] = stream.tee();

    return streamCopy.pipeThrough(new TransformStream({
      transform(jsonData, controller) {
        if (Array.isArray(jsonData)) {
          controller.enqueue(jsonData);
        }
      }
    }));
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
      return this.getSpotKline({symbol, ...options});
    } else {
      return this.getFuturesKline({symbol, ...options});
    }
  }

  public async subscribeKline(strId: string) {
    const [base, quote, type] = strId.split('-');
    const symbol = `${base}-${quote}`;

    if (type === 'spot') {
      return this.subscribeSpotKline(symbol);
    } else {
      return this.subscribeFuturesKline(symbol);
    }
  }
}
