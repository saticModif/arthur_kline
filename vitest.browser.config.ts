// vitest.browser.config.ts - 浏览器自动化测试配置
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  plugins: [],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    // 包含的测试文件模式
    include: ['tests/**/*.browser.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    
    // 使用浏览器环境
    browser: {
      enabled: true,
      name: 'chromium', // 或 'firefox', 'webkit'
      provider: 'playwright',
      headless: false, // 设置为 true 可以无头模式运行
    },
    
    // 全局 API
    globals: true,
    
    // 测试超时时间（浏览器测试可能需要更长时间）
    testTimeout: 30000,
    
    // 覆盖率
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})

