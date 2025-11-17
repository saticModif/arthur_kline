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

  // 移除默认的Volume指标（如果存在）
  public removeDefaultVolume() {
    const chart = this.tvWidget.activeChart();
    if (!chart) return;

    try {
      // 获取图表上所有的指标
      const allStudies = chart.getAllStudies();
      if (!allStudies || allStudies.length === 0) return;

      // 查找默认的Volume指标并移除
      allStudies.forEach((study) => {
        const studyName = study.name || '';
        if (studyName === 'Volume' || studyName.toLowerCase() === 'volume') {
          const entityId = study.id;
          if (entityId) {
            console.log(`[tvchart] 移除默认Volume指标: ${entityId}`);
            chart.removeEntity(entityId);
          }
        }
      });
    } catch (e) {
      console.warn(`[tvchart] 移除默认Volume指标失败:`, e);
    }
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
            // 检查图表上是否已经存在该指标（可能是默认创建的）
            const existingEntityId = this._findExistingStudy(chart, indicator);
            if (existingEntityId) {
              // 如果已存在，关联到现有指标
              indicator.entityId = existingEntityId;
              indicator.isVisible = true;
              const study = chart.getStudyById(existingEntityId);
              study.setVisible(true);
              console.log(`[tvchart] 关联已存在的指标: ${indicator.name}`, existingEntityId);
            } else {
              // 添加指标并设为可见
              indicator.isVisible = true;
              this._addIndicator(chart, indicator);
            }
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

  // 隐藏overlay指标在Y轴上的价格标签
  private _hideIndicatorPriceLabels(study: any, indicator: Indicator) {
    if (!indicator.config.isOverlay) return;
    
    // 延迟应用设置，确保指标完全加载
    setTimeout(() => {
      try {
        const studyName = indicator.config.studyName;
        let overrides: Record<string, boolean> = {};
        
        // 根据指标类型设置不同的trackprice属性
        if (studyName === 'Bollinger Bands') {
          // Bollinger Bands有三个plot：upper、lower、median
          overrides = {
            'upper.trackprice': false,
            'lower.trackprice': false,
            'median.trackprice': false
          };
        } else {
          // 其他overlay指标（MA、EMA、SAR等）使用plot.trackprice
          overrides = {
            'plot.trackprice': false
          };
        }
        
        // 尝试应用设置
        study.applyOverrides(overrides);
        console.log(`[tvchart] 已隐藏指标 ${indicator.name} 在Y轴上的价格标签`, overrides);
        
        // 多次尝试应用，确保设置生效
        const retryApply = (retries: number) => {
          if (retries <= 0) return;
          setTimeout(() => {
            try {
              study.applyOverrides(overrides);
              console.log(`[tvchart] 重试应用指标 ${indicator.name} 价格标签隐藏设置 (剩余 ${retries - 1} 次)`);
              retryApply(retries - 1);
            } catch (e) {
              console.warn(`[tvchart] 重试应用失败:`, e);
            }
          }, 300);
        };
        
        // 重试3次
        retryApply(3);
      } catch (e) {
        console.warn(`[tvchart] 设置指标 ${indicator.name} 价格轴标签可见性失败:`, e);
      }
    }, 500); // 延迟500ms确保指标完全初始化
  }

  private _addIndicator(chart: IChartWidgetApi, indicator: Indicator) {
    if (indicator.entityId) return;

    chart.createStudy(
      indicator.config.studyName, 
      indicator.config.isOverlay, 
      true, 
      indicator.config.inputs, 
      undefined,
      indicator.config.options
    )
      .then((entityId) => {
        if (!entityId) return;
        const study = chart.getStudyById(entityId);
        study.setVisible(indicator.isVisible);
        indicator.entityId = entityId;
        console.log(`[tvchart] create indicator ${indicator.name} success`, indicator)
      })
      .catch((error) => {
        console.error(`[tvchart] create indicator ${indicator.name} failed:`, error);
      })
  }

  private _removeIndicator(chart: IChartWidgetApi, indicator: Indicator) {
    if (!indicator.entityId) return;

    chart.removeEntity(indicator.entityId)
    indicator.entityId = null;
  }

  // 查找图表上是否已存在指定的指标
  private _findExistingStudy(chart: IChartWidgetApi, indicator: Indicator): EntityId | null {
    try {
      const allStudies = chart.getAllStudies();
      if (!allStudies || allStudies.length === 0) return null;

      for (const study of allStudies) {
        const studyName = study.name || '';
        // 检查指标名称是否匹配
        if (studyName === indicator.config.studyName || studyName.toLowerCase() === indicator.config.studyName.toLowerCase()) {
          const entityId = study.id;
          if (entityId) {
            return entityId;
          }
        }
      }
    } catch (e) {
      console.warn(`[tvchart] 查找已存在指标失败:`, e);
    }
    return null;
  }

  private _emitVisibilityChange() {
    if (this.onVisibilityChange) {
      this.onVisibilityChange(this.getVisibility())
    }
  }
}