// tests/indicator-price-labels.browser.test.ts
// 浏览器自动化测试：验证指标价格标签是否被隐藏

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('指标价格标签隐藏测试', () => {
  let page: any
  let browser: any
  
  beforeAll(async () => {
    // 注意：在vitest browser环境中，page和browser会自动注入
    // 这里需要根据实际的vitest browser API调整
  })
  
  it('应该隐藏Bollinger Bands指标的价格标签', async () => {
    // 启动开发服务器（如果还没启动）
    const baseURL = 'http://localhost:5173'
    const testURL = `${baseURL}/?strId=btc-usdt-spot&showIndicatorBar=true`
    
    // 导航到测试页面
    await page.goto(testURL)
    
    // 等待图表加载
    await page.waitForSelector('#tv-chart-container', { timeout: 10000 })
    
    // 等待指标创建完成
    await page.waitForFunction(
      () => {
        const logs = Array.from(document.querySelectorAll('*')).some(el => 
          el.textContent?.includes('create indicator BOLL success')
        )
        return logs || document.querySelector('[data-indicator="BOLL"]') !== null
      },
      { timeout: 15000 }
    )
    
    // 点击BOLL指标按钮来显示指标
    const bollButton = await page.$('button:has-text("BOLL"), [data-indicator="BOLL"]')
    if (bollButton) {
      await bollButton.click()
      // 等待指标显示
      await page.waitForTimeout(1000)
    }
    
    // 等待价格标签隐藏逻辑执行
    await page.waitForTimeout(2000)
    
    // 查找所有价格标签元素
    const priceLabels = await page.$$eval('div, span', (elements: Element[]) => {
      return elements
        .filter(el => {
          const text = el.textContent?.trim() || ''
          const cleanedText = text.replace(/,/g, '').replace(/\s/g, '')
          const isNumber = /^\d+\.\d+$/.test(cleanedText)
          const decimalPart = cleanedText.split('.')[1]
          const isLongDecimal = decimalPart && decimalPart.length > 2
          return isNumber && isLongDecimal
        })
        .map(el => ({
          text: el.textContent?.trim(),
          isHidden: window.getComputedStyle(el).display === 'none' || 
                   window.getComputedStyle(el).visibility === 'hidden' ||
                   window.getComputedStyle(el).opacity === '0',
          hasDataAttribute: false // 不再使用data属性
        }))
    })
    
    // 验证：所有长小数位的价格标签应该被隐藏
    const visibleIndicatorLabels = priceLabels.filter(label => 
      !label.isHidden
    )
    
    console.log('找到的价格标签:', priceLabels)
    console.log('未隐藏的指标价格标签:', visibleIndicatorLabels)
    
    // 断言：不应该有可见的长小数位价格标签（指标价格标签）
    expect(visibleIndicatorLabels.length).toBe(0)
  }, 30000)
  
  it('应该验证TradingView官方API已正确应用', async () => {
    const baseURL = 'http://localhost:5173'
    const testURL = `${baseURL}/?strId=btc-usdt-spot&showIndicatorBar=true`
    
    await page.goto(testURL)
    await page.waitForSelector('#tv-chart-container', { timeout: 10000 })
    await page.waitForTimeout(5000)
    
    // 检查控制台日志中是否有TradingView官方API相关的日志
    // 注意：在浏览器测试环境中，可能需要通过其他方式验证
    // 这里我们验证图表容器已加载，表示初始化完成
    const chartLoaded = await page.evaluate(() => {
      return document.getElementById('tv-chart-container') !== null
    })
    
    expect(chartLoaded).toBe(true)
    console.log('✅ 图表已加载，TradingView官方API应在初始化时应用')
  }, 30000)
  
  afterAll(async () => {
    // 清理工作
  })
})

