import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 配置
 * 用于端到端测试，验证指标价格标签隐藏功能
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.test.ts',
  
  // 每个测试的超时时间
  timeout: 60000,
  
  // 测试失败时的重试次数
  retries: 1,
  
  // 并行运行的工作进程数
  workers: 1,
  
  // 测试报告
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  use: {
    // 基础URL
    baseURL: 'http://localhost:5173',
    
    // 浏览器上下文选项
    viewport: { width: 1920, height: 1080 },
    
    // 截图设置
    screenshot: 'only-on-failure',
    
    // 视频录制
    video: 'retain-on-failure',
    
    // 追踪
    trace: 'retain-on-failure',
  },

  // 配置项目
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 可以添加其他浏览器
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Web服务器配置（可选：自动启动开发服务器）
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
})

