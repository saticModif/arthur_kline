import { twMerge } from 'tailwind-merge'

// import MqttService from "@/services/MqttService"
// import DataFeedMqtt from "./DataFeedMqtt"

import {apiService} from '@/services/ApiService'
import { loadChartingLibrary } from "./TVChartLibrary"
import { TradingViewOptions } from "./TVChartOptions"
import DataFeedWs from "./DataFeedWs"

// 指标配置类型
interface IndicatorConfig {
  name: string
  displayName: string
  studyName: string
  isOverlay: boolean // true=主图，false=副图
  inputs?: any[]
  options?: any
}

// 指标配置列表
// 注意：根据调试输出，TradingView v1.11 支持的指标名称
const INDICATOR_CONFIGS: IndicatorConfig[] = [
  // 主图指标（叠加在K线上）
  { name: 'MA', displayName: 'MA', studyName: 'Moving Average', isOverlay: true, inputs: [5, 10, 30, 60] },
  { name: 'EMA', displayName: 'EMA', studyName: 'Moving Average Exponential', isOverlay: true, inputs: [5, 10, 30, 60] }, // 根据调试列表，正确名称是 'Moving Average Exponential'
  { name: 'BOLL', displayName: 'BOLL', studyName: 'Bollinger Bands', isOverlay: true, inputs: [20, 2] },
  { name: 'SAR', displayName: 'SAR', studyName: 'Parabolic SAR', isOverlay: true },
  // 副图指标（独立显示）
  { name: 'VOL', displayName: 'VOL', studyName: 'Volume', isOverlay: false },
  { name: 'MACD', displayName: 'MACD', studyName: 'MACD', isOverlay: false },
  { name: 'KDJ', displayName: 'KDJ', studyName: 'Stochastic', isOverlay: false },
  { name: 'SKDJ', displayName: 'SK', studyName: 'Stochastic RSI', isOverlay: false },
]

// 指标状态管理
class IndicatorManager {
  private widget: any
  private chart: any
  private activeIndicators: Map<string, any> = new Map() // key: 指标名, value: study对象或数组

  constructor(widget: any) {
    this.widget = widget
    this.chart = widget.chart()
  }

  // 切换指标显示/隐藏
  toggleIndicator(indicatorName: string): boolean {
    const config = INDICATOR_CONFIGS.find(c => c.name === indicatorName)
    if (!config) {
      console.error(`未找到指标配置: ${indicatorName}`)
      return false
    }

    const isActive = this.activeIndicators.has(indicatorName)

    if (isActive) {
      // 移除指标
      this.removeIndicator(indicatorName)
      return false // 移除后返回false（未激活状态）
    } else {
      // 添加指标
      try {
        // 预先设置状态，标记为"正在添加"，避免重复点击和立即更新按钮状态
        if (config.name === 'MA' || config.name === 'EMA') {
          // MA/EMA使用空数组标记"正在添加"
          this.activeIndicators.set(indicatorName, [])
        } else {
          // 其他指标使用特殊标记"pending"表示正在添加
          this.activeIndicators.set(indicatorName, 'pending' as any)
        }
        
        this.addIndicator(config)
        
        // 立即返回true，按钮状态会立即更新
        // 实际的studyId会在setTimeout回调中更新
        return true
      } catch (error) {
        console.error(`切换指标 ${indicatorName} 失败:`, error)
        // 如果添加失败，移除预设置的状态
        this.activeIndicators.delete(indicatorName)
        return false
      }
    }
  }

