// 抽象交易所API接口定义
export interface ExchangeApi {
  readonly implType: string;
  readonly impl: any;

  // 统一的K线数据获取接口
  getKline(strId: string, options: {
    interval: string; limit?: number;
    startTime?: number;
    endTime?: number;
  }): Promise<any[]>;

  // 统一的K线数据订阅接口
  subscribeKline(strId: string, options: { interval?: string }): Promise<ReadableStream<any> | null>;
}