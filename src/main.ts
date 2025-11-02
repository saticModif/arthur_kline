import './index.css'
import TradingViewPage from './pages/trading-view/TradingViewPage'

// 创建 main 节点作为容器
const mainElement = document.createElement('main')
mainElement.className = 'w-full h-screen overflow-hidden'
document.body.appendChild(mainElement)

// 从 URL 参数获取 symbol
// const urlParams = new URLSearchParams(window.location.search);
// const symbol = urlParams.get('symbol') || 'BTC/USDT';

const url = new URL(window.location.href);
const pathname = url.pathname.split('/').filter(Boolean).pop(); 
const subpath = pathname || 'BTC-USDT';

// 创建 TradingViewPage 并添加到 main 节点
const tradingViewPage = TradingViewPage(subpath)
mainElement.appendChild(tradingViewPage)

