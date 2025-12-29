/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    DESKTOP COLLABORATION WEBSOCKET HANDLER                 ║
 * ║           Real-time Screen Sharing and Input Routing for AI Collab        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This handler manages WebSocket connections for the AI Desktop Collaboration feature.
 * It supports two types of clients:
 * 
 * 1. Desktop Agent (running on user's computer)
 *    - Connects to /ws/desktop/agent/:sessionId
 *    - Streams screen frames and audio to the relay
 *    - Receives mouse/keyboard input events
 * 
 * 2. Browser Viewer (user monitoring in web app)
 *    - Connects to /ws/desktop/browser/:sessionId
 *    - Receives screen frames for display
 *    - Sends user input events (if control mode allows)
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { desktopRelayService } from "./services/desktop-relay-service";

interface DesktopMessage {
  type: string;
  data?: unknown;
}

export function setupDesktopWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url || "";
    const urlObj = new URL(url, `http://${request.headers.host}`);
    const token = urlObj.searchParams.get("token");

    if (url.startsWith("/ws/desktop/agent/")) {
      if (!token) {
        console.log("[Desktop WS] Agent connection rejected: no token");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const sessionId = desktopRelayService.getSessionIdByToken(token);
      if (!sessionId) {
        console.log("[Desktop WS] Agent connection rejected: invalid token");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        handleAgentConnection(ws, sessionId);
      });
    } else if (url.startsWith("/ws/desktop/browser/")) {
      const sessionId = url.split("/ws/desktop/browser/")[1]?.split("?")[0];
      if (!sessionId) {
        socket.destroy();
        return;
      }

      const session = desktopRelayService.getSession(sessionId);
      if (!session) {
        console.log(`[Desktop WS] Browser connection rejected: session not found ${sessionId}`);
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        handleBrowserConnection(ws, sessionId);
      });
    }
  });

  console.log("[Desktop WS] WebSocket server initialized");
}

function handleAgentConnection(ws: WebSocket, sessionId: string): void {
  console.log(`[Desktop WS] Agent connected: ${sessionId}`);

  ws.on("message", (data) => {
    try {
      const message: DesktopMessage = JSON.parse(data.toString());

      switch (message.type) {
        case "register":
          desktopRelayService.registerAgent(sessionId, ws, message.data as any);
          break;

        case "frame":
          desktopRelayService.handleFrame(sessionId, message.data as any);
          break;

        case "audio":
          break;

        case "pong":
          break;

        default:
          console.log(`[Desktop WS] Unknown agent message type: ${message.type}`);
      }
    } catch (error) {
      console.error("[Desktop WS] Error parsing agent message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`[Desktop WS] Agent disconnected: ${sessionId}`);
    desktopRelayService.unregisterAgent(sessionId);
  });

  ws.on("error", (error) => {
    console.error(`[Desktop WS] Agent error for ${sessionId}:`, error);
  });
}

function handleBrowserConnection(ws: WebSocket, sessionId: string): void {
  console.log(`[Desktop WS] Browser connected: ${sessionId}`);

  desktopRelayService.registerBrowser(sessionId, ws);

  ws.on("message", (data) => {
    try {
      const message: DesktopMessage = JSON.parse(data.toString());

      switch (message.type) {
        case "input":
          desktopRelayService.sendInputToAgent(sessionId, {
            ...(message.data as any),
            source: "user",
          });
          break;

        case "control":
          const controlData = message.data as { mode: "user" | "ai" | "shared" };
          desktopRelayService.setControlMode(sessionId, controlData.mode);
          break;

        case "aiVision":
          const visionData = message.data as { enabled: boolean };
          desktopRelayService.setAiVision(sessionId, visionData.enabled);
          break;

        case "audio":
          const audioData = message.data as { enabled: boolean };
          desktopRelayService.setAudio(sessionId, audioData.enabled);
          break;

        default:
          console.log(`[Desktop WS] Unknown browser message type: ${message.type}`);
      }
    } catch (error) {
      console.error("[Desktop WS] Error parsing browser message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`[Desktop WS] Browser disconnected: ${sessionId}`);
    desktopRelayService.unregisterBrowser(sessionId, ws);
  });

  ws.on("error", (error) => {
    console.error(`[Desktop WS] Browser error for ${sessionId}:`, error);
  });
}

export function sendAiInputToDesktop(
  sessionId: string,
  event: {
    type: "mouse" | "keyboard";
    action: string;
    x?: number;
    y?: number;
    button?: string;
    key?: string;
    text?: string;
    delta?: number;
  }
): void {
  desktopRelayService.sendInputToAgent(sessionId, {
    ...event,
    source: "ai",
  } as any);
}
