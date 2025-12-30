/**
 * Collaborative Editing Integration Service
 * 
 * Unifies turn-based Monaco editing with:
 * - Computer-use (vision analysis, screen observation)
 * - Live voice conversation (Gemini Live API)
 * - Playwright browser automation
 * - Web page tooling
 * 
 * The AI observes, discusses, and edits code collaboratively with the user.
 */

import { ComputerUseService, ComputerAction, ComputerState } from "./computer-use";
import * as geminiLive from "../integrations/gemini-live";

export interface CollabTurn {
  type: 'user' | 'ai';
  action: 'edit' | 'cursor' | 'selection' | 'voice' | 'screenshot' | 'browser_action' | 'chat';
  timestamp: Date;
  data: any;
}

export interface CollabSessionState {
  sessionId: string;
  currentTurn: 'user' | 'ai';
  turnHistory: CollabTurn[];
  editorContent: string;
  filePath?: string;
  liveSessionId?: string;
  playwrightSessionId?: string;
  lastScreenshot?: string;
  isVoiceActive: boolean;
  participants: Array<{
    id: string;
    name: string;
    type: 'human' | 'ai';
    isActive: boolean;
  }>;
}

export class CollabIntegrationService {
  private computerUse = new ComputerUseService();
  private sessions = new Map<string, CollabSessionState>();

  /**
   * Initialize a new collaborative session with all integrations
   */
  async initSession(sessionId: string, options: {
    filePath?: string;
    enableVoice?: boolean;
    enableBrowser?: boolean;
  } = {}): Promise<CollabSessionState> {
    const state: CollabSessionState = {
      sessionId,
      currentTurn: 'user',
      turnHistory: [],
      editorContent: '',
      filePath: options.filePath,
      isVoiceActive: false,
      participants: [
        { id: 'user-1', name: 'User', type: 'human', isActive: true },
        { id: 'ai-1', name: 'Meowstik', type: 'ai', isActive: true }
      ]
    };

    if (options.enableVoice) {
      try {
        const liveResult = await geminiLive.initLiveSession(`collab-${sessionId}`, {
          model: 'gemini-2.0-flash-live-001'
        });
        if (liveResult.success) {
          state.liveSessionId = `collab-${sessionId}`;
          state.isVoiceActive = true;
        }
      } catch (e) {
        console.warn('[CollabIntegration] Voice init failed:', e);
      }
    }

    if (options.enableBrowser) {
      state.playwrightSessionId = `collab-browser-${sessionId}`;
    }

    this.sessions.set(sessionId, state);
    return state;
  }

  /**
   * Process a turn in the collaborative session
   */
  async processTurn(sessionId: string, turn: Omit<CollabTurn, 'timestamp'>): Promise<{
    success: boolean;
    nextTurn: 'user' | 'ai';
    aiResponse?: any;
  }> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      return { success: false, nextTurn: 'user' };
    }

    const fullTurn: CollabTurn = { ...turn, timestamp: new Date() };
    state.turnHistory.push(fullTurn);

    if (turn.type === 'user') {
      state.currentTurn = 'ai';
      
      const aiResponse = await this.generateAiTurn(state, turn);
      
      if (aiResponse) {
        state.turnHistory.push({
          type: 'ai',
          action: aiResponse.action,
          timestamp: new Date(),
          data: aiResponse.data
        });
        state.currentTurn = 'user';
        return { success: true, nextTurn: 'user', aiResponse };
      }
      
      return { success: true, nextTurn: 'ai' };
    }

    return { success: true, nextTurn: state.currentTurn };
  }

  /**
   * Generate AI response based on current state and user turn
   */
  private async generateAiTurn(state: CollabSessionState, userTurn: Omit<CollabTurn, 'timestamp'>): Promise<{
    action: CollabTurn['action'];
    data: any;
  } | null> {
    switch (userTurn.action) {
      case 'edit':
        return this.handleUserEdit(state, userTurn.data);
      case 'voice':
        return this.handleVoiceInput(state, userTurn.data);
      case 'chat':
        return this.handleChatInput(state, userTurn.data);
      case 'screenshot':
        return this.handleScreenshotRequest(state);
      default:
        return null;
    }
  }

  /**
   * Handle user edit - AI analyzes and suggests improvements
   */
  private async handleUserEdit(state: CollabSessionState, editData: {
    content: string;
    range?: { startLine: number; endLine: number };
  }): Promise<{ action: CollabTurn['action']; data: any }> {
    state.editorContent = editData.content;
    
    return {
      action: 'chat',
      data: {
        message: 'I see your edit. Ready for your next instruction or I can suggest improvements.',
        context: 'edit_acknowledged'
      }
    };
  }

  /**
   * Handle voice input - route to Gemini Live
   */
  private async handleVoiceInput(state: CollabSessionState, voiceData: {
    audio?: string;
    text?: string;
  }): Promise<{ action: CollabTurn['action']; data: any } | null> {
    if (!state.liveSessionId) {
      return {
        action: 'chat',
        data: { message: 'Voice mode not active. Enable voice to use this feature.' }
      };
    }

    if (voiceData.text) {
      await geminiLive.sendText(state.liveSessionId, voiceData.text);
    } else if (voiceData.audio) {
      await geminiLive.sendAudio(state.liveSessionId, voiceData.audio, 'audio/pcm');
    }

    return null;
  }

  /**
   * Handle chat input - generate AI response
   */
  private async handleChatInput(state: CollabSessionState, chatData: {
    message: string;
  }): Promise<{ action: CollabTurn['action']; data: any }> {
    return {
      action: 'chat',
      data: {
        message: `Received: "${chatData.message}". I'm ready to help with your code.`,
        context: 'chat_response'
      }
    };
  }

  /**
   * Handle screenshot request - analyze current screen
   */
  private async handleScreenshotRequest(state: CollabSessionState): Promise<{
    action: CollabTurn['action'];
    data: any;
  }> {
    if (state.lastScreenshot) {
      const analysis = await this.computerUse.analyzeScreen(
        state.lastScreenshot,
        `Collaborative editing session for: ${state.filePath || 'unknown file'}`
      );
      
      return {
        action: 'chat',
        data: {
          message: analysis.description,
          elements: analysis.elements,
          suggestions: analysis.suggestedActions
        }
      };
    }

    return {
      action: 'chat',
      data: { message: 'No screenshot available. Please capture the screen first.' }
    };
  }

  /**
   * Update screen capture for vision analysis
   */
  async updateScreenshot(sessionId: string, screenshot: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.lastScreenshot = screenshot;
    }
  }

  /**
   * Execute browser action via Playwright
   */
  async executeBrowserAction(sessionId: string, action: ComputerAction): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    const state = this.sessions.get(sessionId);
    if (!state?.playwrightSessionId) {
      return { success: false, error: 'No browser session active' };
    }

    try {
      const response = await fetch(`http://localhost:5000/api/playwright/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.playwrightSessionId,
          action: action.type,
          ...action
        })
      });

      const result = await response.json();
      return { success: result.success, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get session state
   */
  getSession(sessionId: string): CollabSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * End collaborative session and cleanup
   */
  async endSession(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    if (state.liveSessionId) {
      await geminiLive.closeLiveSession(state.liveSessionId);
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Array<{ id: string; participantCount: number }> {
    return Array.from(this.sessions.entries()).map(([id, state]) => ({
      id,
      participantCount: state.participants.filter(p => p.isActive).length
    }));
  }
}

export const collabIntegration = new CollabIntegrationService();
