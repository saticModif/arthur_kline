import './index.css'
import TradingViewPage from './pages/trading-view/TradingViewPage'

const urlParams = new URLSearchParams(window.location.search);
const strId = urlParams.get('strId') || 'btc-usdt-spot' // 'btc-usdt-perpetual'
console.log('[html] strId:', strId)

// 创建 main 节点作为容器
const mainElement = document.createElement('main')
mainElement.className = 'w-full h-screen overflow-hidden'
document.body.appendChild(mainElement)

// 创建 TradingViewPage 并挂载到main 节点
TradingViewPage(mainElement, { strId })
