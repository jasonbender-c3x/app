/**
 * Desktop Relay Service
 * 
 * This service acts as the cloud relay between:
 * 1. Desktop Agent (running on user's computer)
 * 2. LLM Vision API (Gemini with vision)
 * 3. Web Browser (user monitoring)
 * 
 * Data Flow:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Desktop Agent                                               │
 * │       │                                                      │
 * │       ▼ (WebSocket: frames, audio)                          │
 * │  ┌─────────────────┐                                        │
 * │  │  Desktop Relay  │──► Gemini Vision API (frame batches)   │
 * │  │    Service      │                                        │
 * │  │                 │──► Web Browser (WebSocket stream)      │
 * │  └─────────────────┘                                        │
 * │       ▲                                                      │
 * │       │ (input events: mouse, keyboard)                     │
 * │  LLM Commands + User Commands                               │
 * └─────────────────────────────────────────────────────────────┘
 */

import WebSocket from 'ws';

interface DesktopSession {
  id: string;
  agentWs: WebSocket | null;
  browserWs: Set<WebSocket>;
  systemInfo: SystemInfo | null;
  lastFrame: ScreenFrame | null;
  frameHistory: ScreenFrame[];
  createdAt: Date;
  controlling: 'user' | 'ai' | 'shared';
  aiVisionEnabled: boolean;
  audioEnabled: boolean;
}

interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  memory: number;
  screens: { width: number; height: number }[];
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
  source: 'user' | 'ai';
}

interface RelayMessage {
  type: string;
  sessionId?: string;
  data?: unknown;
}

class DesktopRelayService {
  private sessions: Map<string, DesktopSession> = new Map();
  private tokenToSession: Map<string, string> = new Map();
  private frameBufferSize = 10;
  private visionBatchSize = 5;
  private visionBatchInterval = 1000;

  createSession(token: string): string {
    const sessionId = this.generateSessionId();
    const session: DesktopSession = {
      id: sessionId,
      agentWs: null,
      browserWs: new Set(),
      systemInfo: null,
      lastFrame: null,
      frameHistory: [],
      createdAt: new Date(),
      controlling: 'shared',
      aiVisionEnabled: true,
      audioEnabled: true,
    };
    
    this.sessions.set(sessionId, session);
    this.tokenToSession.set(token, sessionId);
    
    console.log(`[DesktopRelay] Session created: ${sessionId}`);
    return sessionId;
  }

  getSessionByToken(token: string): DesktopSession | undefined {
    const sessionId = this.tokenToSession.get(token);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return undefined;
  }

  getSession(sessionId: string): DesktopSession | undefined {
    return this.sessions.get(sessionId);
  }

  registerAgent(sessionId: string, ws: WebSocket, systemInfo: SystemInfo): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[DesktopRelay] Session not found: ${sessionId}`);
      return;
    }

    session.agentWs = ws;
    session.systemInfo = systemInfo;
    
    this.broadcastToBrowsers(session, {
      type: 'agent_connected',
      data: { systemInfo },
    });

    console.log(`[DesktopRelay] Agent registered for session ${sessionId}: ${systemInfo.hostname} (${systemInfo.platform})`);
  }

  registerBrowser(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[DesktopRelay] Session not found: ${sessionId}`);
      return;
    }

    session.browserWs.add(ws);

    const status = {
      type: 'session_status',
      data: {
        agentConnected: session.agentWs !== null,
        systemInfo: session.systemInfo,
        controlling: session.controlling,
        aiVisionEnabled: session.aiVisionEnabled,
        audioEnabled: session.audioEnabled,
      },
    };
    ws.send(JSON.stringify(status));

    console.log(`[DesktopRelay] Browser registered for session ${sessionId}. Total browsers: ${session.browserWs.size}`);
  }

  unregisterAgent(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.agentWs = null;
    session.systemInfo = null;
    
    this.broadcastToBrowsers(session, {
      type: 'agent_disconnected',
    });

    console.log(`[DesktopRelay] Agent disconnected from session ${sessionId}`);
  }

  unregisterBrowser(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.browserWs.delete(ws);
    console.log(`[DesktopRelay] Browser disconnected from session ${sessionId}. Remaining: ${session.browserWs.size}`);
  }

  async handleFrame(sessionId: string, frame: ScreenFrame): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastFrame = frame;
    session.frameHistory.push(frame);
    
    if (session.frameHistory.length > this.frameBufferSize) {
      session.frameHistory.shift();
    }

    this.broadcastToBrowsers(session, {
      type: 'frame',
      data: frame,
    });

    if (session.aiVisionEnabled && session.frameHistory.length >= this.visionBatchSize) {
      await this.sendToVision(session);
    }
  }

  private async sendToVision(session: DesktopSession): Promise<void> {
    if (!session.lastFrame || !session.lastFrame.data) return;

    try {
      console.log(`[DesktopRelay] Sending frame to Gemini Vision for session ${session.id}`);
      
    } catch (error) {
      console.error('[DesktopRelay] Vision API error:', error);
    }
  }

  sendInputToAgent(sessionId: string, event: InputEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.agentWs) {
      console.error(`[DesktopRelay] Cannot send input: no agent for session ${sessionId}`);
      return;
    }

    if (session.controlling === 'user' && event.source === 'ai') {
      console.log(`[DesktopRelay] Ignoring AI input: user has control`);
      return;
    }
    if (session.controlling === 'ai' && event.source === 'user') {
      console.log(`[DesktopRelay] Ignoring user input: AI has control`);
      return;
    }

    session.agentWs.send(JSON.stringify({
      type: 'input',
      data: event,
    }));

    this.broadcastToBrowsers(session, {
      type: 'input_event',
      data: { ...event, timestamp: Date.now() },
    });
  }

  setControlMode(sessionId: string, mode: 'user' | 'ai' | 'shared'): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.controlling = mode;
    
    this.broadcastToBrowsers(session, {
      type: 'control_changed',
      data: { controlling: mode },
    });

    console.log(`[DesktopRelay] Control mode for session ${sessionId}: ${mode}`);
  }

  setAiVision(sessionId: string, enabled: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.aiVisionEnabled = enabled;
    console.log(`[DesktopRelay] AI Vision for session ${sessionId}: ${enabled}`);
  }

  setAudio(sessionId: string, enabled: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.audioEnabled = enabled;
    console.log(`[DesktopRelay] Audio for session ${sessionId}: ${enabled}`);
  }

  private broadcastToBrowsers(session: DesktopSession, message: object): void {
    const payload = JSON.stringify(message);
    session.browserWs.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.agentWs) {
      session.agentWs.close();
    }
    session.browserWs.forEach((ws) => {
      ws.close();
    });

    this.sessions.delete(sessionId);
    
    this.tokenToSession.forEach((id, token) => {
      if (id === sessionId) {
        this.tokenToSession.delete(token);
      }
    });

    console.log(`[DesktopRelay] Session destroyed: ${sessionId}`);
  }

  getActiveSessions(): { id: string; agentConnected: boolean; browsers: number; createdAt: Date }[] {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      agentConnected: s.agentWs !== null,
      browsers: s.browserWs.size,
      createdAt: s.createdAt,
    }));
  }

  private generateSessionId(): string {
    return 'ds_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

export const desktopRelayService = new DesktopRelayService();
