/**
 * Meowstik Desktop Agent
 * 
 * This agent runs on the user's computer and provides:
 * 1. Screen capture - Captures desktop framebuffer and streams to relay
 * 2. Audio capture - Captures system audio and streams to relay
 * 3. Input injection - Receives mouse/keyboard events from relay and injects them
 * 4. WebSocket connection - Maintains persistent connection to Meowstik relay
 * 
 * Data Flow:
 * - Desktop → Agent → Relay → [LLM Vision + User Browser]
 * - [LLM Commands + User Commands] → Relay → Agent → Desktop Input
 */

import WebSocket from 'ws';
import * as os from 'os';

interface AgentConfig {
  relayUrl: string;
  token: string;
  captureInterval: number;
  quality: number;
}

interface ScreenFrame {
  timestamp: number;
  width: number;
  height: number;
  data: string;
}

interface InputEvent {
  type: 'mouse' | 'keyboard';
  action: 'move' | 'click' | 'scroll' | 'keydown' | 'keyup' | 'type';
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string;
  text?: string;
  delta?: number;
}

interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  memory: number;
  screens: { width: number; height: number }[];
}

class DesktopAgent {
  private ws: WebSocket | null = null;
  private config: AgentConfig;
  private captureInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnected = false;
  private frameCount = 0;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    console.log('🐱 Meowstik Desktop Agent starting...');
    console.log(`📡 Connecting to relay: ${this.config.relayUrl}`);
    
    await this.connect();
  }

  private async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.config.relayUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        },
      });

      this.ws.on('open', () => this.onConnected());
      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('close', () => this.onDisconnected());
      this.ws.on('error', (err) => this.onError(err));

    } catch (error) {
      console.error('Connection failed:', error);
      this.scheduleReconnect();
    }
  }

  private async onConnected(): Promise<void> {
    this.isConnected = true;
    console.log('✅ Connected to relay');

    const systemInfo = await this.getSystemInfo();
    this.send({ type: 'register', data: systemInfo });

    this.startScreenCapture();
  }

  private onDisconnected(): void {
    this.isConnected = false;
    console.log('❌ Disconnected from relay');
    this.stopScreenCapture();
    this.scheduleReconnect();
  }

  private onError(error: Error): void {
    console.error('WebSocket error:', error.message);
  }

  private onMessage(data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'input':
          this.handleInputEvent(message.data as InputEvent);
          break;
        case 'ping':
          this.send({ type: 'pong' });
          break;
        case 'config':
          this.updateConfig(message.data);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private handleInputEvent(event: InputEvent): void {
    console.log(`🎮 Input event: ${event.type} - ${event.action}`);
    
    // NOTE: robotjs integration would go here for actual input injection
    // This is a placeholder for the actual implementation
    switch (event.type) {
      case 'mouse':
        if (event.action === 'move' && event.x !== undefined && event.y !== undefined) {
          // robot.moveMouse(event.x, event.y);
          console.log(`  Mouse move to (${event.x}, ${event.y})`);
        } else if (event.action === 'click') {
          // robot.mouseClick(event.button || 'left');
          console.log(`  Mouse click: ${event.button || 'left'}`);
        } else if (event.action === 'scroll' && event.delta !== undefined) {
          // robot.scrollMouse(0, event.delta);
          console.log(`  Mouse scroll: ${event.delta}`);
        }
        break;
      case 'keyboard':
        if (event.action === 'type' && event.text) {
          // robot.typeString(event.text);
          console.log(`  Type: "${event.text}"`);
        } else if (event.action === 'keydown' && event.key) {
          // robot.keyToggle(event.key, 'down');
          console.log(`  Key down: ${event.key}`);
        } else if (event.action === 'keyup' && event.key) {
          // robot.keyToggle(event.key, 'up');
          console.log(`  Key up: ${event.key}`);
        }
        break;
    }
  }

  private startScreenCapture(): void {
    console.log(`📸 Starting screen capture (interval: ${this.config.captureInterval}ms)`);
    
    this.captureInterval = setInterval(async () => {
      try {
        const frame = await this.captureScreen();
        this.send({ type: 'frame', data: frame });
        this.frameCount++;
        
        if (this.frameCount % 30 === 0) {
          console.log(`📊 Frames sent: ${this.frameCount}`);
        }
      } catch (error) {
        console.error('Screen capture failed:', error);
      }
    }, this.config.captureInterval);
  }

  private stopScreenCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  private async captureScreen(): Promise<ScreenFrame> {
    // NOTE: screenshot-desktop integration would go here
    // This is a placeholder that returns mock data
    return {
      timestamp: Date.now(),
      width: 1920,
      height: 1080,
      data: '', // Base64 encoded JPEG/PNG would go here
    };
  }

  private async getSystemInfo(): Promise<SystemInfo> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      screens: [{ width: 1920, height: 1080 }], // Would use systeminformation here
    };
  }

  private updateConfig(newConfig: Partial<AgentConfig>): void {
    if (newConfig.captureInterval && newConfig.captureInterval !== this.config.captureInterval) {
      this.config.captureInterval = newConfig.captureInterval;
      this.stopScreenCapture();
      this.startScreenCapture();
    }
    if (newConfig.quality) {
      this.config.quality = newConfig.quality;
    }
    console.log('⚙️ Config updated:', newConfig);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    
    console.log('🔄 Scheduling reconnect in 5 seconds...');
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }

  private send(message: object): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  stop(): void {
    console.log('🛑 Stopping agent...');
    this.stopScreenCapture();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

// CLI Entry Point
if (require.main === module) {
  const args = process.argv.slice(2);
  const tokenIndex = args.indexOf('--token');
  const urlIndex = args.indexOf('--relay');
  
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : process.env.MEOWSTIK_TOKEN || '';
  const relayUrl = urlIndex !== -1 ? args[urlIndex + 1] : process.env.MEOWSTIK_RELAY || 'wss://your-meowstik-instance.replit.app/ws/desktop';
  
  if (!token) {
    console.error('❌ Error: --token is required');
    console.error('Usage: meowstik-agent --token YOUR_TOKEN [--relay wss://...]');
    process.exit(1);
  }

  const agent = new DesktopAgent({
    relayUrl,
    token,
    captureInterval: 100, // 10 FPS
    quality: 80,
  });

  process.on('SIGINT', () => {
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    agent.stop();
    process.exit(0);
  });

  agent.start().catch((error) => {
    console.error('Failed to start agent:', error);
    process.exit(1);
  });
}

export { DesktopAgent, AgentConfig, InputEvent, ScreenFrame };
