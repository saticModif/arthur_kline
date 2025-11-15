import { ArthurApi } from './api/arthur-api';
import { BinanceApi } from './api/binance-api';
import { type ExchangeApi, apiConfig } from './api/api';
export { type ExchangeApi } from './api/api';

class ApiService {
  private static instance: ApiService | null = null;

  private _api: ExchangeApi;
  public get api(): ExchangeApi {
    return this._api;
  }

  private constructor() {
    console.debug('ApiService Create')
    apiConfig.enableHttpLog(true);
    apiConfig.enableWsLog(true);
    this._api = this._createApi('ArthurApi');
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // 通过鸭子类型创建API实例
  private _createApi(type: string): ExchangeApi {
    switch (type) {
      case 'ArthurApi':
        const arthurApi = new ArthurApi();
        return {
          implType: 'ArthurApi',
          impl: arthurApi,
          getKline: (strId, options) => arthurApi.market.getKline(strId, options),
          subscribeKline: (strId, options) => arthurApi.market.subscribeKline(strId, options),

        } as ExchangeApi;

      case 'BinanceApi':
        const binanceApi = new BinanceApi();
        return {
          implType: 'BinanceApi',
          impl: binanceApi,
          getKline: (strId, options) => binanceApi.market.getKline(strId, options),
          subscribeKline: (strId, options) => binanceApi.market.subscribeKline(strId, options),
        } as ExchangeApi;

      default:
        throw new Error(`Unsupported exchange type: ${type}`);
    }
  }
}

// 导出单例实例
export const apiService = ApiService.getInstance();

// 导出类以备扩展
export default ApiService;