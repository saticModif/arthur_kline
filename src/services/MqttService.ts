import mqtt from "mqtt"

class MqttService {
  private client: mqtt.MqttClient | null = null;

  async connect(url: string): Promise<mqtt.MqttClient> {
    // 如果已经连接，则直接返回当前客户端
    if (this.client && this.client.connected) {
      console.log(" MQTT already connected, returning existing client");
      return Promise.resolve(this.client);
    }

    const client = mqtt.connect(url, {
      clean: true,
      connectTimeout: 4000,
      clientId: "pc_emqx_" + Math.random().toString(16).slice(2),
      username: "13045778437",
      password: "123456",
      keepalive: 60,
    });

    return new Promise((resolve, reject) => {
      client.on("connect", () => {
        console.log("✅ MQTT connected:", url);
        this.client = client;
        resolve(client);
      });

      client.on("error", (err: Error) => {
        console.error("❌ MQTT connection error:", err.message);
        reject(err);
      });
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }

  getClient(): mqtt.MqttClient | null {
    return this.client;
  }

}

// 导出单例实例
export default new MqttService();