  // 添加指标
  private addIndicator(config: IndicatorConfig) {
    try {
      if (config.name === 'MA' || config.name === 'EMA') {
        // MA和EMA可以添加多条线
        const studyIds: any[] = []
        const colors = ['#EDEDED', '#ffe000', '#ce00ff', '#00adff']
        
        // 先创建所有指标
        config.inputs?.forEach((period, index) => {
          try {
            if (config.name === 'EMA') {
              const emaNames = ['Moving Average Exponential', 'EMA', 'Exponential Moving Average']
              for (const name of emaNames) {
                try {
                  this.chart.createStudy(
                    name,
                    config.isOverlay,
                    false,
                    [period],
                    null,
                    { "plot.color": colors[index] || "#ffffff" }
                  )
                  break
                } catch (err) {
                  continue
                }
              }
            } else {
              // MA
              this.chart.createStudy(
                config.studyName,
                config.isOverlay,
                false,
                [period],
                null,
                { "plot.color": colors[index] || "#ffffff" }
              )
            }
          } catch (err) {
            console.error(`创建 ${config.name}(${period}) 失败:`, err)
          }
        })
        
        // 等待所有指标创建后，一次性匹配所有studies
        setTimeout(() => {
          try {
            const allStudies = this.chart.getAllStudies()
            const usedStudyIds = new Set<string>() // 避免重复匹配
            
            console.log(`[调试] 查找 ${config.name} 指标，当前共有 ${allStudies.length} 个studies`)
            
            // 过滤出所有MA/EMA相关的studies
            const maStudies = allStudies.filter((s: any) => {
              const studyId = String(s.id || s)
              if (usedStudyIds.has(studyId)) return false
              
              const name = (s.name || s.description || s.studyType || '').toLowerCase()
              return name.includes('moving average') || name.includes('ema')
            })
            
            console.log(`[调试] 找到 ${maStudies.length} 个MA/EMA相关的studies`)
            maStudies.forEach((s: any, idx: number) => {
              console.log(`MA Study ${idx}:`, {
                id: s.id,
                name: s.name || s.description || s.studyType,
                inputs: s.inputs,
                inputsType: typeof s.inputs,
                inputsLength: Array.isArray(s.inputs) ? s.inputs.length : 'N/A'
              })
            })
            
            // 为每个周期查找匹配的study
            config.inputs?.forEach((period, index) => {
              // 查找匹配的指标（通过名称和周期判断），且未被使用过
              let matchingStudy: any = null
              let bestMatch: any = null
              
              for (const s of maStudies) {
                const studyId = String(s.id || s)
                if (usedStudyIds.has(studyId)) continue
                
                const name = (s.name || s.description || s.studyType || '').toLowerCase()
                const nameMatches = name.includes('moving average') || name.includes('ema')
                if (!nameMatches) continue
                
                // 检查周期是否匹配
                const inputs = s.inputs || []
                let periodMatches = false
                let matchedValue: any = null
                
                if (inputs && inputs.length > 0) {
                  // 尝试多种方式匹配周期
                  for (const input of inputs) {
                    if (input == null) continue
                    
                    let value: any = null
                    if (typeof input === 'object' && input !== null) {
                      value = input.value ?? input.input ?? input.length ?? input
                    } else {
                      value = input
                    }
                    
                    if (Number(value) === period) {
                      periodMatches = true
                      matchedValue = value
                      break
                    }
                  }
                  
                  // 如果inputs是对象，尝试直接访问length属性
                  if (!periodMatches && typeof inputs === 'object' && 'length' in inputs) {
                    const lengthValue = (inputs as any).length
                    if (Number(lengthValue) === period) {
                      periodMatches = true
                      matchedValue = lengthValue
                    }
                  }
                }
                
                if (periodMatches) {
                  matchingStudy = s
                  break
                } else if (!bestMatch) {
                  // 如果没有精确匹配，记录第一个匹配的作为备用
                  bestMatch = s
                }
              }
              
              // 如果没有精确匹配，使用备用匹配（按创建顺序）
              // 由于TradingView的getAllStudies不返回inputs，我们按创建顺序匹配
              if (!matchingStudy && bestMatch && index < maStudies.length) {
                matchingStudy = bestMatch
                // 这是正常的，因为TradingView v1.11的getAllStudies不包含inputs信息
              }
              
              if (matchingStudy) {
                const studyId = matchingStudy.id || matchingStudy
                usedStudyIds.add(String(studyId))
                studyIds.push(studyId)
                console.log(`✓ 成功匹配 ${config.name}(${period}) 指标, studyId: ${studyId}`)
              } else {
                console.warn(`✗ 未找到匹配 ${config.name}(${period}) 的study`)
              }
            })
            
            // 如果没有匹配到足够的指标，打印调试信息
            if (studyIds.length < (config.inputs?.length || 0)) {
              console.log('[调试] 所有studies详情:')
              allStudies.forEach((s: any, idx: number) => {
                console.log(`Study ${idx}:`, {
                  id: s.id,
                  name: s.name,
                  description: s.description,
                  studyType: s.studyType,
                  inputs: s.inputs,
                  fullObject: JSON.stringify(s, null, 2) // 完整对象
                })
              })
            }
            
            if (studyIds.length > 0) {
              this.activeIndicators.set(config.name, studyIds)
              console.log(`${config.name} 指标添加完成，共 ${studyIds.length}/${config.inputs?.length} 条线`)
            } else {
              console.warn(`${config.name} 指标未成功添加任何线，清理状态`)
              // 如果添加失败，清理预设置的状态
              this.activeIndicators.delete(config.name)
            }
          } catch (err) {
            console.error(`验证 ${config.name} 指标时出错:`, err)
          }
        }, 500) // 延迟500ms确保所有指标都已创建
      } else {
        // 其他指标添加单个
        try {
          const study = this.chart.createStudy(
            config.studyName,
            config.isOverlay,
            false,
            config.inputs || [],
            null,
            config.options || {}
          )
          
          // 即使返回空值，也可能创建成功，延迟验证
          setTimeout(() => {
            try {
              const allStudies = this.chart.getAllStudies()
              
              // 查找匹配的指标（通过名称判断）
              const matchingStudy = allStudies.find((s: any) => {
                const name = (s.name || s.description || s.studyType || '').toLowerCase()
                const configNameLower = config.studyName.toLowerCase()
                return name.includes(configNameLower) || 
                       name === configNameLower ||
                       (configNameLower.includes('macd') && name.includes('macd')) ||
                       (configNameLower.includes('stochastic') && name.includes('stochastic')) ||
                       (configNameLower.includes('volume') && name.includes('volume')) ||
                       (configNameLower.includes('bollinger') && name.includes('bollinger')) ||
                       (configNameLower.includes('parabolic') && name.includes('parabolic'))
              })
              
              if (matchingStudy) {
                const studyId = matchingStudy.id || matchingStudy
                // 替换pending标记为实际的studyId
                this.activeIndicators.set(config.name, studyId)
                console.log(`✓ 成功添加 ${config.name} 指标, studyId: ${studyId}`)
              } else if (study) {
                // 如果createStudy返回了值，直接使用
                let studyId: any = null
                if (typeof study === 'object' && study !== null) {
                  studyId = study.id || study
                } else {
                  studyId = study
                }
                
                if (studyId) {
                  this.activeIndicators.set(config.name, studyId)
                  console.log(`✓ 成功添加 ${config.name} 指标（直接返回）, studyId: ${studyId}`)
                }
              } else {
                console.warn(`创建 ${config.name} 指标后未找到匹配的study，清理状态`)
                // 如果添加失败，清理预设置的状态
                this.activeIndicators.delete(config.name)
              }
            } catch (err) {
              console.error(`验证 ${config.name} 指标时出错:`, err)
              // 如果验证失败但createStudy返回了值，尝试直接保存
              if (study) {
                let studyId: any = null
                if (typeof study === 'object' && study !== null) {
                  studyId = study.id || study
                } else {
                  studyId = study
                }
                if (studyId) {
                  this.activeIndicators.set(config.name, studyId)
                }
              }
            }
          }, 200) // 延迟200ms验证
        } catch (error) {
          console.error(`创建 ${config.name} 指标失败:`, error)
          throw error
        }
      }
    } catch (error) {
      console.error(`添加指标 ${config.name} 失败:`, error)
      throw error // 重新抛出错误以便上层处理
    }
  }

