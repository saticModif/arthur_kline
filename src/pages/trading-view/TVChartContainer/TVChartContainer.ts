import { twMerge } from 'tailwind-merge';

import { widget as TvWidget } from 'charting_library';
import type {
  IChartingLibraryWidget,
  ChartingLibraryWidgetOptions,
  MouseEventParams,
  ResolutionString
} from 'charting_library';

import { WidgetLightOptions } from './WidgetOptions';
import DataFeed from './DataFeed';
import { IndicatorManager } from './IndicatorManager';

export class TVChartContainer {
  private strId: string;
  private tvWidget!: IChartingLibraryWidget;
  private indicatorManager!: IndicatorManager;
  private datafeed!: DataFeed;
  private pricePrecision: number;
  private resolutionButtons: { resolution: string; element: HTMLElement; }[]  = [];

  constructor(parent: HTMLElement, options: { strId: string, pricePrecision?: number, className?: string }) {
    const { strId, className } = options
    // 显式处理 pricePrecision，确保正确传递
    const pricePrecision = options.pricePrecision !== undefined ? options.pricePrecision : 2
    console.log('[K线] TVChartContainer 接收到的 pricePrecision:', pricePrecision, 'options.pricePrecision:', options.pricePrecision)
    this.strId = strId;
    this.pricePrecision = pricePrecision;

    // 创建根容器
    const container = document.createElement('div');
    container.id = 'tv-chart-container'
    container.className = twMerge('w-full h-full', className);
    container.style.pointerEvents = 'auto';
    parent.appendChild(container)

    try {
      // 创建 TradingView widget 的容器
      const tvWidgetContainer = document.createElement('div');
      tvWidgetContainer.id = 'tv-widget-container'
      tvWidgetContainer.className = twMerge('w-full h-full');
      container.appendChild(tvWidgetContainer)

      // 创建 TradingView widget
      this.tvWidget = this._createTvWidget(tvWidgetContainer);

      // 创建指标管理器
      this.indicatorManager = new IndicatorManager(this.tvWidget);

      // 配置 tvWidget
      this._setupTvWidget();
    } catch (error) {
      console.error('Failed to load TradingView widget:', error);
      container.innerHTML =
        '<div class="flex items-center justify-center h-full text-white">Failed to load TradingView chart</div>';
    }
  }

  // 鼠标点击回调
  public onClick?: (param: { x: number, y: number, time?: number, data?: Record<string, any> }) => void

  // 获取指标管理器实例
  public getIndicatorManager(): IndicatorManager {
    return this.indicatorManager;
  }

  private _createTvWidget(parent: HTMLElement): IChartingLibraryWidget {
    const versionInfo = (window as any).TradingView?.version?.();
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 TradingView 图表库版本信息:');
    console.log('   Version:', versionInfo || '未知');
    console.log('═══════════════════════════════════════════════════════════');
    const library_path = `${import.meta.env.BASE_URL}js/charting_library/`;
    const resolutions = ['1', '5', '15', '60', '240', '1D', '1W', '1M'];
    this.datafeed = new DataFeed({ strId: this.strId, resolutions, pricePrecision: this.pricePrecision });
    const datafeed = this.datafeed;

    const widgetOptions: ChartingLibraryWidgetOptions = {
      ...WidgetLightOptions() as ChartingLibraryWidgetOptions,
      container: parent,
      datafeed,
      library_path,
      symbol: this.strId,
    };

    return new TvWidget(widgetOptions);
  }

  private _setupTvWidget() {
    this.tvWidget.headerReady().then(() => {
      this._createResolutionButtons();
    });

    this.tvWidget.onChartReady(() => {
      // 先移除默认的Volume指标（如果存在）
      this.indicatorManager.removeDefaultVolume();
      // 然后添加所有Overlay指标
      this._addAllOverlayIndicators();
      
      // 使用TradingView官方API隐藏指标价格标签
      try {
        // 通过applyOverrides应用全局设置
        this.tvWidget.applyOverrides({
          'scalesProperties.showStudyLastValue': false,
          'scalesProperties.showStudyPlotLabels': false,
        });
        console.log('[tvchart] ✅ 已使用TradingView官方API隐藏指标价格标签');
      } catch (e) {
        console.warn('[tvchart] 应用TradingView官方API失败:', e);
      }

      this.tvWidget.activeChart().onIntervalChanged().subscribe(null, (newResolution: ResolutionString) => {
        // 当分辨率改变时，同步更新按钮状态
        this._updateButtonActiveStates(newResolution as string);
        console.log('[tvchart] 分辨率已切换至:', newResolution);
      });
    });

    this.tvWidget.subscribe('mouse_up', (params: MouseEventParams) => {
      this._handleMouseUp(params);
    });
  }


