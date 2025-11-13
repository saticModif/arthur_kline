import { twMerge } from 'tailwind-merge'

import TVChartContainer from "./TVChartContainer";

export default function TradingViewPage(strId: string, priceScale?: number, className?: string, showIndicatorBar: boolean = true): HTMLElement {
  const container = document.createElement('div')
  container.className = twMerge('w-full h-full bg-gray-900 text-white', className)

  const chartContainer = TVChartContainer(strId, priceScale, undefined, showIndicatorBar)
  container.appendChild(chartContainer)

  return container
}
