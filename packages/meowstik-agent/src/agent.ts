import WebSocket from "ws";
import os from "os";
import { ScreenCapture } from "./screen-capture.js";
import { InputHandler } from "./input-handler.js";

export interface AgentConfig {
  token: string;
  serverUrl: string;
  fps: number;
  quality: number;
  enableAudio: boolean;
  enableInput: boolean;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  memory: number;
  screens: Array<{ width: number; height: number }>;
}

export class DesktopAgent {
  private config: AgentConfig;
  private ws: WebSocket | null = null;
  private screenCapture: ScreenCapture;
  private inputHandler: InputHandler;
  private isConnected = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(config: AgentConfig) {
    this.config = config;
    this.screenCapture = new ScreenCapture(config.quality);
    this.inputHandler = new InputHandler();
  }

  async connect(): Promise<void> {
    const wsUrl = `${this.config.serverUrl}/ws/desktop/agent?token=${this.config.token}`;
    
    console.log(`Connecting to ${wsUrl}...`);
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => {
        console.log("Connected to server");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.register();
        this.startCapture();
        resolve();
      });

      this.ws.on("message", (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on("close", (code, reason) => {
        console.log(`Disconnected: ${code} - ${reason}`);
        this.isConnected = false;
        this.stopCapture();
        this.attemptReconnect();
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error.message);
        if (!this.isConnected) {
          reject(error);
        }
      });
    });
  }

  private register(): void {
    const systemInfo: SystemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      screens: [{ width: 1920, height: 1080 }],
    };

    this.send("register", systemInfo);
    console.log(`Registered: ${systemInfo.hostname} (${systemInfo.platform}/${systemInfo.arch})`);
  }

  private startCapture(): void {
    const interval = Math.round(1000 / this.config.fps);
    
    console.log(`Starting screen capture at ${this.config.fps} FPS...`);
    
    this.captureInterval = setInterval(async () => {
      if (!this.isConnected) return;

      try {
        const frame = await this.screenCapture.capture();
        if (frame) {
          this.send("frame", {
            width: frame.width,
            height: frame.height,
            data: frame.data,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error("Capture error:", error);
      }
    }, interval);
  }

  private stopCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case "input":
          if (this.config.enableInput) {
            this.inputHandler.handleInput(message.data);
          }
          break;

        case "ping":
          this.send("pong", {});
          break;

        case "config":
          console.log("Received config update:", message.data);
          break;

        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }

  private send(type: string, data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      process.exit(1);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    await new Promise((resolve) => setTimeout(resolve, delay));
    
    try {
      await this.connect();
    } catch (error) {
      console.error("Reconnection failed:", error);
    }
  }

  async disconnect(): Promise<void> {
    this.stopCapture();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