  // 移除指标
  private removeIndicator(indicatorName: string) {
    const indicator = this.activeIndicators.get(indicatorName)
    if (!indicator) {
      console.warn(`尝试移除不存在的指标: ${indicatorName}`)
      return
    }

    // 如果是pending标记或空数组，直接删除状态即可（还未真正添加）
    if (indicator === 'pending' || (Array.isArray(indicator) && indicator.length === 0)) {
      this.activeIndicators.delete(indicatorName)
      console.log(`✓ ${indicatorName} 指标（pending状态）已移除`)
      return
    }

    try {
      if (Array.isArray(indicator)) {
        // 多条线的情况（MA/EMA）- 移除所有studies
        console.log(`开始移除 ${indicatorName}，共 ${indicator.length} 条线`)
        indicator.forEach((studyId: any, index: number) => {
          try {
            // 尝试直接使用studyId移除
            if (this.chart.removeEntity) {
              this.chart.removeEntity(studyId)
              console.log(`✓ 成功移除 ${indicatorName}(${index + 1}), studyId: ${studyId}`)
            } else {
              // 如果removeEntity不存在，尝试其他方法
              const allStudies = this.chart.getAllStudies()
              const study = allStudies.find((s: any) => s.id === studyId || String(s.id) === String(studyId))
              if (study) {
                // 尝试调用study的remove方法（如果存在）
                if (study.remove && typeof study.remove === 'function') {
                  study.remove()
                  console.log(`✓ 通过study.remove()移除 ${indicatorName}(${index + 1})`)
                } else if (this.chart.removeEntity) {
                  this.chart.removeEntity(study.id)
                  console.log(`✓ 通过removeEntity移除 ${indicatorName}(${index + 1})`)
                } else {
                  console.warn(`无法移除 ${indicatorName}(${index + 1})，缺少移除方法`)
                }
              } else {
                console.warn(`未找到studyId为 ${studyId} 的study`)
              }
            }
          } catch (err) {
            console.error(`移除 ${indicatorName}(${index + 1}) 时出错:`, err)
          }
        })
      } else {
        // 单条线的情况
        try {
          if (this.chart.removeEntity) {
            this.chart.removeEntity(indicator)
            console.log(`✓ 成功移除 ${indicatorName}, studyId: ${indicator}`)
          } else {
            // 备用方法
            const allStudies = this.chart.getAllStudies()
            const study = allStudies.find((s: any) => s.id === indicator || String(s.id) === String(indicator))
            if (study && study.remove && typeof study.remove === 'function') {
              study.remove()
            } else {
              console.warn(`无法移除 ${indicatorName}，缺少移除方法`)
            }
          }
        } catch (err) {
          console.error(`移除 ${indicatorName} 时出错:`, err)
        }
      }
      
      // 从activeIndicators中删除
      this.activeIndicators.delete(indicatorName)
      console.log(`✓ ${indicatorName} 指标已从状态中移除`)
    } catch (error) {
      console.error(`移除指标 ${indicatorName} 失败:`, error)
      // 即使出错，也尝试从状态中删除
      this.activeIndicators.delete(indicatorName)
    }
  }

