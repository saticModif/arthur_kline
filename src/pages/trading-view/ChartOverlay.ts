import { twMerge } from 'tailwind-merge';

// K线数据类型定义
export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  referencePrice?: number;
  priceDiff?: number;
  priceDiffPercent?: number;
  crossPrice?: number;
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
  private priceLabel!: HTMLElement;

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
    this.tooltip.className = 'absolute bg-gray-500/30 rounded-sm p-2 pointer-events-none shadow-lg';
    this.tooltip.style.transition = 'opacity 0.2s ease';
    this.tooltip.style.opacity = '0';
    this.tooltip.style.display = 'none';
    this.parent.appendChild(this.tooltip);
    this.createPriceLabel();
  }

  private createPriceLabel(): void {
    this.priceLabel = document.createElement('div');
    this.priceLabel.className = 'absolute right-2 bg-black text-white text-[10px] leading-tight px-2 py-1 rounded-sm shadow pointer-events-none';
    this.priceLabel.style.display = 'none';
    this.priceLabel.style.zIndex = '20';
    this.parent.appendChild(this.priceLabel);
  }

  // 更新鼠标位置数据
  public handleClick(data: ClickData): void {
    // 如果有数据且tooltip当前隐藏，则显示tooltip
    if (data.data && !this.isTooltipVisible) {
      this.showTooltip(data);
      this.isTooltipVisible = true;
      this.updatePriceLabel(data);
    }
    // 如果tooltip当前显示，则隐藏tooltip
    else if (this.isTooltipVisible) {
      this.hideTooltip();
      this.isTooltipVisible = false;
      this.hidePriceLabel();
    }
  }

  // 十字星移动时实时更新
  public handleCrosshairMove(data: ClickData): void {
    if (!data.data) {
      this.hideTooltip();
      this.hidePriceLabel();
      return;
    }

    this.showTooltip(data);
    this.updatePriceLabel(data);
  }

  // 显示tooltip
  private showTooltip(data: ClickData): void {
    if (!this.tooltip || !data.data) return;

    // 生成tooltip内容
    const content = this.formatTooltipContent(data.data);
    this.tooltip.innerHTML = content;
    this.tooltip.style.display = 'block';
    this.tooltip.style.visibility = 'hidden';

    // 计算tooltip位置
    const position = this.calculateTooltipPosition(data.x, data.y);

    // 设置位置和显示
    this.tooltip.style.left = `${position.x}px`;
    this.tooltip.style.top = `${position.y}px`;
    this.tooltip.style.visibility = 'visible';
    this.tooltip.style.display = 'block';
    this.isTooltipVisible = true;

    // 触发重排后添加透明度，实现淡入效果
    requestAnimationFrame(() => {
      this.tooltip.style.opacity = '1';
    });
  }

  // 隐藏tooltip
  private hideTooltip(): void {
    if (!this.tooltip) return;

    this.tooltip.style.opacity = '0';

    // 等待过渡完成后隐藏
    setTimeout(() => {
      if (this.tooltip) {
        this.tooltip.style.display = 'none';
        this.tooltip.style.visibility = 'hidden';
      }
    }, 200);
    this.isTooltipVisible = false;
  }

  private updatePriceLabel(data: ClickData): void {
    if (!this.priceLabel || !data.data) return;

    const klineData = data.data as KlineData;
    const parentRect = this.parent.getBoundingClientRect();
    const positionY = (data.y ?? parentRect.height / 2) - parentRect.top;

    const selectedPrice = klineData.crossPrice ?? klineData.close;
    const currentPrice = klineData.referencePrice ?? selectedPrice;
    const priceDiff = selectedPrice - currentPrice;
    const priceDiffPercent = currentPrice !== 0
      ? (priceDiff / currentPrice) * 100
      : 0;

    const sign = priceDiff >= 0 ? '+' : '';
    const color = priceDiff >= 0 ? '#22c55e' : '#ef4444';

    this.priceLabel.innerHTML = `
      <div class="text-[11px]">${this.formatNumber(selectedPrice)}</div>
      <div class="text-[10px]" style="color:${color}">
        ${sign}${this.formatNumber(Math.abs(priceDiff), 2, false)} (${sign}${priceDiffPercent.toFixed(2)}%)
      </div>
    `;

    this.priceLabel.style.display = 'block';
    const labelHeight = this.priceLabel.offsetHeight || 32;
    let top = positionY - labelHeight / 2;
    top = Math.max(0, Math.min(parentRect.height - labelHeight, top));
    this.priceLabel.style.top = `${top}px`;
  }

  private hidePriceLabel(): void {
    if (!this.priceLabel) return;
    this.priceLabel.style.display = 'none';
  }

  // 格式化tooltip内容
  private formatTooltipContent(data: KlineData | Record<string, any>): string {
    let content = '';

    // 格式化时间为 MM/DD HH:mm 格式，兼容秒和毫秒
    const timestamp = data.time > 1e12 ? data.time : data.time * 1000;
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const formattedTime = `${month}/${day} ${hours}:${minutes}`;

    // 检查是否为标准K线数据
    const isKlineData = this.isKlineData(data);

    if (isKlineData) {
      const klineData = data as KlineData;
      const priceChange = klineData.close - klineData.open;
      const priceChangePercent = klineData.open !== 0
        ? (priceChange / klineData.open) * 100
        : 0;
      const amplitudePercent = klineData.open !== 0
        ? ((klineData.high - klineData.low) / klineData.open) * 100
        : 0;
      const changeColorClass = priceChange >= 0 ? 'text-green-600' : 'text-red-600';
      const formattedChangeValue = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`;

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
            <span class="text-black">涨跌:</span>
            <span class="${changeColorClass}">${formattedChangeValue}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-black">振幅:</span>
            <span class="text-black">${amplitudePercent.toFixed(2)}%</span>
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

  private formatNumber(value: number, digits: number = 2, withGrouping: boolean = true): string {
    if (!isFinite(value)) return '0.00';
    return withGrouping
      ? value.toLocaleString(undefined, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits
        })
      : value.toFixed(digits);
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
    const relativeX = mouseX - parentRect.left;
    const relativeY = mouseY - parentRect.top;

    const horizontalOffset = 12;
    const verticalOffset = 12;
    const minPadding = 10;

    let x = relativeX + horizontalOffset;
    let y = relativeY - tooltipRect.height - verticalOffset;

    // 如果右侧空间不足，则显示在左侧
    if (x + tooltipRect.width > parentRect.width - minPadding) {
      x = relativeX - tooltipRect.width - horizontalOffset;
    }

    // 确保tooltip不会超出左右边界
    if (x < minPadding) {
      x = minPadding;
    }
    if (x + tooltipRect.width > parentRect.width - minPadding) {
      x = parentRect.width - tooltipRect.width - minPadding;
    }

    // 如果上方空间不足，则显示在下方
    if (y < minPadding) {
      y = relativeY + verticalOffset;
    }

    // 确保tooltip不会超出上下边界
    if (y < minPadding) {
      y = minPadding;
    }
    if (y + tooltipRect.height > parentRect.height - minPadding) {
      y = parentRect.height - tooltipRect.height - minPadding;
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