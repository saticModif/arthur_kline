import { useEffect, useRef, useState } from "react";

import MqttService from "@/services/MqttService";

import { loadTradingViewLibrary } from "./TradingViewLibrary";
import TradingViewDataFeed from "./TradingViewDataFeed";
import TradingViewOptions from "./TradingViewOptions";

export default function TradingViewContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvWidgetRef = useRef<any>(null); // 使用 useRef 保存 widget
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createTradingViewWidget = async () => {
      try {
        setLoading(true);
        setError(null);

        // 加载 Charting Library
        await loadTradingViewLibrary();

        // 建立 MQTT 连接
        const mqttClient = await MqttService.connect("ws://47.83.128.60:8083/mqtt");

        // 创建 DataFeed
        const symbol = "BTC/USDT"
        const datafeed = new TradingViewDataFeed("http://api.arthur.top/swap",
          { symbol: symbol }, mqttClient, 2);


        // 创建 TradingView widget
        const options = TradingViewOptions({ containerId: "TradingViewContainer", datafeed, symbol });
        if (tvWidgetRef.current === null) {
          tvWidgetRef.current = new window.TradingView.widget(options);
        }
        console.log("TradingView widget created")
      } catch (err: any) {
        console.error("TradingView 初始化失败:", err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    createTradingViewWidget();

    console.log("TradingViewContainer mounted")

    return () => {
      // 卸载时清理
      if (tvWidgetRef.current) {
        tvWidgetRef.current.remove();
        tvWidgetRef.current = null;
        console.log("TradingView widget removed")
      }
      console.log("TradingViewContainer unmounted")
    };
  }, []);

  if (loading) {
    return <div className="w-full h-[600px] flex justify-center items-center">Loading Chart...</div>;
  }

  if (error) {
    return (
      <div className="w-full h-[600px] flex justify-center items-center text-red-500">
        Failed to load chart: {error}
      </div>
    );
  }

  return <div id="TradingViewContainer" ref={containerRef} className="w-full h-full" />;
}