  // 检查指标是否激活
  isIndicatorActive(indicatorName: string): boolean {
    return this.activeIndicators.has(indicatorName)
  }

  // 检测并初始化已存在的指标（移除默认显示的指标，如VOL）
  initializeExistingIndicators(): void {
    try {
      const allStudies = this.chart.getAllStudies()
      console.log(`[初始化] 检测已存在的指标，当前共有 ${allStudies.length} 个studies`)
      
      INDICATOR_CONFIGS.forEach(config => {
        // 跳过MA和EMA（它们可能有多条线，需要特殊处理）
        if (config.name === 'MA' || config.name === 'EMA') {
          return
        }
        
        // 查找匹配的指标
        const matchingStudy = allStudies.find((s: any) => {
          const name = (s.name || s.description || s.studyType || '').toLowerCase()
          const configNameLower = config.studyName.toLowerCase()
          
          return name.includes(configNameLower) || 
                 name === configNameLower ||
                 (configNameLower.includes('macd') && name.includes('macd')) ||
                 (configNameLower.includes('stochastic') && name.includes('stochastic')) ||
                 (configNameLower.includes('volume') && name.includes('volume')) ||
                 (configNameLower.includes('bollinger') && name.includes('bollinger')) ||
                 (configNameLower.includes('parabolic') && name.includes('parabolic'))
        })
        
        if (matchingStudy) {
          const studyId = matchingStudy.id || matchingStudy
          
          // 默认情况下，所有指标都应该隐藏
          // 所以检测到已存在的指标时，直接移除它们（而不是添加到activeIndicators）
          try {
            if (this.chart.removeEntity) {
              this.chart.removeEntity(studyId)
              console.log(`[初始化] 移除默认显示的指标: ${config.name}, studyId: ${studyId}`)
            } else {
              // 备用方法
              if (matchingStudy.remove && typeof matchingStudy.remove === 'function') {
                matchingStudy.remove()
                console.log(`[初始化] 通过remove()移除默认显示的指标: ${config.name}`)
              }
            }
          } catch (removeErr) {
            console.error(`[初始化] 移除默认指标 ${config.name} 时出错:`, removeErr)
          }
        }
      })
    } catch (err) {
      console.error('[初始化] 检测已存在指标时出错:', err)
    }
  }
}

