import pako from 'pako';

export class WsApiClient {
  public url: string | null = null;
  public retryCount: number = 0;
  public buildSubscribe?: (client: WsApiClient, topics: string[]) => Record<string, any>;
  public buildUnsubscribe?: (client: WsApiClient, topics: string[]) => Record<string, any>;
  public recvHandle?: (client: WsApiClient, data: Record<string, any>) => void;

  private _socket: WebSocket | null = null;
  private _topics: Map<string, WsApiTopic> = new Map();
  private _manuallyClosed: boolean = false;
  private _reconnectCount: number = 0;
  private _connectionPromise: Promise<void> | null = null;

  constructor(options: {
    url?: string;
    buildSubscribe?: (client: WsApiClient, topics: string[]) => Record<string, any>;
    buildUnsubscribe?: (client: WsApiClient, topics: string[]) => Record<string, any>;
    recvHandle?: (client: WsApiClient, data: Record<string, any>) => void;
    retryCount?: number;
  } = {}) {
    this.url = options.url ?? null;
    this.buildSubscribe = options.buildSubscribe;
    this.buildUnsubscribe = options.buildUnsubscribe;
    this.recvHandle = options.recvHandle;
    this.retryCount = options.retryCount ?? 0;
  }

  get isConnected(): boolean {
    return this._socket !== null && this._socket.readyState === WebSocket.OPEN;
  }

  getTopic(topic: string): WsApiTopic | undefined {
    return this._topics.get(topic);
  }

  // User interface: bulk subscribe (core implementation, single subscribe depends on this method)
  async subscribe(topics: string[]): Promise<(ReadableStream<any> | null)[]> {
    if (!this.url) throw new Error('WebSocket URL not set');
    if (!this.buildSubscribe) throw new Error('No buildSubscribe function provided');
    if (!this.recvHandle) throw new Error('No buildSubscribe function provided');
    
    if (!this.isConnected) {
      await this._connect();
      console.log(`websocket 连接成功 ==> ${this.url}`);
    }

    const streams: (ReadableStream<any> | null)[] = new Array(topics.length).fill(null);
    const newTopics: { topic: string; index: number; wsTopic: WsApiTopic }[] = [];

    topics.forEach((topic, idx) => {
      if (this._topics.has(topic)) {
        // 已订阅，直接放流
        streams[idx] = this._topics.get(topic)!.getStream();
      } else {
        // 新 topic，记录索引和 WsApiTopic
        const wsTopic = new WsApiTopic(topic);
        newTopics.push({ topic, index: idx, wsTopic });
        this._topics.set(topic, wsTopic);
      }
    });

    // 提前返回，如果没有新 topic
    if (newTopics.length === 0) return streams;

    try {
      const subscribeMsg = this.buildSubscribe?.(this, newTopics.map(t => t.topic));
      if (subscribeMsg) {
        await this.sendMessage(subscribeMsg);
        await this._waitForSubscriptionConfirmation(newTopics.map(t => t.topic));

        newTopics.forEach(({ topic, index, wsTopic }) => {
          if (wsTopic.isReady) {
            streams[index] = wsTopic.getStream();
          } else {
            this._topics.delete(topic);
          }
        });
      }
    } catch (e) {
      console.log(`subscribe ${topics} error`, e);
    }

    return streams;
  }

  // User interface: unsubscribe
  async unsubscribe(topics: string[]): Promise<void> {
    if (!this.url) throw new Error('WebSocket URL not set');
    if (!this.buildUnsubscribe) throw new Error('No buildSubscribe function provided');
    if (!this.isConnected) return;

    const validTopics = topics.filter((t) => this._topics.has(t));
    if (validTopics.length === 0 || !this.isConnected) return;

    try {
      await this.sendMessage(this.buildUnsubscribe(this, validTopics));
    } catch (error) {
      console.warn('Failed to send unsubscribe message:', error);
    }

    for (const t of validTopics) {
      const topic = this._topics.get(t);
      if (topic) {
        topic.close();
        this._topics.delete(t);
      }
    }

    if (this._topics.size === 0) {
      await this.reset();
    }
  }

