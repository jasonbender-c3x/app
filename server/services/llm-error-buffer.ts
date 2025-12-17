/**
 * LLM Error Buffer
 * 
 * Stores LLM-related errors for debugging purposes.
 * Captures errors from chat, TTS, image generation, embeddings, etc.
 */

export interface LLMError {
  id: string;
  timestamp: string;
  service: "chat" | "tts" | "image" | "embedding" | "transcription" | "music" | "live" | "evolution" | "other";
  operation: string;
  errorMessage: string;
  errorStack?: string;
  context?: Record<string, unknown>;
  request?: {
    model?: string;
    prompt?: string;
    inputLength?: number;
  };
}

class LLMErrorBuffer {
  private errors: LLMError[] = [];
  private maxSize = 100;
  private counter = 0;

  /**
   * Log an LLM error
   */
  log(error: Omit<LLMError, 'id' | 'timestamp'>): string {
    this.counter++;
    const id = `err-${Date.now()}-${this.counter}`;
    
    const entry: LLMError = {
      ...error,
      id,
      timestamp: new Date().toISOString(),
    };

    this.errors.unshift(entry);

    if (this.errors.length > this.maxSize) {
      this.errors.pop();
    }

    console.error(`[LLM Error] ${error.service}/${error.operation}: ${error.errorMessage}`);
    
    return id;
  }

  /**
   * Get all errors (most recent first)
   */
  getAll(limit = 50): LLMError[] {
    return this.errors.slice(0, limit);
  }

  /**
   * Get errors by service
   */
  getByService(service: LLMError['service'], limit = 20): LLMError[] {
    return this.errors.filter(e => e.service === service).slice(0, limit);
  }

  /**
   * Get a single error by ID
   */
  getById(id: string): LLMError | undefined {
    return this.errors.find(e => e.id === id);
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
  }

  /**
   * Get count of stored errors
   */
  getCount(): number {
    return this.errors.length;
  }

  /**
   * Get error summary for AI analysis
   */
  getSummaryForAnalysis(): string {
    if (this.errors.length === 0) {
      return "No errors logged.";
    }

    const byService: Record<string, number> = {};
    this.errors.forEach(e => {
      byService[e.service] = (byService[e.service] || 0) + 1;
    });

    let summary = `## LLM Error Log Summary\n\n`;
    summary += `**Total Errors:** ${this.errors.length}\n\n`;
    summary += `**Errors by Service:**\n`;
    Object.entries(byService).forEach(([service, count]) => {
      summary += `- ${service}: ${count}\n`;
    });

    summary += `\n## Recent Errors (last 20)\n\n`;
    this.errors.slice(0, 20).forEach((e, i) => {
      summary += `### ${i + 1}. [${e.service}] ${e.operation}\n`;
      summary += `**Time:** ${e.timestamp}\n`;
      summary += `**Error:** ${e.errorMessage}\n`;
      if (e.request?.model) {
        summary += `**Model:** ${e.request.model}\n`;
      }
      if (e.context) {
        summary += `**Context:** ${JSON.stringify(e.context, null, 2)}\n`;
      }
      if (e.errorStack) {
        summary += `**Stack:**\n\`\`\`\n${e.errorStack.slice(0, 500)}\n\`\`\`\n`;
      }
      summary += `\n`;
    });

    return summary;
  }
}

export const llmErrorBuffer = new LLMErrorBuffer();

/**
 * Helper function to log LLM errors consistently
 */
export function logLLMError(
  service: LLMError['service'],
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
  request?: LLMError['request']
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return llmErrorBuffer.log({
    service,
    operation,
    errorMessage,
    errorStack,
    context,
    request
  });
}
