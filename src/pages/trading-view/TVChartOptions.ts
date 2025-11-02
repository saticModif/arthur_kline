export function TradingViewOptions() {
  const options = {
    library_path: "", // TradingView库文件所在路径，例如 "/js/charting_library/"
    container_id: "", // 容器元素的ID，用于挂载图表
    symbol: "", // 要显示的交易对（例如 "BTC/USDT"）
    datafeed: {}, // 数据源对象，提供K线、交易量等数据
    locale: "zh", // 语言区域设置
    timezone: "Asia/Shanghai", // 时区设置

    // fullscreen: false, // 是否启用全屏显示（没用）
    autosize: true, // 是否自动调整图表大小以适应容器
    interval: "5", // 默认时间周期（单位：分钟），例如 1、5、15、60、1D
    toolbar_bg: "#18202a", // 工具栏背景颜色
    debug: false, // 是否启用调试模式（打印日志）

    // 禁用的功能项（数组），可以隐藏某些UI组件
    // hide_left_toolbar_by_default: true,
    disabled_features: [
      "header_settings",               // 去掉图表设置按钮
      "header_indicators",             // 去掉指标按钮
      "header_fullscreen_button",
      "header_resolutions",
      "header_symbol_search",          // 搜索交易对按钮
      "header_chart_type",
      "header_symbol_search",          // 搜索交易对按钮
      "header_undo_redo",              // 撤销/重做按钮
      "header_screenshot",             // 截图按钮
      "header_saveload",               // 保存/加载布局按钮
      "header_compare",                // 顶部“比较”按钮
      "timeframes_toolbar",            // K线周期切换工具栏
      //"use_localstorage_for_settings",
      "left_toolbar",                   // 显示左侧工具栏（无用）大屏显示，小屏不显示
      // "volume_force_overlay",          // 禁用成交量覆盖在主图上
      "widget_logo",
      "compare_symbol",                // 禁用对比其他交易对
      "header_toolbar",                // 顶部工具栏按钮
      "display_market_status",         // 隐藏市场状态（开盘/收盘）
      "go_to_date",                    // 隐藏跳转到指定日期功能
      "header_interval_dialog_button",
      "legend_context_menu",
      "show_hide_button_in_legend",    // 隐藏图例的显示/隐藏按钮
      "show_interval_dialog_on_key_press", // 按键切换周期时弹出对话框
      "snapshot_trading_drawings",
      "symbol_info",                   // 隐藏顶部交易对信息栏
      //"header_widget",
      "edit_buttons_in_legend",
      "context_menus",                 // 全局右键菜单
      "control_bar",                   // 隐藏右上角控制栏
      "border_around_the_chart",       // 去掉图表外边框
      "right_bar_stays_on_scroll",     // 右侧工具栏滚动时保持可见
      "pane_context_menu",             // 图表窗格右键菜单
      // "drawing_toolbar",               // 左侧绘图工具栏（无用）
      // "header_in_fullscreen_mode",     // 全屏模式下隐藏顶部栏
      "use_localstorage_for_settings"
    ],

    // 启用的功能项（数组）
    enabled_features: [
      "disable_resolution_rebuild",
      // "keep_left_toolbar_visible_on_small_screens", //防止左侧工具栏在小屏幕上消失
      "hide_last_na_study_output",
      "move_logo_to_main_pane",
      "dont_show_boolean_study_arguments",// 隐藏布尔型指标参数
      // "use_localstorage_for_settings",// 使用浏览器localStorage保存设置
      "remove_library_container_border",
      "save_chart_properties_to_local_storage",
      "side_toolbar_in_fullscreen_mode",
      "constraint_dialogs_movement",
      "hide_left_toolbar_by_default", // 不生效
      "left_toolbar",
      "same_data_requery",
      "header_in_fullscreen_mode",
      "show_right_widgets_panel_by_default",
    ],

    // 自定义CSS（用于强制隐藏特定元素）
    custom_css_url: "bundles/common.css",
    // "data:text/css," +
    // encodeURIComponent(`
    //         .chart-toolbar,
    //         .pane-legend,
    //         .tradingview-widget-container__widget {
    //           display: none !important;
    //         }
    //       `),

    supported_resolutions: ["1", "5", "15", "30", "60", "1D", "1W", "1M"], // 支持的K线周期列表
    charts_storage_url: "http://saveload.tradingview.com", // 图表保存/加载的远程存储URL
    charts_storage_api_version: "1.1", // 图表存储API版本
    client_id: "tradingview.com", // 客户端ID（用于区分不同应用）
    user_id: "public_user_id", // 用户ID（用于保存个性化设置）

    // 图表样式覆盖（自定义主题和颜色）
    overrides: {
      "volumePaneSize": "small", // 成交量图表高度比例

      // 面板配置
      "paneProperties.background": "#1B1E2E", // 图表背景色
      "paneProperties.vertGridProperties.color": "rgba(0,0,0,.1)", // 纵向网格线颜色
      "paneProperties.horzGridProperties.color": "rgba(0,0,0,.1)", // 横向网格线颜色

      // 坐标轴配置
      "scalesProperties.lineColor": "#00000000", // 坐标轴线条颜色
      "scalesProperties.textColor": "#000000", // 坐标轴文字颜色
      "scalesProperties.fontSize": 8, // 坐标轴文字大小，单位 px

      // 主图配置
      "mainSeriesProperties.candleStyle.upColor": "#12b886", // 阳线颜色（上涨K线）
      "mainSeriesProperties.candleStyle.downColor": "#fa5252", // 阴线颜色（下跌K线）
      "mainSeriesProperties.candleStyle.drawBorder": false, // 是否绘制K线边框
      "mainSeriesProperties.candleStyle.borderColor": "rgba(0,0,0,0)",
      "mainSeriesProperties.candleStyle.borderUpColor": "rgba(0,0,0,0)",
      "mainSeriesProperties.candleStyle.borderDownColor": "rgba(0,0,0,0)",
      "mainSeriesProperties.candleStyle.wickUpColor": "#12b886", // 上影线颜色
      "mainSeriesProperties.candleStyle.wickDownColor": "#fa5252", // 下影线颜色
      "mainSeriesProperties.areaStyle.color1": "rgba(71, 78, 112, 0.5)", // 区域图渐变上层颜色
      "mainSeriesProperties.areaStyle.color2": "rgba(71, 78, 112, 0.5)", // 区域图渐变下层颜色
      "mainSeriesProperties.areaStyle.linecolor": "#9194a4", // 区域图线条颜色
    },

    // 指标样式覆盖（主要针对成交量颜色）
    studies_overrides: {
      "volume.volume.color.0": "#fa5252", // 下跌成交量柱颜色
      "volume.volume.color.1": "#12b886", // 上涨成交量柱颜色
      "volume.volume.transparency": 50,   // 成交量柱透明度
    },

    // 自定义时间周期菜单（供自定义UI使用）
    time_frames: [
      { text: "1min", resolution: "1", description: "realtime" }, // 实时
      { text: "1min", resolution: "1", description: "1min" },     // 1分钟
      { text: "5min", resolution: "5", description: "5min" },     // 5分钟
      { text: "15min", resolution: "15", description: "15min" },  // 15分钟
      { text: "30min", resolution: "30", description: "30min" },  // 30分钟
      { text: "1hour", resolution: "60", description: "1hour" },  // 1小时
      { text: "1day", resolution: "1D", description: "1day" },    // 1天
      { text: "1week", resolution: "1W", description: "1week" },  // 1周
      { text: "1mon", resolution: "1M", description: "1mon" },    // 1月
    ],
  };

  options.toolbar_bg = "#fff";
  options.custom_css_url = "bundles/common_day.css";
  options.overrides["paneProperties.background"] = "#fff";
  options.overrides["mainSeriesProperties.candleStyle.upColor"] =
    "#03C59E";
  options.overrides["mainSeriesProperties.candleStyle.downColor"] =
    "#F14A3E";

  return options;
}
