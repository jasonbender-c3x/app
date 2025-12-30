/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    COLLABORATIVE EDITING WEBSOCKET HANDLER                 ║
 * ║         Real-time Cursor Sync, Edit Operations, and Voice Integration     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * This handler manages WebSocket connections for collaborative editing sessions.
 * It enables multiple participants (users and AI) to edit files together in real-time.
 * 
 * Features:
 * - Real-time cursor position sharing
 * - Edit operation broadcasting with OT conflict resolution
 * - Participant presence tracking
 * - Voice channel integration
 * 
 * Endpoints:
 * - /ws/collab/:sessionId - Join a collaborative session
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { db } from "./db";
import { collaborativeSessions, sessionParticipants, cursorPositions, editOperations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface CollabMessage {
  type: string;
  data?: unknown;
}

interface Participant {
  ws: WebSocket;
  id: string;
  displayName: string;
  avatarColor: string;
  participantType: "user" | "ai" | "guest";
  isActive: boolean;
}

interface TurnState {
  currentTurn: "user" | "ai";
  turnHolder?: string;
  turnStartedAt?: Date;
  turnHistory: Array<{
    participantId: string;
    action: string;
    timestamp: Date;
  }>;
}

interface Session {
  id: string;
  participants: Map<string, Participant>;
  fileVersions: Map<string, number>;
  pendingOperations: Map<string, EditOp[]>;
  turnState: TurnState;
  voiceEnabled: boolean;
  browserSessionId?: string;
}

interface EditOp {
  id: string;
  filePath: string;
  operationType: "insert" | "delete" | "replace";
  position: number;
  length?: number;
  text?: string;
  baseVersion: number;
  participantId: string;
}

interface CursorUpdate {
  participantId: string;
  filePath: string;
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

const sessions = new Map<string, Session>();

export function setupCollabWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url || "";
    
    if (url.startsWith("/ws/collab/")) {
      const sessionId = url.split("/ws/collab/")[1]?.split("?")[0];
      if (!sessionId) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
        handleCollabConnection(ws, sessionId, url);
      });
    }
  });

  console.log("[Collab WS] WebSocket server initialized");
}

async function handleCollabConnection(ws: WebSocket, sessionId: string, url: string): Promise<void> {
  const urlObj = new URL(url, "http://localhost");
  const displayName = urlObj.searchParams.get("name") || "Anonymous";
  const avatarColor = urlObj.searchParams.get("color") || getRandomColor();
  const participantType = (urlObj.searchParams.get("type") || "user") as "user" | "ai" | "guest";
  const userId = urlObj.searchParams.get("userId") || undefined;

  let session = sessions.get(sessionId);
  if (!session) {
    const [dbSession] = await db.select().from(collaborativeSessions).where(eq(collaborativeSessions.id, sessionId));
    if (!dbSession) {
      ws.close(4004, "Session not found");
      return;
    }
    
    session = {
      id: sessionId,
      participants: new Map(),
      fileVersions: new Map(),
      pendingOperations: new Map(),
      turnState: {
        currentTurn: "user",
        turnHistory: [],
      },
      voiceEnabled: false,
    };
    sessions.set(sessionId, session);
  }

  const [participant] = await db.insert(sessionParticipants).values({
    sessionId,
    userId,
    participantType,
    displayName,
    avatarColor,
    canEdit: true,
    canVoice: true,
    isActive: true,
  }).returning();

  const participantData: Participant = {
    ws,
    id: participant.id,
    displayName,
    avatarColor,
    participantType,
    isActive: true,
  };

  session.participants.set(participant.id, participantData);

  console.log(`[Collab WS] Participant joined: ${displayName} (${participant.id}) -> session ${sessionId}`);

  ws.send(JSON.stringify({
    type: "joined",
    data: {
      participantId: participant.id,
      sessionId,
      participants: Array.from(session.participants.values()).map(p => ({
        id: p.id,
        displayName: p.displayName,
        avatarColor: p.avatarColor,
        participantType: p.participantType,
      })),
      turnState: {
        currentTurn: session.turnState.currentTurn,
        turnHolder: session.turnState.turnHolder || null,
      },
    },
  }));

  broadcastToSession(session, {
    type: "participant_joined",
    data: {
      id: participant.id,
      displayName,
      avatarColor,
      participantType,
    },
  }, participant.id);

  ws.on("message", async (data) => {
    try {
      const message: CollabMessage = JSON.parse(data.toString());
      await handleMessage(session!, participant.id, message);
    } catch (error) {
      console.error("[Collab WS] Error handling message:", error);
    }
  });

  ws.on("close", async () => {
    await handleDisconnect(session!, participant.id);
  });

  ws.on("error", (error) => {
    console.error(`[Collab WS] WebSocket error for ${participant.id}:`, error);
  });
}

