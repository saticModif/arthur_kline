let tradingViewLibraryPromise: Promise<void> | null = null;

export function loadTradingViewLibrary(): Promise<void> {
  if (!tradingViewLibraryPromise) {
    tradingViewLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/js/charting_library/charting_library.min.js";
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
      console.log("Charting library loaded");
    });
  }
  return tradingViewLibraryPromise;
}
