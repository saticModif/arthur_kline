import type { AxiosInstance } from 'axios';

import { WsApiClient, HttpApiClient } from '../_api-client';

const intervalMap: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
  "1M": "1M"
};

export default class MarketApi {
  private spotHttp: HttpApiClient;
  private futuresHttp: HttpApiClient;
  private spotWs: WsApiClient;
  private futuresWs: WsApiClient;

  constructor(options: { spotHttp: HttpApiClient, futuresHttp: HttpApiClient, spotWs: WsApiClient, futuresWs: WsApiClient }) {
    this.spotHttp = options.spotHttp;
    this.futuresHttp = options.futuresHttp;
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
    const symbol_ = `${base}${quote}`.toUpperCase();
    const interval = intervalMap[options.interval];

    // Binance Spot API endpoint
    const response = await this.spotHttp.get('/api/v3/klines', {
      params: {
        symbol: symbol_,
        interval: interval,
        limit: options.limit || 500,
        startTime: options.startTime,
        endTime: options.endTime
      }
    });

    // Binance returns array of arrays: [time, open, high, low, close, volume, ...]
    const klineData = response || [];

    if (!Array.isArray(klineData)) {
      console.warn('Binance K线接口返回的数据不是数组，返回空数组');
      return [];
    }

    return klineData;
  }

  public async subscribeSpotKline(symbol: string, options: { interval: string }): Promise<(ReadableStream<any> | null)> {
    const [base, quote] = symbol.split('-');
    const symbol_ = `${base}${quote}`.toLowerCase();
    const interval = intervalMap[options.interval] ?? '1m';
    const topic = `${symbol_}@kline_${interval}`;

    const streams = await this.spotWs.subscribe([topic]);
    const streamResult = streams[0] ?? null;
    if (!streamResult) return null;
    const [streamCopy] = streamResult.tee();

    return streamCopy.pipeThrough(new TransformStream({
      transform(jsonData, controller) {
        // Binance WebSocket format: {"stream": "kline_btcusdt", "data": {"k": {...}}}
        if (jsonData.k) {
          const klineData = jsonData.k;
          // Transform to match expected format
          const transformedData = [
            klineData.t,
            klineData.o,
            klineData.h,
            klineData.l,
            klineData.c,
            klineData.v
          ];
          controller.enqueue([transformedData]);
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
    const symbol_ = `${base}${quote}`.toUpperCase();
    const interval = intervalMap[options.interval];

    // Binance Futures API endpoint
    const response = await this.futuresHttp.get('/fapi/v1/klines', {
      params: {
        symbol: symbol_,
        interval: interval,
        limit: options.limit || 500,
        startTime: options.startTime,
        endTime: options.endTime
      }
    });

    const klineData = response.data || [];

    if (!Array.isArray(klineData)) {
      console.warn('Binance Futures K线接口返回的数据不是数组，返回空数组');
      return [];
    }

    // Transform to match Arthur API format if needed
    return klineData
  }

  public async subscribeFuturesKline(symbol: string, options: { interval: string }): Promise<(ReadableStream<any> | null)> {
    const [base, quote] = symbol.split('-');
    const symbol_ = `${base}${quote}`.toLowerCase();
    const interval = intervalMap[options.interval];
    const topic = `${symbol_}@kline_${interval}`;

    const streams = await this.futuresWs.subscribe([topic]);
    const streamResult = streams[0] ?? null;
    if (!streamResult) return null;
    const [streamCopy] = streamResult.tee();

    return streamCopy.pipeThrough(new TransformStream({
      transform(jsonData, controller) {
        // Binance Futures WebSocket format
        if (jsonData.k) {
          const klineData = jsonData.k;
          // Transform to match expected format
          const transformedData = [
            klineData.t,
            klineData.o,
            klineData.h,
            klineData.l,
            klineData.c,
            klineData.v
          ];
          controller.enqueue([transformedData]);
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
}