import './index.css'
import TradingViewPage from './pages/trading-view/TradingViewPage'

const urlParams = new URLSearchParams(window.location.search);
const strId = urlParams.get('strId') || 'btc-usdt-spot' // 'btc-usdt-perpetual'
const showIndicatorBar = urlParams.get('showIndicatorBar') !== 'false' // 默认为 true，只有当参数为 'false' 时才为 false
const pricePrecision = parseInt(urlParams.get('pricePrecision') || '2', 10) // 默认精度为 2
console.log('[html] strId:', strId)
console.log('[html] showIndicatorBar:', showIndicatorBar)
console.log('[html] pricePrecision:', pricePrecision)

// 创建 main 节点作为容器
const mainElement = document.createElement('main')
mainElement.className = 'w-full h-screen overflow-hidden'
document.body.appendChild(mainElement)

// 创建 TradingViewPage 并挂载到main 节点
TradingViewPage(mainElement, { strId, showIndicatorBar, pricePrecision })
