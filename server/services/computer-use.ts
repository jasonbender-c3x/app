/**
 * Computer Use Service
 * 
 * Provides AI-directed computer control capabilities:
 * - Screen capture with vision analysis
 * - Mouse/keyboard input injection via extension or local-agent
 * - Element detection and interaction planning
 * - Action execution with visual feedback loop
 */

import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ComputerAction {
  type: 'click' | 'type' | 'scroll' | 'move' | 'key' | 'screenshot' | 'wait';
  target?: { x: number; y: number } | string;
  text?: string;
  key?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  delay?: number;
}

export interface ComputerState {
  screenshot: string;
  url?: string;
  title?: string;
  elements?: Array<{
    tag: string;
    text?: string;
    rect: { x: number; y: number; width: number; height: number };
    selector?: string;
  }>;
}

interface VisionAnalysis {
  description: string;
  elements: Array<{
    description: string;
    bounds: { x: number; y: number; width: number; height: number };
    type: 'button' | 'input' | 'link' | 'text' | 'image' | 'menu' | 'other';
  }>;
  suggestedActions: string[];
  currentFocus?: string;
}

export class ComputerUseService {
  private actionHistory: Array<{ action: ComputerAction; timestamp: Date; result?: any }> = [];
  private maxHistorySize = 50;

