import { twMerge } from 'tailwind-merge';

import { SupportIndicators } from "./TVChartContainer";


class IndicatorBar {
  private bar!: HTMLElement;
  private parent: HTMLElement;
  private className?: string;
  private buttons: Map<string, HTMLElement> = new Map();

  // 指标点击回调
  public onClick?: (indicatorName: string) => void

  constructor(parent: HTMLElement, options: { className?: string } = {}) {
    this.parent = parent;
    this.className = options.className;

    this.bar = document.createElement('div');
    this.bar.id = 'indicator-bar';
    this.parent.appendChild(this.bar);

    this.bar.className = twMerge(
      'bg-gray-800 border-t border-gray-700 px-2 py-1 flex items-center gap-2',
      this.className
    );

    this.bar.style.minHeight = '40px';
    this.bar.style.overflowX = 'auto';
    this.bar.style.overflowY = 'hidden';
    this.bar.style.scrollBehavior = 'smooth';

    // 隐藏滚动条但保持滚动功能（适用于Webkit浏览器和Firefox）
    this.bar.style.scrollbarWidth = 'none'; // Firefox
    this.bar.style.setProperty('-ms-overflow-style', 'none'); // IE/Edge



    this.setupScrollbarStyles();
    this.createIndicatorButtons();
  }

  private setupScrollbarStyles(): void {
    // 为Webkit浏览器添加隐藏滚动条的样式
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.id = 'indicator-bar-scrollbar-hide';
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
    `;

    if (!document.getElementById('indicator-bar-scrollbar-hide')) {
      document.head.appendChild(scrollbarStyle);
    }
  }

  private createIndicatorButtons(): void {
    SupportIndicators().forEach(indicator => {
      const button = document.createElement('button');
      button.dataset.indicator = indicator;
      button.textContent = indicator;

      // 设置初始状态（未激活）
      this.updateIndicatorButtonStyle(button, false);

      // 添加点击事件
      button.addEventListener('click', () => {
        if (this.onClick) {
          this.onClick(indicator);
        }
      });

      this.bar.appendChild(button);
      this.buttons.set(indicator, button);
    });
  }

  // 更新指标按钮样式
  private updateIndicatorButtonStyle(button: HTMLElement, isActive: boolean): void {
    if (isActive) {
      button.className = 'px-3 py-1 text-xs font-medium rounded transition-colors bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 whitespace-nowrap';
    } else {
      button.className = 'px-3 py-1 text-xs font-medium rounded transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap';
    }
  }

  // 公共方法：设置指标按钮的激活状态
  public setIndicatorActive(state: Record<string, boolean>): void {
    Object.entries(state).forEach(([indicatorName, isActive]) => {
      const button = this.buttons.get(indicatorName);
      if (button) {
        this.updateIndicatorButtonStyle(button, isActive);
      }
    });
  }

  // 公共方法：获取所有按钮
  public getButtons(): Map<string, HTMLElement> {
    return new Map(this.buttons);
  }

  // 公共方法：获取DOM元素
  public getElement(): HTMLElement {
    return this.bar;
  }

  
  // 公共方法：销毁组件
  public destroy(): void {
    this.bar.remove();
    this.buttons.clear();
  }
}

export default IndicatorBar;