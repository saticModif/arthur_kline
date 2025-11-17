# 浏览器自动化测试说明

## 安装依赖

首先安装浏览器测试所需的依赖：

```bash
npm install --save-dev @playwright/test @vitest/browser @vitest/ui playwright
```

安装 Playwright 浏览器：

```bash
npx playwright install chromium
```

## 运行测试

### 方法1：使用 Playwright（推荐）

#### 1. 启动开发服务器

在一个终端中启动开发服务器：

```bash
npm run dev
```

#### 2. 运行端到端测试

在另一个终端中运行测试：

```bash
# 运行所有E2E测试
npm run test:e2e

# 使用UI模式运行测试（可视化，推荐）
npm run test:e2e:ui
```

### 方法2：使用 Vitest Browser

```bash
# 运行所有浏览器测试
npm run test:browser

# 使用UI模式运行测试（可视化）
npm run test:browser:ui
```

## 测试内容

### indicator-price-labels.e2e.test.ts

这个测试验证：
1. ✅ Bollinger Bands 指标的价格标签是否被正确隐藏
2. ✅ TradingView 官方 API 是否已正确应用（`scalesProperties.showStudyLastValue` 和 `scalesProperties.showStudyPlotLabels`）

### 测试流程

1. 打开测试页面（`/?strId=btc-usdt-spot&showIndicatorBar=true`）
2. 等待图表加载完成
3. 点击 BOLL 指标按钮（如果存在）
4. 等待价格标签隐藏逻辑执行
5. 检查所有长小数位的价格标签是否被隐藏
6. 验证 TradingView 官方 API 应用日志

## 测试结果

测试会输出详细的日志信息：
- 📊 价格标签检查结果
- ✅ 成功信息
- ❌ 失败信息（包含未隐藏的标签详情）

## 注意事项

- 确保开发服务器在 `http://localhost:5173` 运行
- 测试需要等待图表和指标完全加载（可能需要几秒钟）
- 如果测试失败，检查控制台日志获取更多信息
- 测试会自动截图和录制视频（仅在失败时）

## 调试技巧

1. **查看测试报告**：运行 `npm run test:e2e:ui` 可以可视化查看测试过程和结果
2. **检查截图**：测试失败时会在 `test-results/` 目录生成截图
3. **查看视频**：失败时会录制视频，方便调试
4. **查看追踪**：可以查看详细的执行追踪信息
