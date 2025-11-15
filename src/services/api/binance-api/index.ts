import { HttpApiClient, WsApiClient } from '../api-client';

import MarketApi from "./MarketApi";

export class BinanceApi {
  private spotHttp: HttpApiClient;
  private futuresHttp: HttpApiClient;
  private spotWs: WsApiClient;
  private futuresWs: WsApiClient;
  private lastTopicNames: string[] = [];

  public market: MarketApi;

  constructor() {
    // 现货 API 使用 api.binance.com
    this.spotHttp = new HttpApiClient({
      baseURL: 'https://api.binance.com'
    });

    // 合约 API 使用 fapi.binance.com
    this.futuresHttp = new HttpApiClient({
      baseURL: 'https://fapi.binance.com'
    });

    this.spotWs = new WsApiClient({
      url: 'wss://stream.binance.com:9443/ws',
      buildSubscribe: this.buildSpotSubscribe,
      buildUnsubscribe: this.buildSpotUnsubscribe,
      recvHandle: this.recvHandle
    });

    this.futuresWs = new WsApiClient({
      url: 'wss://fstream.binance.com/ws',
      buildSubscribe: this.buildFuturesSubscribe,
      buildUnsubscribe: this.buildFuturesUnsubscribe,
      recvHandle: this.recvHandle
    });

    this.market = new MarketApi({
      spotHttp: this.spotHttp,
      futuresHttp: this.futuresHttp,
      spotWs: this.spotWs,
      futuresWs: this.futuresWs
    });
  }

  private buildSpotSubscribe(_ws: WsApiClient, topicNames: string[]): Record<string, any> {
    this.lastTopicNames = topicNames;
    // Binance spot WebSocket expects subscribe method with params array
    return {
      method: "SUBSCRIBE",
      params: topicNames,
      id: Date.now()
    };
  }

  private buildSpotUnsubscribe(_ws: WsApiClient, topicNames: string[]): Record<string, any> {
    this.lastTopicNames = topicNames;
    return {
      method: "UNSUBSCRIBE",
      params: topicNames,
      id: Date.now()
    };
  }

  private buildFuturesSubscribe(_ws: WsApiClient, topicNames: string[]): Record<string, any> {
    this.lastTopicNames = topicNames;
    // Binance futures WebSocket also uses subscribe method
    return {
      method: "SUBSCRIBE",
      params: topicNames,
      id: Date.now()
    };
  }

  private buildFuturesUnsubscribe(_ws: WsApiClient, topicNames: string[]): Record<string, any> {
    this.lastTopicNames = topicNames;
    return {
      method: "UNSUBSCRIBE",
      params: topicNames,
      id: Date.now()
    };
  }

  private recvHandle(ws: WsApiClient, jsonData: any) {
    // Binance WebSocket response format handling

    // Handle subscription confirmation
    if (jsonData.result !== undefined && jsonData.id !== undefined) {
      this.lastTopicNames.forEach(topicName => {
        const wsTopic = ws.getTopic(topicName)
        wsTopic?.complete();
      })
      return;
    }

    // Handle actual data messages
    if (jsonData.stream) {
      const streamName = jsonData.stream;
      const wsTopic = ws.getTopic(streamName);
      wsTopic?.addData(jsonData);
    }

    // Handle individual kline updates (for compatibility)
    if (jsonData && jsonData.e == 'kline' && jsonData.k) {
      // Try to match with existing topic
      const symbol = jsonData.s?.toLowerCase();
      
      if (symbol) {
        const interval = jsonData.k.i ?? '';
        const topic = `${symbol}@kline_${interval}`; 
        const wsTopic = ws.getTopic(topic);
        wsTopic?.addData(jsonData);
      }
    }
  }
}