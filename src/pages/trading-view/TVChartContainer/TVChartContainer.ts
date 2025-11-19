import { twMerge } from 'tailwind-merge';

import { widget as TvWidget } from 'charting_library';
import type {
  IChartingLibraryWidget,
  ChartingLibraryWidgetOptions,
  CrossHairMovedEventParams,
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
  private widgetContainer!: HTMLElement;

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
      this.widgetContainer = tvWidgetContainer;

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
  // 十字星滑动回调
  public onCrosshairMove?: (param: { x: number, y: number, time?: number, data?: Record<string, any> }) => void;

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
      // 先移除默认的Volume指标（如果存在），使用重试机制确保完全移除
      this.indicatorManager.removeDefaultVolumeWithRetry(3, 500);
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

      const chart = this.tvWidget.activeChart();
      chart.onIntervalChanged().subscribe(null, (newResolution: ResolutionString) => {
        // 当分辨率改变时，同步更新按钮状态
        this._updateButtonActiveStates(newResolution as string);
        console.log('[tvchart] 分辨率已切换至:', newResolution);
      });

      chart.crossHairMoved().subscribe(null, (params) => {
        this._handleCrosshairMove(params);
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
    const coordinateTime = timeScale.coordinateToTime(clientX);
    const timestampMs = this._normalizeTimeToMs(coordinateTime);

    let dataRecord: Record<string, any> | undefined;
    if (timestampMs !== null) {
      const barData = this.datafeed.getBarByTime(timestampMs);
      const latestBar = this.datafeed.getLatestBar();
      if (barData) {
        const referencePrice = latestBar?.close;
        const priceDiff = referencePrice !== undefined ? barData.close - referencePrice : undefined;
        const priceDiffPercent = referencePrice
          ? (priceDiff! / referencePrice) * 100
          : undefined;

        dataRecord = {
          time: barData.time,
          open: barData.open,
          high: barData.high,
          low: barData.low,
          close: barData.close,
          volume: barData.volume,
          referencePrice,
          priceDiff,
          priceDiffPercent,
          crossPrice: barData.close
        };
      }
    }

    // 调用点击回调
    this._emitClick({
      x: clientX,
      y: clientY,
      time: timestampMs !== null ? timestampMs : undefined,
      data: dataRecord
    });
  }

  private _handleCrosshairMove(params?: CrossHairMovedEventParams) {
    if (!params) {
      this._emitCrosshairMove({ x: 0, y: 0, data: undefined });
      return;
    }

    const { x: clientX, y: clientY } = this._getClientCoordinates(params);
    const timestampMs = this._normalizeTimeToMs(params.time);
    if (timestampMs === null) {
      this._emitCrosshairMove({ x: clientX, y: clientY, data: undefined });
      return;
    }

    const barData = this.datafeed.getBarByTime(timestampMs);
    const latestBar = this.datafeed.getLatestBar();
    if (!barData) {
      this._emitCrosshairMove({ x: clientX, y: clientY, data: undefined });
      return;
    }

    const referencePrice = latestBar?.close;
    const priceDiff = referencePrice !== undefined ? barData.close - referencePrice : undefined;
    const priceDiffPercent = referencePrice
      ? (priceDiff! / referencePrice) * 100
      : undefined;

    this._emitCrosshairMove({
      x: clientX,
      y: clientY,
      time: timestampMs,
      data: {
        time: barData.time,
        open: barData.open,
        high: barData.high,
        low: barData.low,
        close: barData.close,
        volume: barData.volume,
        referencePrice,
        priceDiff,
        priceDiffPercent,
        crossPrice: typeof params.price === 'number' ? params.price : barData.close
      }
    });
  }

  private _normalizeTimeToMs(time?: number | string | { year: number; month: number; day: number } | null): number | null {
    if (time === undefined || time === null) return null;

    if (typeof time === 'number') {
      return time > 1e12 ? Math.round(time) : Math.round(time * 1000);
    }

    if (typeof time === 'string') {
      const parsed = Number(time);
      if (!Number.isNaN(parsed)) {
        return parsed > 1e12 ? Math.round(parsed) : Math.round(parsed * 1000);
      }
      const date = new Date(time);
      return Number.isNaN(date.valueOf()) ? null : date.getTime();
    }

    const date = new Date(Date.UTC(time.year, time.month - 1, time.day));
    return date.getTime();
  }

  private _getClientCoordinates(params: CrossHairMovedEventParams): { x: number, y: number } {
    if (!this.widgetContainer) {
      return {
        x: params.offsetX ?? 0,
        y: params.offsetY ?? 0,
      };
    }

    const rect = this.widgetContainer.getBoundingClientRect();
    return {
      x: rect.left + (params.offsetX ?? 0),
      y: rect.top + (params.offsetY ?? 0),
    };
  }

  private _emitClick(param: { x: number, y: number, time?: number, data?: Record<string, any> }) {
    if (this.onClick) {
      this.onClick(param);
    }
  }

  private _emitCrosshairMove(param: { x: number, y: number, time?: number, data?: Record<string, any> }) {
    if (this.onCrosshairMove) {
      this.onCrosshairMove(param);
    }
  }
}