  // User interface: send message
  async sendMessage(msg: Record<string, any>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const jsonString = JSON.stringify(msg);
    console.debug('<ws> send ==> ' + jsonString);

    try {
      this._socket!.send(jsonString);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    this._manuallyClosed = true;

    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }

    // Close all topics
    this._topics.forEach((topic: any) => topic.close());
    this._topics.clear();

    // Reset connection promise
    this._connectionPromise = null;
  }

  // ----------------- Internal private methods -----------------
  private async _connect(): Promise<void> {
    if (this._connectionPromise) {
      return this._connectionPromise;
    }

    if (!this.url) throw new Error('WebSocket URL not set');

    this._connectionPromise = new Promise(async (resolve, reject) => {
      console.debug('<ws> connect ==> ' + this.url);

      try {
        this._socket = new WebSocket(this.url!);
        this._manuallyClosed = false;
        this._reconnectCount = 0;

        this._socket.onopen = () => {
          console.debug('<ws> connected successfully');
          resolve();
        };

        this._socket.onmessage = (event: MessageEvent) => this._onMessage(event);
        this._socket.onclose = () => this._onDone();
        this._socket.onerror = (error: Event) => {
          console.error('WebSocket error:', error);
          this._onError(error);
          reject(new Error('WebSocket connection failed'));
        };

        // Set timeout for connection
        setTimeout(() => {
          if (this._socket?.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (e) {
        console.debug('<ws> connect failed: ' + e);
        console.error(`websocket 连接失败 ==> ${this.url}`, e);
        this._connectionPromise = null;
        reject(e);
      }
    });

    return this._connectionPromise;
  }

  private async _waitForSubscriptionConfirmation(topics: string[], timeout: number = 5000): Promise<void> {
    const promises = topics.map(topic => {
      const wsTopic = this._topics.get(topic);
      if (!wsTopic) {
        throw new Error(`Topic ${topic} not found`);
      }
      return wsTopic.waitForReady(timeout);
    });

    await Promise.all(promises);
  }

  private async _onMessage(event: MessageEvent) {
    try {
      let jsonString: string;

      const processBinaryData = (data: Uint8Array) => {
        const isGzip = data.length > 2 && data[0] === 0x1f && data[1] === 0x8b;
        if (isGzip) {
          // 解压 Gzip 数据
          const decoder = new TextDecoder();
          const decompressedData = pako.inflate(data);
          return decoder.decode(decompressedData);
        } else {
          return new TextDecoder().decode(data);
        }
      };

      if (event.data instanceof ArrayBuffer) {
        const data = new Uint8Array(event.data);
        jsonString = processBinaryData(data);
      } else if (event.data instanceof Blob) {
        const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(event.data);
        });
        const data = new Uint8Array(buffer);
        jsonString = processBinaryData(data);
      } else if (event.data instanceof ArrayBuffer) {
        const data = new Uint8Array(event.data);
        jsonString = processBinaryData(data);
      } else {
        jsonString = event.data;
      }

      console.debug('<ws> recv <== ' + jsonString);
      const jsonData = JSON.parse(jsonString);
      this.recvHandle!(this, jsonData);
    } catch (e) {
      console.error('Error processing WebSocket message:', e);
    }
  }

  private _onDone(): void {
    console.debug('WebSocket disconnected.');
    const wasConnected = this.isConnected;
    this._socket = null;
    this._connectionPromise = null;

    if (!this._manuallyClosed && wasConnected) {
      this._scheduleReconnect();
    }
  }

  private _onError(error: Event): void {
    console.debug('WebSocket error: ' + error);
    this._socket = null;
    this._connectionPromise = null;

    if (!this._manuallyClosed) {
      this._scheduleReconnect();
    }
  }

  private async _scheduleReconnect(): Promise<void> {
    if (this.retryCount <= 0) return;
    if (this._reconnectCount >= this.retryCount) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this._reconnectCount++;
    const delay = Math.min(3000 * Math.pow(2, this._reconnectCount - 1), 30000); // Exponential backoff, max 30s

    console.log(`Scheduling reconnection attempt ${this._reconnectCount}/${this.retryCount} in ${delay}ms`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this._connect();

      // Resubscribe to all topics after reconnection
      if (this.isConnected && this._topics.size > 0) {
        const topics = Array.from(this._topics.keys());
        console.log('Resubscribing to topics:', topics);

        // Reset all topics to pending state
        this._topics.forEach((topic: any) => topic.reset());

        await this.sendMessage(this.buildSubscribe!(this, topics));
        await this._waitForSubscriptionConfirmation(topics);
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }
}

export class WsApiTopic {
  public readonly topic: string;
  private _controller: ReadableStreamController<any> | null = null;
  private _stream: ReadableStream<any> | null = null;
  private _isReady: boolean = false;
  private _isClosed: boolean = false;
  private _readyResolve: (() => void) | null = null;
  private _readyPromise: Promise<void> | null = null;

  constructor(topic: string) {
    this.topic = topic;
    this._createStream();
  }

  private _createStream(): void {
    this._stream = new ReadableStream<any>({
      start: (controller) => {
        this._controller = controller;
        console.debug(`Stream created for topic: ${this.topic}`);
      },
      pull: (_controller) => {
        // Handle backpressure if needed
      },
      cancel: () => {
        console.debug(`Stream cancelled for topic: ${this.topic}`);
        this.close();
      },
    });

    // Initialize ready promise
    this._readyPromise = new Promise<void>((resolve) => {
      this._readyResolve = resolve;
    });
  }

  getStream(): ReadableStream<any> {
    if (!this._stream) {
      throw new Error(`Stream not available for topic: ${this.topic}`);
    }
    return this._stream;
  }

  waitForReady(timeout: number = 5000): Promise<void> {
    if (!this._readyPromise) {
      return Promise.reject(new Error(`Ready promise not initialized for topic: ${this.topic}`));
    }

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Subscription confirmation timeout for topic: ${this.topic}`));
      }, timeout);
    });

    return Promise.race([this._readyPromise, timeoutPromise]);
  }

  complete(): void {
    if (this._isClosed || this._isReady) return;

    this._isReady = true;
    console.debug(`Subscription confirmed for topic: ${this.topic}`);

    if (this._readyResolve) {
      this._readyResolve();
      this._readyResolve = null;
    }
  }

  close(): void {
    if (this._isClosed) return;

    this._isClosed = true;
    console.debug(`Closing topic: ${this.topic}`);

    // Close the controller if it exists
    if (this._controller) {
      try {
        this._controller.close();
      } catch (error) {
        console.warn(`Error closing controller for topic ${this.topic}:`, error);
      }
      this._controller = null;
    }

    // Resolve ready promise if not already resolved
    if (this._readyResolve) {
      this._readyResolve();
      this._readyResolve = null;
    }

    this._stream = null;
    this._readyPromise = null;
  }

  reset(): void {
    // Reset topic for reconnection
    console.debug(`Resetting topic: ${this.topic}`);
    this._isReady = false;

    // Close existing stream
    this.close();

    // Create new stream
    this._isClosed = false;
    this._createStream();
  }

  addData(data: any): void {
    if (this._isClosed || !this._controller) {
      console.warn(`Cannot add data to closed or uninitialized topic: ${this.topic}`);
      return;
    }

    try {
      this._controller.enqueue(data);
    } catch (error) {
      console.error(`Error adding data to topic ${this.topic}:`, error);
    }
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get isClosed(): boolean {
    return this._isClosed;
  }
}