export default function TVChartContainer(strId: string, className?: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = twMerge('w-full h-full flex flex-col', className)

  const container = document.createElement('div')
  container.id = 'trading-view-container'
  container.className = 'flex-1 relative'

  // 创建底部指标栏
  const indicatorBar = createIndicatorBar()

  wrapper.appendChild(container)
  wrapper.appendChild(indicatorBar)

  try {
    loadTradingView(container, strId, indicatorBar)
  } catch (error) {
    console.error('Failed to initialize TradingView:', error)
    container.innerHTML = '<div class="flex items-center justify-center h-full text-white">Failed to load TradingView chart</div>'
  }
  
  return wrapper
}

async function loadTradingView(container: HTMLElement, strId: string = "btc-usdt-spot", indicatorBar: HTMLElement) {
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
  const datafeed = new DataFeedWs(api, strId);


  const options = TradingViewOptions()
  options.library_path = library_path
  options.container_id = container.id
  options.symbol = strId
  options.datafeed = datafeed

  // 在创建widget之前就注入CSS，避免VOL显示
  injectVolumeHideCSS()

  // 创建 TradingView widget
  const widget = new window.TradingView.widget(options)

  widget.onChartReady(() => {
    const chart = widget.chart()
    chart.executeActionById("undo")  // "undo" 撤销上一步 "redo" 重做

    // 调试：打印可用的指标列表（可选，用于查找正确的指标名称）
    try {
      const studiesList = widget.getStudiesList()
      if (studiesList && studiesList.length > 0) {
        console.log('[调试] 可用的指标列表:', studiesList.map((s: any) => s.name || s))
      }
    } catch (e) {
      console.log('[调试] 无法获取指标列表:', e)
    }

    // 创建指标管理器
    const indicatorManager = new IndicatorManager(widget)
    
    // 立即检测并移除默认显示的指标（如图表默认显示的VOL）
    // CSS已经在widget创建前注入，VOL应该已经被隐藏
    // 使用更频繁的检查，在VOL刚出现时就立即移除，避免闪烁
    const removeDefaultIndicators = () => {
      try {
        const allStudies = chart.getAllStudies()
        // 查找Volume指标并立即移除
        const volumeStudy = allStudies.find((s: any) => {
          const name = (s.name || s.description || s.studyType || '').toLowerCase()
          return name.includes('volume')
        })
        
        if (volumeStudy) {
          const studyId = volumeStudy.id || volumeStudy
          try {
            if (chart.removeEntity) {
              chart.removeEntity(studyId)
              console.log(`[初始化] 立即移除默认VOL指标, studyId: ${studyId}`)
              // 移除成功后，移除临时CSS
              removeVolumeHideCSS()
            }
          } catch (e) {
            // 忽略错误，可能已经移除
          }
        }
        
        // 然后执行完整的初始化
        indicatorManager.initializeExistingIndicators()
        // 更新按钮状态
        updateIndicatorBarButtons(indicatorBar, indicatorManager)
      } catch (err) {
        console.error('[初始化] 移除默认指标时出错:', err)
      }
    }
    
    // 立即执行一次（同步）
    removeDefaultIndicators()
    
    // 使用requestAnimationFrame尽快执行
    requestAnimationFrame(() => {
      removeDefaultIndicators()
      requestAnimationFrame(() => {
        removeDefaultIndicators()
        // 确保在多次检查后移除CSS
        setTimeout(() => removeVolumeHideCSS(), 100)
      })
    })
    
    // 延迟执行多次，确保捕获所有情况
    setTimeout(removeDefaultIndicators, 0)
    setTimeout(removeDefaultIndicators, 50)
    setTimeout(removeDefaultIndicators, 100)
    setTimeout(() => {
      removeDefaultIndicators()
      removeVolumeHideCSS() // 最后移除CSS
    }, 200)
    
    // 绑定指标栏点击事件
    bindIndicatorBarEvents(indicatorBar, indicatorManager)

    addButtons(widget)  // 添加按钮
    
    // 动态注入更高优先级的 CSS 来强制折叠指标
    injectLegendCollapseCSS()
    
    // 持续强制折叠（5秒内每200ms检查一次）
    setTimeout(() => forceCollapseLegends(), 500)
    const collapseInterval = setInterval(forceCollapseLegends, 200)
    setTimeout(() => clearInterval(collapseInterval), 5000)
  })
}

