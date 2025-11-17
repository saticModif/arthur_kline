// tests/indicator-price-labels.e2e.test.ts
// 使用 Playwright 进行端到端测试：验证指标价格标签是否被隐藏

import { test, expect } from '@playwright/test'

test.describe('指标价格标签隐藏功能测试', () => {
  const baseURL = 'http://localhost:5173'
  
  test.beforeEach(async ({ page }) => {
    // 设置较长的超时时间
    test.setTimeout(60000)
  })
  
  test('应该隐藏Bollinger Bands指标的价格标签', async ({ page }) => {
    // 导航到测试页面
    await page.goto(`${baseURL}/?strId=btc-usdt-spot&showIndicatorBar=true`)
    
    // 等待图表容器加载
    await page.waitForSelector('#tv-chart-container', { timeout: 15000 })
    
    // 等待页面完全加载（包括TradingView库）
    await page.waitForTimeout(3000)
    
    // 查找并点击BOLL指标按钮
    const bollButton = page.locator('button:has-text("BOLL"), [data-indicator="BOLL"]').first()
    
    // 检查按钮是否存在，如果存在则点击
    const buttonCount = await bollButton.count()
    if (buttonCount > 0) {
      await bollButton.click()
      console.log('✅ 已点击BOLL指标按钮')
      
      // 等待指标显示和价格标签隐藏逻辑执行
      await page.waitForTimeout(3000)
    } else {
      console.log('⚠️ 未找到BOLL按钮，可能指标已自动显示')
      await page.waitForTimeout(2000)
    }
    
    // 执行JavaScript来查找所有价格标签
    const priceLabelsInfo = await page.evaluate(() => {
      const container = document.getElementById('tv-chart-container')
      if (!container) return { error: '容器未找到' }
      
      const containerRect = container.getBoundingClientRect()
      const containerWidth = containerRect.width
      
      const allElements = Array.from(container.querySelectorAll('div, span, label'))
      const labels: Array<{
        text: string
        isHidden: boolean
        hasDataAttribute: boolean
        position: { left: number; top: number }
        styles: { display: string; visibility: string; opacity: string }
      }> = []
      
      allElements.forEach((element) => {
        const el = element as HTMLElement
        const text = el.textContent?.trim() || ''
        if (!text) return
        
        const cleanedText = text.replace(/,/g, '').replace(/\s/g, '')
        const isNumber = /^\d+\.\d+$/.test(cleanedText)
        const decimalPart = cleanedText.split('.')[1]
        const isLongDecimal = decimalPart && decimalPart.length > 2
        
        if (isNumber && isLongDecimal) {
          const rect = el.getBoundingClientRect()
          const relativeLeft = rect.left - containerRect.left
          const isOnRightSide = relativeLeft > containerWidth * 0.7
          
          if (isOnRightSide) {
            const styles = window.getComputedStyle(el)
            labels.push({
              text,
              isHidden: styles.display === 'none' || 
                       styles.visibility === 'hidden' ||
                       styles.opacity === '0',
              hasDataAttribute: false, // 不再使用data属性
              position: { left: relativeLeft, top: rect.top - containerRect.top },
              styles: {
                display: styles.display,
                visibility: styles.visibility,
                opacity: styles.opacity
              }
            })
          }
        }
      })
      
      return { labels, containerWidth, totalElements: allElements.length }
    })
    
    console.log('📊 价格标签检查结果:', JSON.stringify(priceLabelsInfo, null, 2))
    
    // 验证：所有指标价格标签应该被隐藏
    if (priceLabelsInfo.labels && priceLabelsInfo.labels.length > 0) {
      const visibleLabels = priceLabelsInfo.labels.filter(label => !label.isHidden)
      
      if (visibleLabels.length > 0) {
        console.error('❌ 发现未隐藏的指标价格标签:', visibleLabels)
        // 输出详细信息以便调试
        visibleLabels.forEach(label => {
          console.error(`  - 文本: ${label.text}, 位置: ${label.position.left}/${priceLabelsInfo.containerWidth}, 样式:`, label.styles)
        })
      }
      
      expect(visibleLabels.length).toBe(0)
    } else {
      console.log('ℹ️ 未找到指标价格标签（可能已被隐藏或尚未渲染）')
    }
  })
  
  test('应该验证TradingView官方API已正确应用', async ({ page }) => {
    // 在页面加载前设置console监听器，确保捕获所有日志
    const consoleLogs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'log') {
        const text = msg.text()
        if (text.includes('tvchart') || text.includes('隐藏') || text.includes('indicator') || 
            text.includes('TradingView') || text.includes('API')) {
          consoleLogs.push(text)
        }
      }
    })
    
    await page.goto(`${baseURL}/?strId=btc-usdt-spot&showIndicatorBar=true`)
    await page.waitForSelector('#tv-chart-container', { timeout: 15000 })
    
    // 等待图表完全初始化（包括TradingView库加载）
    await page.waitForTimeout(5000)
    
    // 检查是否有TradingView官方API应用成功的日志
    const hasApiLog = consoleLogs.some(log => 
      log.includes('已使用TradingView官方API隐藏指标价格标签') ||
      log.includes('scalesProperties.showStudyLastValue') ||
      log.includes('scalesProperties.showStudyPlotLabels')
    )
    
    console.log('📝 相关控制台日志:', consoleLogs)
    
    // 验证：应该看到TradingView官方API应用成功的日志
    expect(hasApiLog).toBe(true)
    console.log('✅ TradingView官方API已正确应用')
  })
})