async function handleMessage(session: Session, participantId: string, message: CollabMessage): Promise<void> {
  switch (message.type) {
    case "cursor":
      await handleCursorUpdate(session, participantId, message.data as CursorUpdate);
      break;

    case "edit":
      await handleEditOperation(session, participantId, message.data as EditOp);
      break;

    case "file_open":
      handleFileOpen(session, participantId, message.data as { filePath: string });
      break;

    case "file_close":
      handleFileClose(session, participantId, message.data as { filePath: string });
      break;

    case "voice_start":
      broadcastToSession(session, {
        type: "voice_started",
        data: { participantId },
      }, participantId);
      break;

    case "voice_stop":
      broadcastToSession(session, {
        type: "voice_stopped",
        data: { participantId },
      }, participantId);
      break;

    case "voice_audio":
      broadcastToSession(session, {
        type: "voice_audio",
        data: { participantId, audio: (message.data as any).audio },
      }, participantId);
      break;

    case "ping":
      const participant = session.participants.get(participantId);
      if (participant) {
        participant.ws.send(JSON.stringify({ type: "pong" }));
      }
      break;

    case "turn_request":
      await handleTurnRequest(session, participantId);
      break;

    case "turn_release":
      await handleTurnRelease(session, participantId);
      break;

    case "turn_pass":
      await handleTurnPass(session, participantId, (message.data as any)?.toParticipantId);
      break;

    case "ai_action":
      await handleAIAction(session, participantId, message.data as any);
      break;

    case "screenshot":
      broadcastToSession(session, {
        type: "screenshot",
        data: { participantId, image: (message.data as any)?.image },
      });
      break;

    case "browser_action":
      await handleBrowserAction(session, participantId, message.data as any);
      break;
  }
}

async function handleCursorUpdate(session: Session, participantId: string, data: CursorUpdate): Promise<void> {
  broadcastToSession(session, {
    type: "cursor",
    data: {
      participantId,
      filePath: data.filePath,
      line: data.line,
      column: data.column,
      selection: data.selection,
    },
  }, participantId);

  await db.insert(cursorPositions).values({
    sessionId: session.id,
    participantId,
    filePath: data.filePath,
    line: data.line,
    column: data.column,
    selectionStartLine: data.selection?.startLine,
    selectionStartColumn: data.selection?.startColumn,
    selectionEndLine: data.selection?.endLine,
    selectionEndColumn: data.selection?.endColumn,
  }).onConflictDoUpdate({
    target: [cursorPositions.sessionId, cursorPositions.participantId, cursorPositions.filePath],
    set: {
      line: data.line,
      column: data.column,
      selectionStartLine: data.selection?.startLine,
      selectionStartColumn: data.selection?.startColumn,
      selectionEndLine: data.selection?.endLine,
      selectionEndColumn: data.selection?.endColumn,
    },
  }).catch(() => {
    db.insert(cursorPositions).values({
      sessionId: session.id,
      participantId,
      filePath: data.filePath,
      line: data.line,
      column: data.column,
    }).execute();
  });
}