// 临时隐藏成交量面板的CSS
function injectVolumeHideCSS() {
  const styleId = 'volume-hide-style'
  
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      /* 临时隐藏成交量面板，避免闪烁 */
      /* 隐藏所有非主图的面板（成交量通常在第二个面板） */
      .chart-markup-table > .pane:not(:first-child),
      .pane[data-name*="volume" i],
      .pane[data-name*="Volume" i],
      .pane[data-name*="VOLUME" i] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        opacity: 0 !important;
        overflow: hidden !important;
      }
    `
    document.head.appendChild(style)
  }
  
  // 也注入到iframe（如果有）
  try {
    const iframe = document.querySelector('iframe')
    if (iframe?.contentWindow?.document) {
      const iframeDoc = iframe.contentWindow.document as any
      if (!iframeDoc.getElementById(styleId)) {
        const iframeStyle = iframeDoc.createElement('style')
        iframeStyle.id = styleId
        iframeStyle.textContent = `
          .chart-markup-table > .pane:not(:first-child),
          .pane[data-name*="volume" i],
          .pane[data-name*="Volume" i],
          .pane[data-name*="VOLUME" i] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            opacity: 0 !important;
            overflow: hidden !important;
          }
        `
        iframeDoc.head.appendChild(iframeStyle)
      }
    }
  } catch (e) {
    // 跨域问题，忽略
  }
}

// 移除临时隐藏成交量面板的CSS
function removeVolumeHideCSS() {
  const styleId = 'volume-hide-style'
  const style = document.getElementById(styleId)
  if (style) {
    style.remove()
  }
  
  // 也移除iframe中的
  try {
    const iframe = document.querySelector('iframe')
    if (iframe?.contentWindow?.document) {
      const iframeDoc = iframe.contentWindow.document as any
      const iframeStyle = iframeDoc.getElementById(styleId)
      if (iframeStyle) {
        iframeStyle.remove()
      }
    }
  } catch (e) {
    // 跨域问题，忽略
  }
}

// 动态注入 CSS
function injectLegendCollapseCSS() {
  const styleId = 'legend-collapse-style'
  
  // 注入到主文档
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      /* 强制折叠指标图例 */
      .pane-legend-wrap.study .pane-legend-item-value-container,
      .pane-legend-wrap.study .pane-legend-item-value-wrap,
      .pane-legend-wrap.study .pane-legend-item-value,
      .pane-legend-wrap.study .pane-legend-item-additional {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
      }
      
      /* 展开时显示 */
      .pane-legend-wrap.study.expand-line .pane-legend-item-value-container,
      .pane-legend-wrap.study.expand-line .pane-legend-item-value-wrap,
      .pane-legend-wrap.study.expand-line .pane-legend-item-value,
      .pane-legend-wrap.study.expand-line .pane-legend-item-additional {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        width: auto !important;
      }
    `
    document.head.appendChild(style)
  }
  
  // 也注入到 iframe（如果有的话）
  try {
    const iframe = document.querySelector('iframe')
    if (iframe?.contentWindow?.document) {
      const iframeDoc = iframe.contentWindow.document as any
      if (!iframeDoc.getElementById(styleId)) {
        const iframeStyle = iframeDoc.createElement('style')
        iframeStyle.id = styleId
        iframeStyle.textContent = `
          /* 强制折叠指标图例 */
          .pane-legend-wrap.study .pane-legend-item-value-container,
          .pane-legend-wrap.study .pane-legend-item-value-wrap,
          .pane-legend-wrap.study .pane-legend-item-value,
          .pane-legend-wrap.study .pane-legend-item-additional {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
          }
        `
        iframeDoc.head.appendChild(iframeStyle)
      }
    }
  } catch (e) {
    // 跨域问题，忽略
  }
}

