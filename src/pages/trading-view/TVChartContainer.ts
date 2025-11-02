import { twMerge } from 'tailwind-merge'

// import MqttService from "@/services/MqttService"
// import DataFeedMqtt from "./DataFeedMqtt"

import {apiService} from '@/services/ApiService'
import { loadChartingLibrary } from "./TVChartLibrary"
import { TradingViewOptions } from "./TVChartOptions"
import DataFeedWs from "./DataFeedWs"

export default function TVChartContainer(symbol: string, className?: string): HTMLElement {
  const container = document.createElement('div')
  container.id = 'trading-view-container'
  container.className = twMerge('w-full h-full', className)


  try {
    loadTradingView(container, symbol)
  } catch (error) {
    console.error('Failed to initialize TradingView:', error)
    container.innerHTML = '<div class="flex items-center justify-center h-full text-white">Failed to load TradingView chart</div>'
  }
  // 异步初始化 TradingView
  return container
}

async function loadTradingView(container: HTMLElement, symbol: string = "BTC/USDT") {
  const library_path = `${import.meta.env.BASE_URL}js/charting_library/`

  // 加载 Charting Library
  await loadChartingLibrary(library_path);
  console.log("TradingView version:", (window as any).TradingView.version());

  // 建立 MQTT DataFeed
  // const mqttClient = await MqttService.connect("ws://47.83.128.60:8083/mqtt");
  // const mqttClient = await MqttService.connect("ws://137.220.152.111:8083/mqtt");
  // const datafeed = new DataFeedMqtt("http://api.arthur.top/swap", { symbol: symbol }, mqttClient, 2);
  // const datafeed = new DataFeedMqtt("http://137.220.152.111", { symbol: symbol }, mqttClient, 2);

  // 建立 Websocket DataFeed
  const api = apiService.arthurApi;
  const datafeed = new DataFeedWs(api, symbol, 'spot');


  const options = TradingViewOptions()
  options.library_path = library_path
  options.container_id = container.id
  options.symbol = symbol
  options.datafeed = datafeed

  // 创建 TradingView widget

  const widget = new window.TradingView.widget(options)

  widget.onChartReady(() => {
    const chart = widget.chart()
    chart.executeActionById("undo")  // "undo" 撤销上一步 "redo" 重做
    // chart.executeActionById("legend_expand")

    addIndicators(widget) // 添加指标线
    addButtons(widget)  // 添加按钮
  })
}

const addIndicators = (widget: any) => {
  const chart = widget.chart()

  // MA 移动平均线
  chart.createStudy("Moving Average", false, false, [5], null, { "plot.color": "#EDEDED", })
  chart.createStudy("Moving Average", false, false, [10], null, { "plot.color": "#ffe000", })
  chart.createStudy("Moving Average", false, false, [30], null, { "plot.color": "#ce00ff", })
  chart.createStudy("Moving Average", false, false, [60], null, { "plot.color": "#00adff", })

  // BB 布林带
  chart.createStudy("Bollinger Bands", false, false, [60], null, { "plot.color": "#FFF9EF", "plot.fillColor": "#FFF9EF" })
}

const addButtons = (widget: any) => {
  const resolutions = ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"];

  const buttonsData = [
    { resolution: resolutions[0], title: "1秒", label: "1s" },
    { resolution: resolutions[1], title: "5秒", label: "5s" },
    { resolution: resolutions[2], title: "15秒", label: "15s" },
    { resolution: resolutions[3], title: "30秒", label: "30s" },
    { resolution: resolutions[4], title: "1分钟", label: "1m" },
    { resolution: resolutions[5], title: "4分钟", label: "4m" },
    { resolution: resolutions[6], title: "1天", label: "1D" },
    { resolution: resolutions[7], title: "1周", label: "1W" },
    { resolution: resolutions[8], title: "1月", label: "1M" }
  ];

  // 创建按钮并绑定点击事件
  buttonsData.forEach(data => {
    const button = widget.createButton().attr("title", data.title).append(`<span>${data.label}</span>`);

    button.on("click", () => {
      widget.chart().setChartType(1); // 假设1是您想要设置的图表类型
      widget.setSymbol("", data.resolution);
    });
  });
}
