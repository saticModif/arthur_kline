import type {
  IChartingLibraryWidget,
  IChartWidgetApi,
  EntityId,
  StudyInputValue,
  CreateStudyOptions
} from 'charting_library';

// 指标配置类型
type IndicatorConfig = {
  studyName: string
  isOverlay: boolean // true = overlay on main chart, false = separate pane
  inputs?: Record<string, StudyInputValue>
  options?: CreateStudyOptions
}

type Indicator = {
  name: string
  isVisible: boolean
  config: IndicatorConfig
  entityId?: EntityId | null
}

// 初始指标配置列表
const DefaultIndicatorMap: Map<string, Indicator[]> = new Map([
  ['MA', [5, 10, 30, 60].map(len => ({
    name: `MA_${len}`, isVisible: false,
    config: { studyName: 'Moving Average', isOverlay: true, inputs: { in_0: len } }
  } as Indicator))],
  ['EMA', [5, 10, 30, 60].map(len => ({
    name: `EMA_${len}`, isVisible: false,
    config: { studyName: 'Moving Average Exponential', isOverlay: true, inputs: { in_0: len } }
  }))],
  ['BOLL', [{
    name: 'BOLL', isVisible: false,
    config: { studyName: 'Bollinger Bands', isOverlay: true, inputs: { in_0: 20, in_1: 2 } }
  }]],
  ['SAR', [{
    name: 'SAR', isVisible: false,
    config: { studyName: 'Parabolic SAR', isOverlay: true }
  }]],
  ['VOL', [{
    name: 'VOL', isVisible: false,
    config: { studyName: 'Volume', isOverlay: false }
  }]],
  ['MACD', [{
    name: 'MACD', isVisible: false,
    config: { studyName: 'MACD', isOverlay: false }
  }]],
  ['KDJ', [{
    name: 'KDJ', isVisible: false,
    config: { studyName: 'Stochastic', isOverlay: false }
  }]],
  ['SKDJ', [{
    name: 'SKDJ', isVisible: false,
    config: { studyName: 'Stochastic RSI', isOverlay: false }
  }]],
]);

export const SupportIndicators = () => [...DefaultIndicatorMap.keys()];

export class IndicatorManager {
  private tvWidget: IChartingLibraryWidget
  private indicatorMap: Map<string, Indicator[]> = DefaultIndicatorMap

  constructor(tvWidget: IChartingLibraryWidget) {
    this.tvWidget = tvWidget
  }

  // 指标可见性变化回调
  public onVisibilityChange?: (state: Record<string, boolean>) => void

  // 获取所有指标的显示状态
  public getVisibility(): Record<string, boolean> {
    const state: Record<string, boolean> = {}
    this.indicatorMap.forEach((indicators, key) => {
      state[key] = indicators.some(indicator => indicator.isVisible)
    })
    return state
  }

  // 添加全部Overlay指标
  public addAllOverlayIndicators() {
    const chart = this.tvWidget.activeChart();
    if (!chart) return;

    this.indicatorMap.forEach((indicators, key) => {
      indicators.forEach(indicator => {
        if (!indicator.config.isOverlay || indicator.entityId) return;
        this._addIndicator(chart, indicator)
      })
    })
  }

  // 切换指标显示/隐藏
  public toggleIndicator(indicatorName: string): boolean {
    const chart = this.tvWidget.activeChart();
    if (!chart) return false;

    // 每种指标统一都是数组保存
    const indicators = this.indicatorMap.get(indicatorName)
    if (!indicators || indicators.length === 0) {
      console.error(`[tvchart]<toggleIndicator> 未找到指标配置: ${indicatorName}`)
      return false
    }

    indicators.forEach(indicator => {
      try {
        if (indicator.config.isOverlay) {
          // overlay 指标：直接切换可见状态
          if (!indicator.entityId) return; // 没有 entityId 就跳过
          const study = chart.getStudyById(indicator.entityId);
          const newVisible = !indicator.isVisible;
          study.setVisible(newVisible);
          indicator.isVisible = newVisible;
        } else {
          // 非 overlay 指标：先判断 visable 与 entityId 状态
          if (!indicator.isVisible && !indicator.entityId) {
            // 添加指标并设为可见
            indicator.isVisible = true;
            this._addIndicator(chart, indicator);
          } else if (indicator.isVisible && indicator.entityId) {
            // 移除指标并设为隐藏
            indicator.isVisible = false;
            this._removeIndicator(chart, indicator);
          } else {
            // 不一致说明异步执行中，跳过
          }
        }
      } catch (e) {
        console.error(`[tvchart]<toggleIndicator> 未找到指标: ${indicatorName}`, e)
        return
      }
    })

    this._emitVisibilityChange()
    return true;
  }

  private _addIndicator(chart: IChartWidgetApi, indicator: Indicator) {
    if (indicator.entityId) return;

    chart.createStudy(indicator.config.studyName, indicator.config.isOverlay, true, indicator.config.inputs)
      .then((entityId) => {
        if (!entityId) return;
        const study = chart.getStudyById(entityId);
        study.setVisible(indicator.isVisible);
        indicator.entityId = entityId;
        console.log(`[tvchart] create indicator ${indicator.name} success`, indicator)
      })
  }

  private _removeIndicator(chart: IChartWidgetApi, indicator: Indicator) {
    if (!indicator.entityId) return;

    chart.removeEntity(indicator.entityId)
    indicator.entityId = null;
  }

  private _emitVisibilityChange() {
    if (this.onVisibilityChange) {
      this.onVisibilityChange(this.getVisibility())
    }
  }
}