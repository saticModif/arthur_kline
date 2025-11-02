import { twMerge } from 'tailwind-merge'

import TVChartContainer from "./TVChartContainer";

export default function TradingViewPage(path: string, className?: string): HTMLElement {
  const symbol = path.replace(/-/g, '/');
  const container = document.createElement('div')
  container.className = twMerge('w-full h-full bg-gray-900 text-white', className)

  const chartContainer = TVChartContainer(symbol)
  container.appendChild(chartContainer)

  return container
}