  private _createResolutionButtons() {
    const widget = this.tvWidget;

    const buttonsData = [
      { resolution: "1", title: "1分钟", label: "1m" },
      { resolution: "5", title: "5分钟", label: "5m" },
      { resolution: "15", title: "15分钟", label: "15m" },
      { resolution: "60", title: "1小时", label: "1h" },
      { resolution: "240", title: "4小时", label: "4h" },
      { resolution: "1D", title: "1天", label: "1d" },
      { resolution: "1W", title: "1周", label: "1W" },
      { resolution: "1M", title: "1月", label: "1M" }
    ];

    this.resolutionButtons = [];

    // 创建按钮并绑定点击事件
    buttonsData.forEach(data => {
      const button = this.tvWidget.createButton();
      button.setAttribute('title', data.title);
      button.textContent = data.label;

      // 设置初始状态（默认15分钟为激活状态）
      if (data.resolution === "15") {
        this._updateButtonStyle(button, true);
      } else {
        this._updateButtonStyle(button, false);
      }

      // 添加点击事件
      button.addEventListener('click', () => {
        widget.activeChart().setResolution(data.resolution as ResolutionString);
        this._updateButtonActiveStates(data.resolution);
      });

      this.resolutionButtons.push({
        resolution: data.resolution,
        element: button
      });
    });
  }

  // 更新按钮样式
  private _updateButtonStyle(button: HTMLElement, isActive: boolean): void {
    if (isActive) {
      button.style.backgroundColor = 'transparent'; // 透明背景
      button.style.color = 'black'; // 黑色文字
      button.style.fontWeight = '600';
    } else {
      button.style.backgroundColor = 'transparent'; // 透明背景
      button.style.color = '#9ca3af'; // 灰色文字
      button.style.fontWeight = '600';
    }
    button.style.transition = 'all 0.2s ease-in-out';
    button.style.border = 'none'; // 去掉边框
    button.style.padding = '4px 8px';
  }

  // 更新所有按钮的激活状态
  private _updateButtonActiveStates(activeResolution: string): void {
    this.resolutionButtons.forEach(item => {
      const isActive = item.resolution === activeResolution;
      this._updateButtonStyle(item.element, isActive);
    });
  }

  private _addAllOverlayIndicators() {
    const widget = this.tvWidget;

    const studiesList = widget.getStudiesList()
    if (studiesList && studiesList.length > 0) {
      //console.log('[调试] 可用的指标列表:', studiesList.map((s: any) => s.name || s))
    }

    this.indicatorManager.addAllOverlayIndicators();
  }

  private _handleMouseUp(params: MouseEventParams) {
    const widget = this.tvWidget;
    const chart = widget.activeChart();
    if (!chart) return;

    const clientX = params.clientX;
    const clientY = params.clientY;
    const timeScale = chart.getTimeScale();
    const time = timeScale.coordinateToTime(clientX); // 秒级时间戳

    // 根据时间戳获取对应的K线数据
    let dataRecord: Record<string, any> | undefined;
    if (time) {
      const barData = this.datafeed.getBarByTime(time * 1000);
      if (barData) {
        dataRecord = {
          time: barData.time,
          open: barData.open,
          high: barData.high,
          low: barData.low,
          close: barData.close,
          volume: barData.volume
        };
      }
    }

    // 调用点击回调
    this._emitClick({
      x: clientX,
      y: clientY,
      time: time || undefined,
      data: dataRecord
    });
  }

  private _emitClick(param: { x: number, y: number, time?: number, data?: Record<string, any> }) {
    if (this.onClick) {
      this.onClick(param);
    }
  }
}
