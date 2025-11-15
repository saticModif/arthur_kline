import { twMerge } from 'tailwind-merge';

// K线数据类型定义
export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 处理数据类型定义
export interface ClickData {
  x: number;
  y: number;
  data?: KlineData | Record<string, any>;
}

export default class ChartOverlay {
  private overlay!: HTMLElement;
  private parent: HTMLElement;
  private className?: string;
  private tooltip!: HTMLElement;
  private isTooltipVisible: boolean = false;

  constructor(parent: HTMLElement, options: { className?: string } = {}) {
    this.parent = parent;
    this.className = options.className;

    this.overlay = document.createElement('div');
    this.overlay.className = twMerge(
      'absolute top-0 left-0 w-full h-full z-10',
      this.className
    );

    this.overlay.style.pointerEvents = 'none';
    this.parent.appendChild(this.overlay);

    // 创建tooltip元素
    this.createTooltip();
  }

  // 创建tooltip元素
  private createTooltip(): void {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'absolute bg-gray-500/30 rounded-sm p-2 pointer-events-none'
      
    // this.tooltip.style.display = 'none';
    this.parent.appendChild(this.tooltip);
  }

  // 更新鼠标位置数据
  public handleClick(data: ClickData): void {
    // 如果有数据且tooltip当前隐藏，则显示tooltip
    if (data.data && !this.isTooltipVisible) {
      this.showTooltip(data);
      this.isTooltipVisible = true;
    }
    // 如果tooltip当前显示，则隐藏tooltip
    else if (this.isTooltipVisible) {
      this.hideTooltip();
      this.isTooltipVisible = false;
    }
  }

  // 显示tooltip
  private showTooltip(data: ClickData): void {
    if (!this.tooltip || !data.data) return;

    // 生成tooltip内容
    const content = this.formatTooltipContent(data.data);
    this.tooltip.innerHTML = content;

    // 计算tooltip位置
    const position = this.calculateTooltipPosition(data.x, data.y);

    // 设置位置和显示
    this.tooltip.style.left = `${position.x}px`;
    this.tooltip.style.top = `${position.y}px`;
    this.tooltip.style.display = 'block';

    // 触发重排后添加透明度，实现淡入效果
    requestAnimationFrame(() => {
      this.tooltip.style.opacity = '1';
    });
  }

  // 隐藏tooltip
  private hideTooltip(): void {
    if (!this.tooltip) return;

    this.tooltip.style.opacity = '0';
    this.isTooltipVisible = false;

    // 等待过渡完成后隐藏
    setTimeout(() => {
      if (this.tooltip) {
        this.tooltip.style.display = 'none';
      }
    }, 200);
  }

  // 格式化tooltip内容
  private formatTooltipContent(data: KlineData | Record<string, any>): string {
    let content = '';

    // 格式化时间为 MM/DD HH:mm 格式
    const date = new Date(data.time * 1000);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const formattedTime = `${month}/${day} ${hours}:${minutes}`;

    // 检查是否为标准K线数据
    const isKlineData = this.isKlineData(data);

    if (isKlineData) {
      const klineData = data as KlineData;
      content += `
        <div class="min-w-[70px] space-y-1 text-[8px]">
          <div class="flex justify-between">
            <span class="text-black">时间:</span>
            <span class="text-black">${formattedTime}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-black">开盘:</span>
            <span class="text-black">${klineData.open.toFixed(2)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-black">最高:</span>
            <span class="text-black">${klineData.high.toFixed(2)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-black">最低:</span>
            <span class="text-black">${klineData.low.toFixed(2)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-black">收盘:</span>
            <span class="text-black">${klineData.close.toFixed(2)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-black">成交量:</span>
            <span class="text-black">${klineData.volume?.toFixed(2) || 'N/A'}</span>
          </div>
        </div>
      `;
    }

    return content;
  }

  // 检查数据是否为标准K线数据
  private isKlineData(data: any): data is KlineData {
    return data &&
           typeof data.open === 'number' &&
           typeof data.high === 'number' &&
           typeof data.low === 'number' &&
           typeof data.close === 'number' &&
           typeof data.time === 'number';
  }

  // 计算tooltip位置，防止遮挡
  private calculateTooltipPosition(mouseX: number, mouseY: number): { x: number, y: number } {
    if (!this.tooltip) return { x: mouseX, y: mouseY };

    // 获取父容器的尺寸
    const parentRect = this.parent.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();

    // 计算tooltip相对于父容器的鼠标位置
    const relativeX = mouseX;

    // 获取容器中心点
    const centerX = parentRect.width / 2;
    const centerY = parentRect.height / 2;

    // 判断鼠标在左半部分还是右半部分
    const isInLeftHalf = relativeX < centerX;

    let x: number;
    let y = centerY - tooltipRect.height / 2 - 30; // 固定在容器的垂直中心

    if (isInLeftHalf) {
      // 鼠标在左半部分，tooltip显示在最右边
      x = parentRect.width - tooltipRect.width - 200; // 距右边界200px
    } else {
      // 鼠标在右半部分，tooltip显示在最左边
      x = 50; // 距左边界50px
    }

    // 确保tooltip不会超出左右边界
    if (x < 10) {
      x = 10;
    }
    if (x + tooltipRect.width > parentRect.width - 10) {
      x = parentRect.width - tooltipRect.width - 10;
    }

    // 确保tooltip不会超出上下边界
    if (y < 10) {
      y = 10;
    }
    if (y + tooltipRect.height > parentRect.height - 10) {
      y = parentRect.height - tooltipRect.height - 10;
    }

    return { x, y };
  }

  // 获取DOM元素
  public getElement(): HTMLElement {
    return this.overlay;
  }

  // 销毁组件
  public destroy(): void {
    if (this.tooltip) {
      this.tooltip.remove();
    }
    this.overlay.remove();
    this.isTooltipVisible = false;
  }
}