/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     LIVE VOICE WEBSOCKET HANDLER                          ║
 * ║              Real-time Audio Streaming for Gemini Live API                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import * as geminiLive from "./integrations/gemini-live";

interface LiveWebSocketClient {
  ws: WebSocket;
  sessionId: string;
  isActive: boolean;
}

const activeClients = new Map<string, LiveWebSocketClient>();

export function setupLiveWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ 
    noServer: true
  });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url;
    
    if (url?.startsWith("/api/live/stream/")) {
      const sessionId = url.split("/api/live/stream/")[1]?.split("?")[0];
      
      if (!sessionId) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        handleConnection(ws, sessionId);
      });
    }
  });

  console.log("[Live WS] WebSocket server initialized");
}

async function handleConnection(ws: WebSocket, sessionId: string): Promise<void> {
  console.log(`[Live WS] Client connected: ${sessionId}`);

  const client: LiveWebSocketClient = {
    ws,
    sessionId,
    isActive: true,
  };

  activeClients.set(sessionId, client);

  startReceiving(client);

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "audio") {
        const result = await geminiLive.sendAudio(
          sessionId,
          message.data,
          message.mimeType || "audio/pcm"
        );

        if (!result.success) {
          sendError(ws, result.error || "Failed to send audio");
        }
      } else if (message.type === "text") {
        const result = await geminiLive.sendText(sessionId, message.text);

        if (!result.success) {
          sendError(ws, result.error || "Failed to send text");
        }
      } else if (message.type === "interrupt") {
        await geminiLive.interrupt(sessionId);
      } else if (message.type === "persona") {
        const result = await geminiLive.updateSystemInstruction(
          sessionId,
          message.systemInstruction
        );

        if (!result.success) {
          sendError(ws, result.error || "Failed to update persona");
        }
      }
    } catch (error) {
      console.error("[Live WS] Error processing message:", error);
      sendError(ws, "Invalid message format");
    }
  });

  ws.on("close", async () => {
    console.log(`[Live WS] Client disconnected: ${sessionId}`);
    client.isActive = false;
    activeClients.delete(sessionId);
    await geminiLive.closeLiveSession(sessionId);
  });

  ws.on("error", (error) => {
    console.error(`[Live WS] WebSocket error for ${sessionId}:`, error);
    client.isActive = false;
  });
}

async function startReceiving(client: LiveWebSocketClient): Promise<void> {
  try {
    for await (const response of geminiLive.receiveResponses(client.sessionId)) {
      if (!client.isActive || client.ws.readyState !== WebSocket.OPEN) {
        break;
      }

      if (response.type === "audio" && response.data) {
        sendMessage(client.ws, { type: "audio", data: response.data });
      } else if (response.type === "text" && response.text) {
        sendMessage(client.ws, { type: "text", text: response.text });
      } else if (response.type === "transcript" && response.text) {
        sendMessage(client.ws, { type: "transcript", text: response.text });
      } else if (response.type === "end") {
        sendMessage(client.ws, { type: "end" });
      }
    }
  } catch (error) {
    console.error(`[Live WS] Error receiving responses for ${client.sessionId}:`, error);
    if (client.isActive && client.ws.readyState === WebSocket.OPEN) {
      sendError(client.ws, "Connection to AI lost");
    }
  }
}

function sendMessage(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, error: string): void {
  sendMessage(ws, { type: "error", error });
}
