import { WsApiClient } from '@/utils/api-client';

export default class MarketApi {
  private http: any;
  private spotWs: WsApiClient;
  // private _futuresWs: WsApiClient;

  constructor(options: { http: any, spotWs: WsApiClient, futuresWs: WsApiClient }) {
    this.http = options.http;
    this.spotWs = options.spotWs;
    // this._futuresWs = options.futuresWs;
  }

  public async getSpotKline(options: {
    symbol: string;
    interval: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }) {
    const { symbol, interval, limit = 500, startTime, endTime } = options;
    // const safeLimit = Math.min(limit, 1000);

    // 直接传 params 对象，axios 会自动拼接为 URL 参数
    const response = await this.http.get('/exchange/api/v1/kline', {
      params: {
        pair: symbol,
        type: interval,
        limit: limit,
        start: startTime, // 可选参数，undefined 会被自动忽略
        end: endTime
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

  public async subscribeSpotKline(symbol: string, options: { interval?: string } = {}): Promise<(ReadableStream<any> | null)> {
    const interval = options.interval ?? '1m';
    const topic = `kline_${symbol}_${interval}`;
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
}
