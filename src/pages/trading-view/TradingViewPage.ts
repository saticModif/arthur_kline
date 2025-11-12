import { twMerge } from 'tailwind-merge'

import TVChartContainer from "./TVChartContainer";

export default function TradingViewPage(strId: string, priceScale?: number, className?: string): HTMLElement {
  const container = document.createElement('div')
  container.className = twMerge('w-full h-full bg-gray-900 text-white', className)

  const chartContainer = TVChartContainer(strId, priceScale)
  container.appendChild(chartContainer)

  return container
}
