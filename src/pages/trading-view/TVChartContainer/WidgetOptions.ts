import type { ChartingLibraryWidgetOptions, ResolutionString, LanguageCode } from "charting_library"

export function WidgetLightOptions(): Partial<ChartingLibraryWidgetOptions> {
  return {
    // library_path: , // TradingView库文件所在路径，例如 "/js/charting_library/"
    // datafeed: , // 数据源对象，提供K线、交易量等数据
    // symbol: , // 要显示的交易对（例如 "BTC/USDT"）
    debug: false, // 是否启用调试模式（打印日志）
    locale: "zh" as LanguageCode, // 语言区域设置
    timezone: "Asia/Shanghai", // 时区设置
    interval: "15" as ResolutionString, // 初始时间周期（单位：分钟），15分钟
    autosize: true, // 是否自动调整图表大小以适应容器
    fullscreen: false, // 是否启用全屏显示

    // 启用的功能项（数组）
    enabled_features: [],

    // 禁用的功能项（数组），可以隐藏某些UI组件
    disabled_features: [
      "use_localstorage_for_settings", // 使用浏览器localStorage保存设置
      "context_menus", // 全局右键菜单
      // "main_series_scale_menu", // 主图Y轴右键菜单
      "header_settings", // 去掉图表设置按钮
      "header_indicators", // 去掉指标按钮
      "header_fullscreen_button", // 全屏按钮
      "header_resolutions", // 时间周期切换下拉菜单
      // "custom_resolutions", // 自定义时间周期
      "header_symbol_search", // 搜索交易对按钮
      "header_chart_type", // 切换图表类型按钮
      "header_symbol_search", // 搜索交易对按钮
      "header_undo_redo", // 撤销/重做按钮
      "header_screenshot", // 截图按钮
      "header_saveload", // 保存/加载布局按钮
      "header_compare", // 顶部“比较”按钮
      "timeframes_toolbar", // K线周期切换工具栏
      "left_toolbar", // 显示左侧工具栏（无用）大屏显示，小屏不显示
      "legend_widget", // 左上角指标图例
      // "display_market_status",
      // "display_legend_on_all_charts",
      // "edit_buttons_in_legend",
    ],

    // 图表样式覆盖（自定义主题和颜色）
    overrides: {},

    // 指标样式覆盖（主要针对成交量颜色，并隐藏所有指标图例）
    studies_overrides: {},

    // // 自定义时间周期菜单（供自定义UI使用）
    // time_frames: [
    //   { text: "1m", resolution: "1" as ResolutionString, description: "1分" },
    //   { text: "5m", resolution: "5" as ResolutionString, description: "5分" },
    //   { text: "15m", resolution: "15" as ResolutionString, description: "15分" },
    //   { text: "1h", resolution: "60" as ResolutionString, description: "1时" },
    //   { text: "4h", resolution: "240" as ResolutionString, description: "4时" },
    //   { text: "1d", resolution: "1D" as ResolutionString, description: "1天" },
    //   { text: "1W", resolution: "1W" as ResolutionString, description: "1周" },
    //   { text: "1M", resolution: "1M" as ResolutionString, description: "1月" },
    // ],
  };
}