// 强制隐藏指标图例的值
function forceCollapseLegends() {
  // 在 iframe 中查找并强制隐藏
  try {
    const iframe = document.querySelector('iframe')
    
    if (iframe?.contentWindow) {
      const iframeWindow = iframe.contentWindow as any
      
      if (iframeWindow.document) {
        const iframeDoc = iframeWindow.document
        
        // 隐藏所有值相关元素（不检查可见性，强制隐藏所有）
        const allSelectors = [
          '.pane-legend-wrap.study .pane-legend-item-value-container',
          '.pane-legend-wrap.study .pane-legend-item-value-wrap',
          '.pane-legend-wrap.study .pane-legend-item-value',
          '.pane-legend-wrap.study .pane-legend-item-additional'
        ]
        
        let totalHidden = 0
        allSelectors.forEach(selector => {
          const elements = iframeDoc.querySelectorAll(selector)
          totalHidden += elements.length
          elements.forEach((el: any) => {
            el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0 !important; width: 0 !important;'
          })
        })
        
        if (totalHidden > 0) {
          console.log(`[Legend] 隐藏了 ${totalHidden} 个指标元素`)
        }
      }
    }
  } catch (e) {
    console.log('[Legend] iframe 访问失败（跨域限制）:', e)
  }
  
  // 在主文档中查找（备用）
  const allSelectors = [
    '.pane-legend-wrap.study .pane-legend-item-value-container',
    '.pane-legend-wrap.study .pane-legend-item-value-wrap',
    '.pane-legend-wrap.study .pane-legend-item-value',
    '.pane-legend-wrap.study .pane-legend-item-additional'
  ]
  
  allSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach((el: any) => {
      el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0 !important; width: 0 !important;'
    })
  })
}


