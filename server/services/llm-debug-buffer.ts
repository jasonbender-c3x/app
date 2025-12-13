/**
 * LLM Debug Buffer
 * 
 * Stores recent LLM interactions (prompts and responses) for debugging purposes.
 * Keeps the last N interactions in memory for quick access from the debug console.
 */

export interface LLMInteraction {
  id: string;
  timestamp: string;
  chatId: string;
  messageId: string;
  
  // Input
  systemPrompt: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  attachments: Array<{ type: string; filename?: string; mimeType?: string }>;
  
  // Output
  rawResponse: string;
  parsedToolCalls: unknown[];
  cleanContent: string;
  toolResults: Array<{ toolId: string; type: string; success: boolean; result?: unknown; error?: string }>;
  
  // Metadata
  model: string;
  durationMs: number;
  tokenEstimate?: {
    inputTokens: number;
    outputTokens: number;
  };
}

class LLMDebugBuffer {
  private interactions: LLMInteraction[] = [];
  private maxSize = 50;
  private counter = 0;

  /**
   * Add a new LLM interaction to the buffer
   */
  add(interaction: Omit<LLMInteraction, 'id' | 'timestamp'>): string {
    this.counter++;
    const id = `llm-${Date.now()}-${this.counter}`;
    
    const entry: LLMInteraction = {
      ...interaction,
      id,
      timestamp: new Date().toISOString(),
    };

    this.interactions.unshift(entry);

    if (this.interactions.length > this.maxSize) {
      this.interactions.pop();
    }

    return id;
  }

  /**
   * Get all interactions (most recent first)
   */
  getAll(limit = 20): LLMInteraction[] {
    return this.interactions.slice(0, limit);
  }

  /**
   * Get a single interaction by ID
   */
  getById(id: string): LLMInteraction | undefined {
    return this.interactions.find(i => i.id === id);
  }

  /**
   * Clear all interactions
   */
  clear(): void {
    this.interactions = [];
  }

  /**
   * Get count of stored interactions
   */
  getCount(): number {
    return this.interactions.length;
  }
}

export const llmDebugBuffer = new LLMDebugBuffer();
