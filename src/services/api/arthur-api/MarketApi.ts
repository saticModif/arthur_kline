import type { AxiosInstance } from 'axios';

import { WsApiClient, HttpApiClient } from '../api-client';

const spotIntervalMap: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",  // 注意：1h 映射为 60m
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
    const interval = spotIntervalMap[options.interval] ?? '5m';

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

    // 注意：后端返回的数据已经按时间戳递增顺序排列，前端不需要排序
    // const sorted = klineData.slice().sort((a, b) => a[0] - b[0]); // 已注释，后端已排序
    return klineData;
  }

  public async subscribeSpotKline(symbol: string, options: { interval: string }): Promise<(ReadableStream<any> | null)> {
    const [base, quote] = symbol.split('-');
    const symbol_ = `${base}/${quote}`.toUpperCase();
    // 现货订阅永远只订阅1m的数据
    const topic = `kline_${symbol_}_1m`;
    
    // 用户请求的周期（用于数据聚合）
    const targetInterval = options.interval ?? '1m';

    const streams = await this.spotWs.subscribe([topic]);
    const stream = streams[0] ?? null;
    if (!stream) return null;
    const [streamCopy] = stream.tee();

    // 如果目标周期是1m，直接返回原始数据，不需要聚合
    if (targetInterval === '1m') {
      return streamCopy.pipeThrough(new TransformStream({
        transform(jsonData, controller) {
          const data = jsonData?.data;
          if (!data) return;

          // 将数据放到数组里一起传递到下游，与HTTP请求的返回格式保持一致
          const items = Array.isArray(data) ? data : [data];
          
          // 打印转换后的K线数据
          console.log(`[Socket][现货K线] topic: ${jsonData.topic}, 转换后数据:`, JSON.stringify(items, null, 2));
          
          controller.enqueue(items);
        }
      }));
    }

    // 对于非1m周期，需要聚合1m数据
    // 使用闭包存储状态
    let buffer: number[][] = [];
    let currentPeriodStart: number | null = null;
    
    // 计算周期起始时间戳
    const getPeriodStartTime = (timestamp: number, interval: string): number => {
      const date = new Date(timestamp);
      const minutes = date.getMinutes();
      const hours = date.getHours();
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();
      
      // 将时间对齐到周期边界
      let alignedDate: Date;
      
      if (interval === '5m') {
        alignedDate = new Date(year, month, day, hours, Math.floor(minutes / 5) * 5, 0, 0);
      } else if (interval === '15m') {
        alignedDate = new Date(year, month, day, hours, Math.floor(minutes / 15) * 15, 0, 0);
      } else if (interval === '1h') {
        // 1h 对齐到整点
        alignedDate = new Date(year, month, day, hours, 0, 0, 0);
      } else if (interval === '4h') {
        alignedDate = new Date(year, month, day, Math.floor(hours / 4) * 4, 0, 0, 0);
      } else if (interval === '1d') {
        // 1d 对齐到当天0点
        alignedDate = new Date(year, month, day, 0, 0, 0, 0);
      } else if (interval === '1w') {
        // 1w 对齐到周一0点
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        alignedDate = new Date(year, month, day - daysToMonday, 0, 0, 0, 0);
      } else if (interval === '1M') {
        // 1M 对齐到月初
        alignedDate = new Date(year, month, 1, 0, 0, 0, 0);
      } else {
        // 默认使用原始时间戳
        alignedDate = date;
      }
      
      return alignedDate.getTime();
    };
    
    // 聚合K线数据
    const aggregateKlines = (klines: number[][], periodStart: number | null): number[] | null => {
      if (klines.length === 0) return null;
      
      // 第一个K线的开盘价和时间戳
      const firstKline = klines[0];
      const startTime = periodStart ?? firstKline[0];
      const open = firstKline[1];
      
      // 最后一个K线的收盘价
      const lastKline = klines[klines.length - 1];
      const close = lastKline[4];
      
      // 计算最高价和最低价
      let high = firstKline[2];
      let low = firstKline[3];
      let volume = 0;
      
      for (const kline of klines) {
        high = Math.max(high, kline[2]);
        low = Math.min(low, kline[3]);
        volume += kline[5];
      }
      
      // 返回聚合后的K线数据: [time, open, high, low, close, volume]
      return [startTime, open, high, low, close, volume];
    };
    
    return streamCopy.pipeThrough(new TransformStream({
      transform(jsonData, controller) {
        const data = jsonData?.data;
        if (!data) return;

        // 将数据放到数组里一起传递到下游
        const items = Array.isArray(data) ? data : [data];
        
        for (const kline of items) {
          // K线数据格式: [time, open, high, low, close, volume]
          if (!Array.isArray(kline) || kline.length < 6) continue;
          
          const [time, open, high, low, close, volume] = kline;
          
          // 计算目标周期的起始时间戳
          const periodStart = getPeriodStartTime(time, targetInterval);
          
          // 如果是一个新的周期，先处理上一个周期的数据（已完成）
          if (currentPeriodStart !== null && periodStart !== currentPeriodStart) {
            const aggregatedKline = aggregateKlines(buffer, currentPeriodStart);
            if (aggregatedKline) {
              console.log(`[Socket][现货K线聚合] 周期: ${targetInterval}, 完成周期, 聚合了 ${buffer.length} 根1m K线, 输出:`, JSON.stringify([aggregatedKline], null, 2));
              controller.enqueue([aggregatedKline]);
            }
            // 清空缓冲区，开始新的周期
            buffer = [];
            currentPeriodStart = periodStart;
          } else if (currentPeriodStart === null) {
            // 第一次，初始化周期起始时间
            currentPeriodStart = periodStart;
            console.log(`[Socket][现货K线聚合] 开始新的聚合周期: ${targetInterval}, 起始时间: ${new Date(periodStart).toISOString()}`);
          }
          
          // 将当前1m数据添加到缓冲区
          buffer.push([time, open, high, low, close, volume]);
          
          // 每次收到新的1m数据后，立即输出当前正在构建的聚合K线（未完成的K线）
          // 这样用户就能看到实时的价格更新
          const currentAggregatedKline = aggregateKlines(buffer, currentPeriodStart);
          if (currentAggregatedKline) {
            console.log(`[Socket][现货K线聚合] 周期: ${targetInterval}, 实时更新, 当前缓冲区有 ${buffer.length} 根1m K线, 输出:`, JSON.stringify([currentAggregatedKline], null, 2));
            controller.enqueue([currentAggregatedKline]);
          }
        }
      },
      
      flush(controller) {
        // 流结束时，处理剩余的缓冲区数据
        if (buffer.length > 0) {
          const aggregatedKline = aggregateKlines(buffer, currentPeriodStart);
          if (aggregatedKline) {
            controller.enqueue([aggregatedKline]);
          }
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

        // 打印原始合约K线数据
        console.log(`[Socket][合约K线-原始] topic: ${jsonData.topic}, 原始数据:`, JSON.stringify(data, null, 2));

        // 转换合约数据格式为与现货一致的数组格式 [time, open, high, low, close, volume]
        const transformedData = [
          data.time,           // 时间戳
          data.openPrice,      // 开盘价
          data.highestPrice,   // 最高价
          data.lowestPrice,    // 最低价
          data.closePrice,     // 收盘价
          data.volume          // 成交量
        ];

        // 打印转换后的合约K线数据
        console.log(`[Socket][合约K线-转换后] topic: ${jsonData.topic}, 转换后数据:`, JSON.stringify([transformedData], null, 2));

        // 将数据放到数组里一起传递到下游，与HTTP请求的返回格式保持一致
        controller.enqueue([transformedData]);
      }
    }));
  }
}