// 创建指标栏UI
function createIndicatorBar(): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'bg-gray-800 border-t border-gray-700 px-2 py-1 flex items-center gap-2'
  bar.style.minHeight = '40px'
  bar.style.overflowX = 'auto'
  bar.style.overflowY = 'hidden'
  bar.style.scrollBehavior = 'smooth'
  
  // 隐藏滚动条但保持滚动功能（适用于Webkit浏览器和Firefox）
  bar.style.scrollbarWidth = 'none' // Firefox
  bar.style.setProperty('-ms-overflow-style', 'none') // IE/Edge
  
  // 为Webkit浏览器添加隐藏滚动条的样式
  const scrollbarStyle = document.createElement('style')
  scrollbarStyle.id = 'indicator-bar-scrollbar-hide'
  scrollbarStyle.textContent = `
    #indicator-bar::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
      background: transparent;
    }
    #indicator-bar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `
  if (!document.getElementById('indicator-bar-scrollbar-hide')) {
    document.head.appendChild(scrollbarStyle)
  }
  
  bar.id = 'indicator-bar'

  INDICATOR_CONFIGS.forEach(config => {
    const button = document.createElement('button')
    button.dataset.indicator = config.name
    button.textContent = config.displayName
    
    // 设置初始状态（未激活）
    updateIndicatorButtonStyle(button, false)
    
    bar.appendChild(button)
  })

  return bar
}

// 绑定指标栏事件
function bindIndicatorBarEvents(indicatorBar: HTMLElement, indicatorManager: IndicatorManager) {
  const buttons = indicatorBar.querySelectorAll('button[data-indicator]')
  
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const indicatorName = button.getAttribute('data-indicator')
      if (!indicatorName) return

      const isActive = indicatorManager.toggleIndicator(indicatorName)
      
      // 更新按钮样式
      // 注意：对于MA/EMA这种异步添加的指标，isActive可能立即返回true（因为预设置了状态）
      // 但实际的指标添加是异步的，所以这里使用toggleIndicator的返回值即可
      updateIndicatorButtonStyle(button as HTMLElement, isActive)
      
      // 对于移除操作，确保状态同步
      // 对于异步添加，如果失败会在setTimeout回调中清理状态，这里不需要额外处理
    })
  })
  
  // 定期同步按钮状态（防止异步添加失败导致状态不一致）
  setInterval(() => {
    buttons.forEach(button => {
      const indicatorName = button.getAttribute('data-indicator')
      if (!indicatorName) return
      
      const isActive = indicatorManager.isIndicatorActive(indicatorName)
      const buttonElement = button as HTMLElement
      // 检查当前样式是否正确
      const currentIsActive = buttonElement.className.includes('bg-blue-600')
      
      // 如果状态不一致，更新样式
      if (isActive !== currentIsActive) {
        updateIndicatorButtonStyle(buttonElement, isActive)
      }
    })
  }, 1000) // 每秒检查一次
}

// 更新指标按钮样式
function updateIndicatorButtonStyle(button: HTMLElement, isActive: boolean) {
  if (isActive) {
    button.className = 'px-3 py-1 text-xs font-medium rounded transition-colors bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 whitespace-nowrap'
  } else {
    button.className = 'px-3 py-1 text-xs font-medium rounded transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap'
  }
}

// 更新所有指标栏按钮状态
function updateIndicatorBarButtons(indicatorBar: HTMLElement, indicatorManager: IndicatorManager) {
  const buttons = indicatorBar.querySelectorAll('button[data-indicator]')
  
  buttons.forEach(button => {
    const indicatorName = button.getAttribute('data-indicator')
    if (!indicatorName) return
    
    const isActive = indicatorManager.isIndicatorActive(indicatorName)
    updateIndicatorButtonStyle(button as HTMLElement, isActive)
  })
}

const addButtons = (widget: any) => {
  // 支持的时间周期：1m, 5m, 15m, 1h, 4h, 1d, 1W, 1M
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

  // 创建按钮并绑定点击事件
  buttonsData.forEach(data => {
    const button = widget.createButton().attr("title", data.title).append(`<span>${data.label}</span>`);

    button.on("click", () => {
      widget.chart().setChartType(1); // 假设1是您想要设置的图表类型
      widget.setSymbol("", data.resolution);
    });
  });
}