async function handleEditOperation(session: Session, participantId: string, op: EditOp): Promise<void> {
  const participant = session.participants.get(participantId);
  if (!participant) return;

  const participantRole = participant.participantType === "ai" ? "ai" : "user";
  if (session.turnState.turnHolder && session.turnState.turnHolder !== participantId) {
    participant.ws.send(JSON.stringify({
      type: "edit_rejected",
      data: { id: op.id, reason: "Not your turn", currentTurn: session.turnState.currentTurn },
    }));
    return;
  }

  if (!session.turnState.turnHolder && session.turnState.currentTurn !== participantRole) {
    participant.ws.send(JSON.stringify({
      type: "edit_rejected",
      data: { id: op.id, reason: "Waiting for your turn", currentTurn: session.turnState.currentTurn },
    }));
    return;
  }

  const filePath = op.filePath;
  const currentVersion = session.fileVersions.get(filePath) || 0;

  if (op.baseVersion !== currentVersion) {
    const transformedOp = transformOperation(op, session.pendingOperations.get(filePath) || []);
    op = transformedOp;
  }

  const newVersion = currentVersion + 1;
  session.fileVersions.set(filePath, newVersion);

  if (!session.pendingOperations.has(filePath)) {
    session.pendingOperations.set(filePath, []);
  }
  session.pendingOperations.get(filePath)!.push(op);

  if (session.pendingOperations.get(filePath)!.length > 100) {
    session.pendingOperations.get(filePath)!.shift();
  }

  broadcastToSession(session, {
    type: "edit",
    data: {
      ...op,
      resultVersion: newVersion,
    },
  }, participantId);

  await db.insert(editOperations).values({
    sessionId: session.id,
    participantId,
    filePath: op.filePath,
    operationType: op.operationType,
    position: op.position,
    length: op.length,
    text: op.text,
    baseVersion: op.baseVersion,
    resultVersion: newVersion,
  });

  if (participant) {
    participant.ws.send(JSON.stringify({
      type: "edit_ack",
      data: { id: op.id, resultVersion: newVersion },
    }));
  }
}

function transformOperation(op: EditOp, pendingOps: EditOp[]): EditOp {
  let transformedPosition = op.position;

  for (const pending of pendingOps) {
    if (pending.baseVersion >= op.baseVersion) continue;

    if (pending.operationType === "insert" && pending.position <= transformedPosition) {
      transformedPosition += (pending.text?.length || 0);
    } else if (pending.operationType === "delete" && pending.position < transformedPosition) {
      const deleteEnd = pending.position + (pending.length || 0);
      if (deleteEnd <= transformedPosition) {
        transformedPosition -= (pending.length || 0);
      } else {
        transformedPosition = pending.position;
      }
    }
  }

  return { ...op, position: transformedPosition };
}

function handleFileOpen(session: Session, participantId: string, data: { filePath: string }): void {
  broadcastToSession(session, {
    type: "file_opened",
    data: { participantId, filePath: data.filePath },
  }, participantId);
}

function handleFileClose(session: Session, participantId: string, data: { filePath: string }): void {
  broadcastToSession(session, {
    type: "file_closed",
    data: { participantId, filePath: data.filePath },
  }, participantId);
}

async function handleDisconnect(session: Session, participantId: string): Promise<void> {
  const participant = session.participants.get(participantId);
  if (!participant) return;

  console.log(`[Collab WS] Participant left: ${participant.displayName} (${participantId})`);

  session.participants.delete(participantId);

  await db.update(sessionParticipants)
    .set({ isActive: false, leftAt: new Date() })
    .where(eq(sessionParticipants.id, participantId));

  broadcastToSession(session, {
    type: "participant_left",
    data: { participantId },
  });

  if (session.participants.size === 0) {
    sessions.delete(session.id);
    console.log(`[Collab WS] Session ${session.id} closed (no participants)`);
  }
}

function broadcastToSession(session: Session, message: object, excludeId?: string): void {
  const data = JSON.stringify(message);
  for (const [id, participant] of session.participants) {
    if (id !== excludeId && participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(data);
    }
  }
}

