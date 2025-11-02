// vitest.config.ts
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
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // 测试环境（如需 DOM 支持）
    environment: 'jsdom', // 或 'happy-dom'

    // 全局 API（可选：直接使用 describe/it/expect 而无需 import）
    globals: true,

    // 覆盖率（可选）
    coverage: {
      provider: 'v8', // 或 'istanbul'
      reporter: ['text', 'json', 'html'],
    },

    // 类型检查（需启用）
    typecheck: {
      enabled: true,
    }
  },
})