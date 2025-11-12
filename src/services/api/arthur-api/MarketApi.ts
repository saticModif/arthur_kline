import type { AxiosInstance } from 'axios';

import { WsApiClient, HttpApiClient } from '../_api-client';

const spotIntervalMap: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
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
  private futuresPendingRequest: Map<string, Promise<any[]>> = new Map(); // 合约防重复请求
  private futuresLastRequestTime: Map<string, number> = new Map(); // 合约上次请求时间

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
    const interval = spotIntervalMap[options.interval] ?? options.interval ?? '5m';

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

    // 创建请求键，只基于 symbol 和 interval（忽略 startTime/endTime 的差异）
    // 因为 TradingView 可能会用不同的时间范围调用两次
    const requestKey = `${symbol_}-${interval}`;
    const now = Date.now();
    const lastTime = this.futuresLastRequestTime.get(requestKey) || 0;
    const timeDiff = now - lastTime;

    // 如果相同的 symbol 和 interval 在 10000ms 内正在进行，复用该请求
    if (this.futuresPendingRequest.has(requestKey) && timeDiff < 10000) {
      console.log(`[API] ⚠️ 重复请求已拦截: ${symbol_}-${interval} (${timeDiff}ms)`);
      try {
        return await this.futuresPendingRequest.get(requestKey)!;
      } catch (e) {
        // 如果复用的请求失败，继续执行新请求
        console.warn(`[API] ❌ 复用失败，执行新请求:`, e);
        this.futuresPendingRequest.delete(requestKey);
      }
    }

    // 先创建一个占位符Promise，立即保存到Map，确保后续请求能立即检测到
    let resolvePlaceholder!: (value: any) => void;
    let rejectPlaceholder!: (error: any) => void;
    const placeholderPromise = new Promise<any>((resolve, reject) => {
      resolvePlaceholder = resolve;
      rejectPlaceholder = reject;
    });
    
    // 立即保存占位符到 pendingRequest（同步操作，确保后续请求能立即检测到）
    this.futuresPendingRequest.set(requestKey, placeholderPromise);
    
    // 记录请求时间
    this.futuresLastRequestTime.set(requestKey, now);
    
    console.log(`[API] 🚀 新请求: ${symbol_}-${interval}`);

    // 创建请求 Promise
    const requestPromise = this.http.get('/swap/history', {
      params: {
        symbol: symbol_,
        resolution: interval,
        from: options.startTime, // 可选参数，undefined 会被自动忽略
        to: options.endTime
      }
    }).then(response => {
      // 提取 response.data 中的 data 字段（确保是数组，若不存在返回空数组兜底）
      const klineData = response || [];

      // 校验返回的是否为数组（避免接口返回非数组格式导致下游出错）
      if (!Array.isArray(klineData)) {
        console.warn('K线接口返回的 data 不是数组，返回空数组');
        return [];
      }

      return klineData;
    });

    // 用真正的请求Promise替换占位符，并处理结果
    requestPromise
      .then(data => {
        // 请求成功后，resolve占位符Promise
        resolvePlaceholder!(data);
        // 延迟移除缓存（延迟 10000ms，确保后续重复请求能检测到）
        setTimeout(() => {
          this.futuresPendingRequest.delete(requestKey);
        }, 10000);
      })
      .catch(error => {
        // 请求失败时，reject占位符Promise
        rejectPlaceholder!(error);
        // 延迟移除缓存
        setTimeout(() => {
          this.futuresPendingRequest.delete(requestKey);
        }, 10000);
      });

    // 返回占位符Promise（这样后续请求可以立即检测到并复用）
    return await placeholderPromise;
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
