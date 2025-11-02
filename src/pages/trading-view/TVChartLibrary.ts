// 加载Tradingview 库 当前版本1.11
export const loadChartingLibrary = (path: string): Promise<void> => {
  // 如果库已经存在，直接返回 (resolve)
  if ((window as any).TradingView) {
    return Promise.resolve(); // 等价于 resolve()
  }

  const script = document.createElement("script");
  script.src = `${path}charting_library.min.js`;
  script.async = true;

  // 返回一个 Promise，并在 onload 或 onerror 时完成
  return new Promise((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Charting Library"));
    document.body.appendChild(script);
  });
};