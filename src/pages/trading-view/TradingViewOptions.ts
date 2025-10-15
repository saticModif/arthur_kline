interface TradingViewOptionsProps {
  containerId: string;  // 父容器id
  datafeed: any; // You might want to replace 'any' with a more specific type
  symbol: string; // 默认交易对 BTC/USTD
  libraryPath?: string; // 图表库路径
}

export default function TradingViewOptions({
  containerId,
  datafeed,
  symbol,
  libraryPath = `${import.meta.env.BASE_URL}js/charting_library/` }: TradingViewOptionsProps) {

  return {
    // container_id: containerId,
    datafeed: datafeed,
    symbol: symbol,
    library_path: libraryPath,
    fullscreen: false,
    autosize: true,
    interval: "5", // 默认K线周期
    toolbar_bg: "#18202a",
    debug: false,
    // drawings_access: {
    //   type: "black",
    //   tools: [{ name: "Regression Trend" }],
    // },
    disabled_features: [
      // "header_widget",                 // 顶部工具栏
      "header_toolbar",                // 顶部工具栏按钮
      // "left_toolbar",                  // 左侧工具栏
      "right_bar_stays_on_scroll",     // 右侧工具栏
      "timeframes_toolbar",            // K线周期切换
      "header_compare",                // 比较按钮
      "header_screenshot",             // 截图按钮
      "header_saveload",               // 保存/加载
      "header_symbol_search",          // 搜索
      "header_undo_redo",              // 撤销/重做
      "pane_context_menu",             // 窗格右键菜单
      "context_menus",                 // 全局右键菜单
      "drawing_toolbar",               // 绘图工具栏
      "show_interval_dialog_on_key_press",
      "symbol_info",
      "show_hide_button_in_legend",
      "header_in_fullscreen_mode",
      "display_market_status",
      "go_to_date",
      "compare_symbol",
      "volume_force_overlay",
      "control_bar",
      "border_around_the_chart",
    ],
    enabled_features: [
      "dont_show_boolean_study_arguments",
      "use_localstorage_for_settings",
    ],
    // custom_css_url: "bundles/common.css",
    // 自定义 CSS 强制隐藏
    custom_css_url: "data:text/css," + encodeURIComponent(`
            .chart-toolbar, 
            .pane-legend, 
            .tradingview-widget-container__widget {
              display: none !important;
            }
          `),
    supported_resolutions: ["1", "5", "15", "30", "60", "1D", "1W", "1M"],
    charts_storage_url: "http://saveload.tradingview.com",
    charts_storage_api_version: "1.1",
    client_id: "tradingview.com",
    user_id: "public_user_id",
    // 图例隐藏
    // overrides: {
    //   "paneProperties.legendProperties.showLegend": false,
    // },
    overrides: {
      "paneProperties.background": "#1B1E2E",
      "paneProperties.vertGridProperties.color": "rgba(0,0,0,.1)",
      "paneProperties.horzGridProperties.color": "rgba(0,0,0,.1)",
      "scalesProperties.textColor": "#AAA",
      "scalesProperties.rightAxisProperties.offset": -100,
      "mainSeriesProperties.candleStyle.upColor": "#12b886",
      "mainSeriesProperties.candleStyle.downColor": "#fa5252",
      "mainSeriesProperties.candleStyle.drawBorder": false,
      // "mainSeriesProperties.candleStyle.wickUpColor": "#589065",
      // "mainSeriesProperties.candleStyle.wickDownColor": "#AE4E54",
      "mainSeriesProperties.candleStyle.wickUpColor": "#12b886",
      "mainSeriesProperties.candleStyle.wickDownColor": "#fa5252",
      "paneProperties.legendProperties.showLegend": false,

      "mainSeriesProperties.areaStyle.color1": "rgba(71, 78, 112, 0.5)",
      "mainSeriesProperties.areaStyle.color2": "rgba(71, 78, 112, 0.5)",
      "mainSeriesProperties.areaStyle.linecolor": "#9194a4",
      "volumePaneSize": "small",
    },
    //成交量样式
    studies_overrides: {
      "volume.volume.color.0": "#fa5252",
      "volume.volume.color.1": "#12b886",
      "volume.volume.transparency": 25,
    },
    time_frames: [
      { text: "1min", resolution: "1", description: "realtime" },
      { text: "1min", resolution: "1", description: "1min" },
      { text: "5min", resolution: "5", description: "5min" },
      { text: "15min", resolution: "15", description: "15min" },
      { text: "30min", resolution: "30", description: "30min" },
      { text: "1hour", resolution: "60", description: "1hour" },
      { text: "1day", resolution: "1D", description: "1day" },
      { text: "1week", resolution: "1W", description: "1week" },
      { text: "1mon", resolution: "1M", description: "1mon" },
    ],
  }
}