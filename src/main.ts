import './index.css'
import TradingViewPage from './pages/trading-view/TradingViewPage'

// 创建 main 节点作为容器
const mainElement = document.createElement('main')
mainElement.className = 'w-full h-screen overflow-hidden'
document.body.appendChild(mainElement)

const urlParams = new URLSearchParams(window.location.search);
const strId = urlParams.get('strId') || 'btc-usdt-spot' // 'btc-usdt-perpetual'

// 创建 TradingViewPage 并添加到 main 节点
const tradingViewPage = TradingViewPage(strId)
mainElement.appendChild(tradingViewPage)