function getRandomColor(): string {
  const colors = [
    "#4285f4", "#ea4335", "#fbbc04", "#34a853",
    "#673ab7", "#e91e63", "#00bcd4", "#ff5722",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function handleTurnRequest(session: Session, participantId: string): Promise<void> {
  const participant = session.participants.get(participantId);
  if (!participant) return;

  const participantRole = participant.participantType === "ai" ? "ai" : "user";
  
  if (!session.turnState.turnHolder) {
    session.turnState.currentTurn = participantRole;
    session.turnState.turnHolder = participantId;
    session.turnState.turnStartedAt = new Date();
    
    broadcastToSession(session, {
      type: "turn_granted",
      data: {
        participantId,
        turnType: participantRole,
      },
    });
  } else if (session.turnState.turnHolder === participantId) {
    participant.ws.send(JSON.stringify({
      type: "turn_already_held",
      data: { participantId },
    }));
  } else {
    participant.ws.send(JSON.stringify({
      type: "turn_denied",
      data: {
        currentHolder: session.turnState.turnHolder,
        currentTurn: session.turnState.currentTurn,
      },
    }));
  }
}

async function handleTurnRelease(session: Session, participantId: string): Promise<void> {
  if (session.turnState.turnHolder !== participantId) return;

  session.turnState.turnHistory.push({
    participantId,
    action: "released",
    timestamp: new Date(),
  });

  session.turnState.turnHolder = undefined;
  session.turnState.turnStartedAt = undefined;
  
  const nextTurn = session.turnState.currentTurn === "user" ? "ai" : "user";
  session.turnState.currentTurn = nextTurn;

  broadcastToSession(session, {
    type: "turn_released",
    data: {
      releasedBy: participantId,
      nextTurn,
    },
  });
}

async function handleTurnPass(session: Session, fromParticipantId: string, toParticipantId?: string): Promise<void> {
  if (session.turnState.turnHolder !== fromParticipantId) return;

  session.turnState.turnHistory.push({
    participantId: fromParticipantId,
    action: "passed",
    timestamp: new Date(),
  });

  if (toParticipantId && session.participants.has(toParticipantId)) {
    const toParticipant = session.participants.get(toParticipantId)!;
    session.turnState.turnHolder = toParticipantId;
    session.turnState.currentTurn = toParticipant.participantType === "ai" ? "ai" : "user";
    session.turnState.turnStartedAt = new Date();
  } else {
    session.turnState.turnHolder = undefined;
    session.turnState.currentTurn = session.turnState.currentTurn === "user" ? "ai" : "user";
  }

  broadcastToSession(session, {
    type: "turn_passed",
    data: {
      from: fromParticipantId,
      to: toParticipantId || null,
      newTurn: session.turnState.currentTurn,
    },
  });
}

async function handleAIAction(session: Session, participantId: string, data: {
  actionType: "edit" | "analyze" | "suggest" | "explain";
  payload: any;
}): Promise<void> {
  const participant = session.participants.get(participantId);
  if (!participant || participant.participantType !== "ai") return;

  if (session.turnState.currentTurn !== "ai" && session.turnState.turnHolder !== participantId) {
    participant.ws.send(JSON.stringify({
      type: "ai_action_denied",
      data: { reason: "Not AI's turn" },
    }));
    return;
  }

  broadcastToSession(session, {
    type: "ai_action",
    data: {
      participantId,
      actionType: data.actionType,
      payload: data.payload,
    },
  });

  session.turnState.turnHistory.push({
    participantId,
    action: `ai_${data.actionType}`,
    timestamp: new Date(),
  });
}

async function handleBrowserAction(session: Session, participantId: string, data: {
  action: "navigate" | "click" | "type" | "screenshot" | "scroll";
  target?: string;
  value?: string;
}): Promise<void> {
  broadcastToSession(session, {
    type: "browser_action",
    data: {
      participantId,
      ...data,
    },
  });
}

export function getActiveSessions(): { id: string; participantCount: number }[] {
  return Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    participantCount: session.participants.size,
  }));
}

export function broadcastAIEdit(sessionId: string, filePath: string, operation: Omit<EditOp, "id" | "participantId" | "baseVersion">): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const aiParticipant = Array.from(session.participants.values()).find(p => p.participantType === "ai");
  if (!aiParticipant) return;

  const currentVersion = session.fileVersions.get(filePath) || 0;
  const op: EditOp = {
    id: `ai_${Date.now()}`,
    filePath,
    participantId: aiParticipant.id,
    baseVersion: currentVersion,
    ...operation,
  };

  handleEditOperation(session, aiParticipant.id, op);
}
