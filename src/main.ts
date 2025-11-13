import './index.css'
import TradingViewPage from './pages/trading-view/TradingViewPage'

// 创建 main 节点作为容器
const mainElement = document.createElement('main')
mainElement.className = 'w-full h-screen overflow-hidden'
document.body.appendChild(mainElement)

const urlParams = new URLSearchParams(window.location.search);
const strId = urlParams.get('strId') || 'btc-usdt-spot' // 'btc-usdt-perpetual'
// 从URL参数获取价格精度，默认为2（支持2位小数）
// 例如：?strId=btc-usdt-spot&priceScale=3 表示支持3位小数（如0.003）
const priceScale = parseInt(urlParams.get('priceScale') || '2', 10)
// 从URL参数获取是否显示底部指标栏，默认为true（显示）
// 例如：?strId=btc-usdt-spot&showIndicatorBar=false 表示隐藏底部指标栏
const showIndicatorBar = urlParams.get('showIndicatorBar') !== 'false'

// 创建 TradingViewPage 并添加到 main 节点
const tradingViewPage = TradingViewPage(strId, priceScale, undefined, showIndicatorBar)
mainElement.appendChild(tradingViewPage)