  /**
   * Analyze a screenshot using Gemini Vision to understand the current state
   */
  async analyzeScreen(screenshot: string, context?: string): Promise<VisionAnalysis> {
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `You are an AI assistant analyzing a computer screen to help automate tasks.
${context ? `Context: ${context}` : ''}

Analyze this screenshot and provide:
1. A brief description of what's on screen
2. A list of interactive elements you can see (buttons, inputs, links, menus) with their approximate locations
3. Suggestions for what actions might be useful

Respond in JSON format:
{
  "description": "Brief description of the screen",
  "elements": [
    {"description": "Element description", "bounds": {"x": 0, "y": 0, "width": 100, "height": 30}, "type": "button"}
  ],
  "suggestedActions": ["Action 1", "Action 2"],
  "currentFocus": "What appears to be focused or active"
}`;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: prompt }
            ]
          }
        ]
      });

      const text = result?.text || '';
      
      if (!text) {
        console.warn('[ComputerUse] Empty response from vision analysis');
        return {
          description: 'No analysis available',
          elements: [],
          suggestedActions: []
        };
      }
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.warn('[ComputerUse] Failed to parse JSON, returning raw text');
        }
      }

      return {
        description: text,
        elements: [],
        suggestedActions: []
      };
    } catch (error: any) {
      console.error('[ComputerUse] Vision analysis failed:', error);
      return {
        description: 'Failed to analyze screen: ' + (error.message || 'Unknown error'),
        elements: [],
        suggestedActions: []
      };
    }
  }

  /**
   * Plan actions to achieve a goal based on current screen state
   */
  async planActions(
    goal: string,
    currentState: ComputerState
  ): Promise<ComputerAction[]> {
    const base64Data = currentState.screenshot.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `You are an AI assistant that plans computer actions to achieve goals.

Goal: ${goal}
${currentState.url ? `Current URL: ${currentState.url}` : ''}
${currentState.title ? `Page Title: ${currentState.title}` : ''}

Analyze the screenshot and plan the sequence of actions needed to achieve the goal.

Available actions:
- click: { type: "click", target: { x: number, y: number } } or { type: "click", target: "selector" }
- type: { type: "type", text: "text to type", target: { x: number, y: number } }
- scroll: { type: "scroll", direction: "up"|"down"|"left"|"right", amount: 300 }
- key: { type: "key", key: "Enter"|"Tab"|"Escape"|"Backspace" }
- wait: { type: "wait", delay: 1000 }

Respond with a JSON array of actions:
[
  { "type": "click", "target": { "x": 200, "y": 150 } },
  { "type": "type", "text": "search query" }
]

Keep the plan minimal - just the immediate next steps. We can reanalyze after each action.`;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: prompt }
            ]
          }
        ]
      });

      const text = result?.text || '';
      
      if (!text) {
        console.warn('[ComputerUse] Empty response from action planning');
        return [];
      }
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.warn('[ComputerUse] Failed to parse action JSON');
        }
      }

      return [];
    } catch (error: any) {
      console.error('[ComputerUse] Action planning failed:', error);
      return [];
    }
  }

  /**
   * Execute an action via the extension WebSocket
   */
  async executeViaExtension(
    action: ComputerAction,
    sendToExtension: (msg: any) => boolean
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Timeout waiting for extension response' });
      }, 10000);

      const handleResponse = (response: any) => {
        clearTimeout(timeout);
        if (response.success) {
          this.recordAction(action, response);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: response.error });
        }
      };

      const sent = sendToExtension({
        type: 'execute_command',
        command: action.type,
        params: this.actionToParams(action),
        callback: handleResponse
      });

      if (!sent) {
        clearTimeout(timeout);
        resolve({ success: false, error: 'Extension not connected' });
      }
    });
  }

  /**
   * Execute an action via local-agent WebSocket
   */
  async executeViaLocalAgent(
    action: ComputerAction,
    sendToAgent: (msg: any) => Promise<any>
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const result = await sendToAgent({
        type: action.type,
        ...this.actionToParams(action)
      });

      this.recordAction(action, result);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert ComputerAction to command params
   */
  private actionToParams(action: ComputerAction): Record<string, any> {
    switch (action.type) {
      case 'click':
        if (typeof action.target === 'string') {
          return { selector: action.target };
        } else if (action.target) {
          return { x: action.target.x, y: action.target.y };
        }
        return {};

      case 'type':
        return {
          text: action.text || '',
          selector: typeof action.target === 'string' ? action.target : undefined
        };

      case 'scroll':
        return {
          direction: action.direction || 'down',
          amount: action.amount || 300
        };

      case 'key':
        return { key: action.key };

      case 'wait':
        return { timeout: action.delay || 1000 };

      case 'screenshot':
        return { fullPage: false };

      case 'move':
        if (typeof action.target !== 'string' && action.target) {
          return { x: action.target.x, y: action.target.y };
        }
        return {};

      default:
        return {};
    }
  }

  /**
   * Record action in history for context
   */
  private recordAction(action: ComputerAction, result?: any) {
    this.actionHistory.push({
      action,
      timestamp: new Date(),
      result
    });

    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }
  }

  /**
   * Get recent action history for context
   */
  getRecentActions(limit = 10): Array<{ action: ComputerAction; timestamp: Date }> {
    return this.actionHistory.slice(-limit);
  }

  /**
   * Clear action history
   */
  clearHistory() {
    this.actionHistory = [];
  }

  /**
   * Generate a task completion assessment
   */
  async assessProgress(
    goal: string,
    screenshot: string,
    actionsPerformed: ComputerAction[]
  ): Promise<{ complete: boolean; progress: string; nextSteps?: string[] }> {
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

    const actionsSummary = actionsPerformed.map((a, i) => 
      `${i + 1}. ${a.type}${a.text ? `: "${a.text}"` : ''}`
    ).join('\n');

    const prompt = `Assess progress toward completing a computer task.

Goal: ${goal}

Actions performed:
${actionsSummary || 'None yet'}

Look at the current screenshot and determine:
1. Is the goal complete?
2. What progress has been made?
3. What steps remain?

Respond in JSON:
{
  "complete": true/false,
  "progress": "Description of progress made",
  "nextSteps": ["Step 1", "Step 2"] // only if not complete
}`;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: prompt }
            ]
          }
        ]
      });

      const text = result?.text || '';
      
      if (!text) {
        return { complete: false, progress: 'No assessment available' };
      }
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.warn('[ComputerUse] Failed to parse progress JSON');
        }
      }

      return {
        complete: false,
        progress: text
      };
    } catch (error: any) {
      console.error('[ComputerUse] Progress assessment failed:', error);
      return {
        complete: false,
        progress: 'Assessment failed: ' + (error.message || 'Unknown error')
      };
    }
  }

  /**
   * Find a specific element on screen
   */
  async findElement(
    screenshot: string,
    description: string
  ): Promise<{ found: boolean; location?: { x: number; y: number }; confidence?: string }> {
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `Find the element described on this screenshot.

Looking for: ${description}

If found, provide the center coordinates of the element.

Respond in JSON:
{
  "found": true/false,
  "location": { "x": number, "y": number }, // center point if found
  "confidence": "high" | "medium" | "low",
  "description": "What you found or why not found"
}`;

    try {
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: prompt }
            ]
          }
        ]
      });

      const text = result?.text || '';
      
      if (!text) {
        return { found: false };
      }
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.warn('[ComputerUse] Failed to parse element JSON');
        }
      }

      return { found: false };
    } catch (error: any) {
      console.error('[ComputerUse] Element search failed:', error);
      return { found: false };
    }
  }
}

export const computerUseService = new ComputerUseService();
