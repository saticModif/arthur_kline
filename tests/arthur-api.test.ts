import { describe, it, expect } from 'vitest'

import { apiService } from '@/services/ApiService'

describe('arthur-api', () => {
  const exchangeApi = apiService.api

  it('subscribeSpotKline', async () => {
    // 启动订阅
    const stream = await exchangeApi.subscribeKline('btc-usdt-spot', { interval: '1m' })
    expect(stream).toBeDefined()
    expect(stream).not.toBeNull()

    const reader = stream!.getReader()

    for (let i = 0; i < 3; i++) {
      const { value, done } = await reader.read()
      if (done) break
      console.log(JSON.stringify(value));
    }
  }, 5000) // 测试超时时间（默认 5s）

  it('getSpotKline', async () => {
    const data = await exchangeApi.getKline('btc-usdt-spot', {
      interval: '1m',
      startTime: Date.now() - 3600 * 1000,
      endTime: Date.now()
    })
    expect(data).toBeDefined()
    console.log(JSON.stringify(data))
  })

})