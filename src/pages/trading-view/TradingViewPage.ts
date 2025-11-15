import { twMerge } from 'tailwind-merge'

import { TVChartContainer } from "./TVChartContainer";
import ChartOverlay from "./ChartOverlay";
import IndicatorBar from "./IndicatorBar";

export default function TradingViewPage(parent: HTMLElement, options: { strId: string, className?: string }): HTMLElement {
  const { strId, className } = options
  const page = document.createElement('div')
  page.id = 'trading-view-page'
  // page.className = twMerge('w-full h-full bg-gray-900 text-white relative', className)
  page.className = twMerge('w-full h-full bg-gray-900 text-white relative flex flex-col', className)
  parent.appendChild(page)

  // 创建图表区域容器，包含tvChartContainer和chartOverlay
  const chartArea = document.createElement('div')
  chartArea.className = 'flex-1 relative w-full'
  page.appendChild(chartArea)

  // 图表容器
  const tvChartContainer = new TVChartContainer(chartArea, { strId, className: 'w-full h-full' })
  const indicatorManager = tvChartContainer.getIndicatorManager()

  // 覆盖层，现在添加到chartArea中，与tvChartContainer同级别
  const chartOverlay = new ChartOverlay(chartArea, { className: 'absolute inset-0 pointer-events-none z-10' })

  // 指标栏
  const indicatorBar = new IndicatorBar(page, { className: 'w-full h-9' })

  // 数据同步
  // indicatorManager -> indicatorBar
  indicatorBar.setIndicatorActive(indicatorManager.getVisibility());
  indicatorManager.onVisibilityChange = (state) => indicatorBar.setIndicatorActive(state)

  // indicatorBar -> indicatorManager
  indicatorBar.onClick = (indicatorName) => indicatorManager.toggleIndicator(indicatorName)

  // tvChartContainer -> chartOverlay
  tvChartContainer.onClick = (data) =>  chartOverlay.handleClick(data)

  return page
}
