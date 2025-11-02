import { ArthurApi } from './api/arthur-api';

class ApiService {
  private static instance: ApiService | null = null;
  private _arthurApi: ArthurApi | null = null;

  private constructor() {
    console.debug('ApiService Create')
    this._arthurApi = new ArthurApi();
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // 获取 ArthurApi 实例
  public get arthurApi(): ArthurApi {
    if (!this._arthurApi) {
      throw new Error('Arthur API not initialized');
    }
    return this._arthurApi;
  }
}

// 导出单例实例
export const apiService = ApiService.getInstance();

// 导出类以备扩展
export default ApiService;