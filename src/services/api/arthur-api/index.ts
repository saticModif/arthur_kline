import { HttpApiClient, WsApiClient } from '../api-client';

import MarketApi from "./MarketApi";

export class ArthurApi {
  private http: HttpApiClient;
  private spotWs: WsApiClient;
  private futuresWs: WsApiClient;
  private lastTopicNames: string[] = [];

  public market: MarketApi;

  constructor() {
    this.http = new HttpApiClient({ baseURL: 'http://137.220.152.111' });

    this.spotWs = new WsApiClient({
      url: 'ws://137.220.152.111/exchange/webSocket/v2',
      buildSubscribe: this.buildSubscribe, buildUnsubscribe: this.buildUnsubscribe, recvHandle: this.recvHandle
    });

    this.futuresWs = new WsApiClient({
      url: 'ws://137.220.152.111/swap/contractWebSocket/v1',
      buildSubscribe: this.buildSubscribe, buildUnsubscribe: this.buildUnsubscribe, recvHandle: this.recvHandle
    });

    this.market = new MarketApi({ http: this.http, spotWs: this.spotWs, futuresWs: this.futuresWs });
  }

  private buildSubscribe(_ws: WsApiClient, topicNames: string[]): Record<string, any> {
    this.lastTopicNames = topicNames;
    return {
      type: "subscribe",
      subscribe: topicNames
    };
  }

  private buildUnsubscribe(_ws: WsApiClient, topicNames: string[]): Record<string, any> {
    this.lastTopicNames = topicNames;
    return {
      type: "unsubscribe",
      subscribe: topicNames
    };
  }

  private recvHandle(ws: WsApiClient, jsonData: any) {
    // 统一处理数组和对象格式数据
    const items = Array.isArray(jsonData) ? jsonData : [jsonData];

    for (const item of items) {
      if (!('topic' in item) || typeof item.topic !== 'string') continue;

      if (item.topic == 'subscribe') {
        this.lastTopicNames.forEach(topicName => {
          const wsTopic = ws.getTopic(topicName)
          wsTopic?.complete();
        })
      } else {
        const wsTopic = ws.getTopic(item.topic)
        wsTopic?.addData(item);
      }
    }
  }
}