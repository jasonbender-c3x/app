/**
 * useCollaborativeEditing Hook
 * 
 * Manages real-time collaborative editing sessions:
 * - WebSocket connection to /ws/collab/:sessionId
 * - Remote cursor decorations in Monaco
 * - Edit operation sync with OT conflict resolution
 * - Participant presence tracking
 * - Voice channel integration
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type * as Monaco from "monaco-editor";

export interface Participant {
  id: string;
  displayName: string;
  avatarColor: string;
  participantType: "user" | "ai" | "guest";
  cursorLine?: number;
  cursorColumn?: number;
  filePath?: string;
  isVoiceActive?: boolean;
}

export interface CollabSession {
  id: string;
  participants: Participant[];
  isConnected: boolean;
  myParticipantId: string | null;
}

interface CursorDecoration {
  participantId: string;
  decorationIds: string[];
  widgetId: string | null;
}

interface EditOperation {
  id: string;
  filePath: string;
  operationType: "insert" | "delete" | "replace";
  position: number;
  length?: number;
  text?: string;
  baseVersion: number;
}

interface UseCollaborativeEditingOptions {
  sessionId: string | null;
  displayName: string;
  avatarColor?: string;
  participantType?: "user" | "ai" | "guest";
  userId?: string;
  onRemoteEdit?: (filePath: string, operation: EditOperation) => void;
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onVoiceStarted?: (participantId: string) => void;
  onVoiceStopped?: (participantId: string) => void;
  onVoiceAudio?: (participantId: string, audio: string) => void;
}

export function useCollaborativeEditing(options: UseCollaborativeEditingOptions) {
  const {
    sessionId,
    displayName,
    avatarColor = getRandomColor(),
    participantType = "user",
    userId,
    onRemoteEdit,
    onParticipantJoined,
    onParticipantLeft,
    onVoiceStarted,
    onVoiceStopped,
    onVoiceAudio,
  } = options;

  const [session, setSession] = useState<CollabSession>({
    id: sessionId || "",
    participants: [],
    isConnected: false,
    myParticipantId: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const cursorDecorationsRef = useRef<Map<string, CursorDecoration>>(new Map());
  const fileVersionsRef = useRef<Map<string, number>>(new Map());
  const pendingAcksRef = useRef<Map<string, (version: number) => void>>(new Map());
  const currentFilePathRef = useRef<string>("");

  const connect = useCallback(() => {
    if (!sessionId || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({
      name: displayName,
      color: avatarColor,
      type: participantType,
      ...(userId && { userId }),
    });
    const wsUrl = `${protocol}//${window.location.host}/ws/collab/${sessionId}?${params}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Collab] Connected to session:", sessionId);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error("[Collab] Failed to parse message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[Collab] Disconnected from session");
      setSession(prev => ({ ...prev, isConnected: false }));
      clearAllCursorDecorations();
    };

    ws.onerror = (error) => {
      console.error("[Collab] WebSocket error:", error);
    };
  }, [sessionId, displayName, avatarColor, participantType, userId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    clearAllCursorDecorations();
  }, []);

  useEffect(() => {
    if (sessionId) {
      connect();
    }
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  const handleMessage = useCallback((message: { type: string; data: unknown }) => {
    switch (message.type) {
      case "joined": {
        const data = message.data as {
          participantId: string;
          sessionId: string;
          participants: Participant[];
        };
        setSession({
          id: data.sessionId,
          participants: data.participants,
          isConnected: true,
          myParticipantId: data.participantId,
        });
        break;
      }

      case "participant_joined": {
        const participant = message.data as Participant;
        setSession(prev => ({
          ...prev,
          participants: [...prev.participants, participant],
        }));
        onParticipantJoined?.(participant);
        break;
      }

      case "participant_left": {
        const { participantId } = message.data as { participantId: string };
        setSession(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.id !== participantId),
        }));
        removeCursorDecoration(participantId);
        onParticipantLeft?.(participantId);
        break;
      }

      case "cursor": {
        const cursorData = message.data as {
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
        };
        updateRemoteCursor(cursorData);
        break;
      }

      case "edit": {
        const editData = message.data as EditOperation & { resultVersion: number };
        fileVersionsRef.current.set(editData.filePath, editData.resultVersion);
        onRemoteEdit?.(editData.filePath, editData);
        break;
      }

      case "edit_ack": {
        const { id, resultVersion } = message.data as { id: string; resultVersion: number };
        const ackCallback = pendingAcksRef.current.get(id);
        if (ackCallback) {
          ackCallback(resultVersion);
          pendingAcksRef.current.delete(id);
        }
        break;
      }

      case "voice_started": {
        const { participantId } = message.data as { participantId: string };
        setSession(prev => ({
          ...prev,
          participants: prev.participants.map(p =>
            p.id === participantId ? { ...p, isVoiceActive: true } : p
          ),
        }));
        onVoiceStarted?.(participantId);
        break;
      }

      case "voice_stopped": {
        const { participantId } = message.data as { participantId: string };
        setSession(prev => ({
          ...prev,
          participants: prev.participants.map(p =>
            p.id === participantId ? { ...p, isVoiceActive: false } : p
          ),
        }));
        onVoiceStopped?.(participantId);
        break;
      }

      case "voice_audio": {
        const { participantId, audio } = message.data as { participantId: string; audio: string };
        onVoiceAudio?.(participantId, audio);
        break;
      }

      case "pong":
        break;
    }
  }, [onRemoteEdit, onParticipantJoined, onParticipantLeft, onVoiceStarted, onVoiceStopped, onVoiceAudio]);

  const send = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  const updateRemoteCursor = useCallback((data: {
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
  }) => {
    if (!editorRef.current || !monacoRef.current) return;
    if (data.filePath !== currentFilePathRef.current) return;

    const participant = session.participants.find(p => p.id === data.participantId);
    if (!participant) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const existingDecoration = cursorDecorationsRef.current.get(data.participantId);

    if (existingDecoration) {
      editor.deltaDecorations(existingDecoration.decorationIds, []);
    }

    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];

    decorations.push({
      range: new monaco.Range(data.line, data.column, data.line, data.column + 1),
      options: {
        className: `remote-cursor-${data.participantId}`,
        beforeContentClassName: `remote-cursor-line`,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    });

    if (data.selection) {
      decorations.push({
        range: new monaco.Range(
          data.selection.startLine,
          data.selection.startColumn,
          data.selection.endLine,
          data.selection.endColumn
        ),
        options: {
          className: `remote-selection`,
          inlineClassName: `remote-selection-inline`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    const decorationIds = editor.deltaDecorations([], decorations);

    injectCursorStyles(data.participantId, participant.avatarColor, participant.displayName);

    cursorDecorationsRef.current.set(data.participantId, {
      participantId: data.participantId,
      decorationIds,
      widgetId: null,
    });

    setSession(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.id === data.participantId
          ? { ...p, cursorLine: data.line, cursorColumn: data.column, filePath: data.filePath }
          : p
      ),
    }));
  }, [session.participants]);

  const removeCursorDecoration = useCallback((participantId: string) => {
    const decoration = cursorDecorationsRef.current.get(participantId);
    if (decoration && editorRef.current) {
      editorRef.current.deltaDecorations(decoration.decorationIds, []);
    }
    cursorDecorationsRef.current.delete(participantId);
  }, []);

  const clearAllCursorDecorations = useCallback(() => {
    if (editorRef.current) {
      for (const [, decoration] of cursorDecorationsRef.current) {
        editorRef.current.deltaDecorations(decoration.decorationIds, []);
      }
    }
    cursorDecorationsRef.current.clear();
  }, []);

  const sendCursorUpdate = useCallback((filePath: string, line: number, column: number, selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  }) => {
    currentFilePathRef.current = filePath;
    send("cursor", { filePath, line, column, selection });
  }, [send]);

  const sendEdit = useCallback((
    filePath: string,
    operationType: "insert" | "delete" | "replace",
    position: number,
    text?: string,
    length?: number
  ): Promise<number> => {
    return new Promise((resolve) => {
      const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const baseVersion = fileVersionsRef.current.get(filePath) || 0;

      pendingAcksRef.current.set(id, (version) => {
        fileVersionsRef.current.set(filePath, version);
        resolve(version);
      });

      send("edit", { id, filePath, operationType, position, text, length, baseVersion });
    });
  }, [send]);

  const openFile = useCallback((filePath: string) => {
    currentFilePathRef.current = filePath;
    send("file_open", { filePath });
  }, [send]);

  const closeFile = useCallback((filePath: string) => {
    send("file_close", { filePath });
    if (currentFilePathRef.current === filePath) {
      currentFilePathRef.current = "";
    }
  }, [send]);

  const startVoice = useCallback(() => {
    send("voice_start", {});
  }, [send]);

  const stopVoice = useCallback(() => {
    send("voice_stop", {});
  }, [send]);

  const sendVoiceAudio = useCallback((audio: string) => {
    send("voice_audio", { audio });
  }, [send]);

  const setEditor = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onDidChangeCursorPosition((e) => {
      if (!session.isConnected || !currentFilePathRef.current) return;

      const selection = editor.getSelection();
      const hasSelection = selection && !selection.isEmpty();

      sendCursorUpdate(
        currentFilePathRef.current,
        e.position.lineNumber,
        e.position.column,
        hasSelection ? {
          startLine: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLine: selection.endLineNumber,
          endColumn: selection.endColumn,
        } : undefined
      );
    });
  }, [session.isConnected, sendCursorUpdate]);

  return {
    session,
    connect,
    disconnect,
    setEditor,
    sendCursorUpdate,
    sendEdit,
    openFile,
    closeFile,
    startVoice,
    stopVoice,
    sendVoiceAudio,
  };
}

function getRandomColor(): string {
  const colors = [
    "#4285f4", "#ea4335", "#fbbc04", "#34a853",
    "#673ab7", "#e91e63", "#00bcd4", "#ff5722",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function injectCursorStyles(participantId: string, color: string, displayName: string): void {
  const styleId = `collab-cursor-style-${participantId}`;
  let styleEl = document.getElementById(styleId);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    .remote-cursor-${participantId}::before {
      content: "";
      position: absolute;
      width: 2px;
      height: 1.2em;
      background-color: ${color};
      animation: cursorBlink 1s ease-in-out infinite;
    }
    .remote-cursor-${participantId}::after {
      content: "${displayName}";
      position: absolute;
      top: -1.4em;
      left: 0;
      background-color: ${color};
      color: white;
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 3px;
      white-space: nowrap;
      z-index: 1000;
    }
    .remote-selection {
      background-color: ${color}33;
    }
    @keyframes cursorBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
}

export async function createCollabSession(filePath?: string): Promise<{ sessionId: string } | null> {
  try {
    const response = await fetch("/api/collab/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });
    if (!response.ok) throw new Error("Failed to create session");
    return await response.json();
  } catch (error) {
    console.error("Failed to create collaborative session:", error);
    return null;
  }
}

export async function joinCollabSession(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/collab/sessions/${sessionId}/join`, {
      method: "POST",
    });
    return response.ok;
  } catch {
    return false;
  }
}
