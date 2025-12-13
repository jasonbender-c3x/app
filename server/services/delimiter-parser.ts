/**
 * =============================================================================
 * NEBULA CHAT - EMOJI SEA DELIMITER PARSER
 * =============================================================================
 * 
 * Parses streamed LLM content using the Emoji Sea delimiter format.
 * 
 * FORMAT:
 * The LLM output format is:
 * 1. TOOL CALLS (JSON array) - All tool calls at the start (MUST be an array)
 * 2. EMOJI SEA DELIMITER - 🌊🐱🌊🐱🌊🐱🌊🐱🌊🐱🌊🐱🌊🐱🌊
 * 3. MARKDOWN CONTENT - Everything for the chat window
 * 
 * Example:
 * ```
 * [
 *   { "type": "gmail_list", "id": "001", "operation": "list emails", "parameters": {} }
 * ]
 * 
 * 🌊🐱🌊🐱🌊🐱🌊🐱🌊🐱🌊🐱🌊🐱🌊
 * 
 * Here's what I found in your inbox...
 * ```
 * 
 * STREAMING BEHAVIOR:
 * - Buffers content until the emoji sea delimiter is found
 * - Once found, parses the JSON tool calls (MUST be array) from content before delimiter
 * - Streams markdown content after the delimiter immediately
 * - Strips any subsequent delimiters or JSON fragments from post-delimiter content
 * - If no delimiter found by end of stream, treats entire content as markdown
 * 
 * =============================================================================
 */

import { toolCallSchema, type ToolCall, EMOJI_SEA_DELIMITER } from "@shared/schema";

/**
 * Result of parsing a chunk of streamed content
 */
export interface ParseResult {
  proseToStream: string;
  completedToolCalls: ToolCall[];
  pendingBuffer: string;
  errors: string[];
}

/**
 * Stateful parser for streaming content with emoji sea delimiter
 */
export class DelimiterParser {
  private buffer: string = "";
  private delimiterFound: boolean = false;
  private toolCallsExtracted: boolean = false;
  private extractedToolCalls: ToolCall[] = [];
  private parseErrors: string[] = [];

  /**
   * Sanitize markdown content by stripping any errant delimiters or JSON fragments
   * that should not appear in the markdown section.
   * Returns empty string for chunks that contain tool-call JSON to prevent leaking.
   */
  private sanitizeMarkdown(content: string): { clean: string; errors: string[]; suppressed: boolean } {
    const errors: string[] = [];
    let clean = content;
    let suppressed = false;
    
    if (clean.includes(EMOJI_SEA_DELIMITER)) {
      errors.push("Unexpected delimiter found in markdown section - suppressing chunk");
      clean = "";
      suppressed = true;
      return { clean, errors, suppressed };
    }
    
    const jsonToolCallPattern = /\[\s*\{[^[\]]*"type"\s*:\s*"[\w_]+"/;
    if (jsonToolCallPattern.test(clean)) {
      errors.push("JSON tool call array detected in markdown section - suppressing to prevent leakage");
      clean = "";
      suppressed = true;
      return { clean, errors, suppressed };
    }
    
    const singleObjectPattern = /\{\s*"type"\s*:\s*"[\w_]+"\s*,\s*"id"\s*:/;
    if (singleObjectPattern.test(clean)) {
      errors.push("JSON tool call object detected in markdown section - suppressing to prevent leakage");
      clean = "";
      suppressed = true;
      return { clean, errors, suppressed };
    }
    
    return { clean, errors, suppressed };
  }

  /**
   * Process a chunk of streamed content
   * 
   * @param chunk - New chunk of text from LLM stream
   * @returns ParseResult with prose to stream and any completed tool calls
   */
  processChunk(chunk: string): ParseResult {
    this.buffer += chunk;
    
    const proseToStream: string[] = [];
    const completedToolCalls: ToolCall[] = [];
    const errors: string[] = [];

    if (!this.delimiterFound) {
      const delimiterIndex = this.buffer.indexOf(EMOJI_SEA_DELIMITER);
      
      if (delimiterIndex !== -1) {
        this.delimiterFound = true;
        
        const toolCallsSection = this.buffer.substring(0, delimiterIndex).trim();
        const markdownSection = this.buffer.substring(delimiterIndex + EMOJI_SEA_DELIMITER.length);
        
        if (toolCallsSection && !this.toolCallsExtracted) {
          this.toolCallsExtracted = true;
          const parsed = this.parseToolCallsJson(toolCallsSection);
          this.extractedToolCalls = parsed.toolCalls;
          completedToolCalls.push(...parsed.toolCalls);
          errors.push(...parsed.errors);
          this.parseErrors.push(...parsed.errors);
        }
        
        if (markdownSection) {
          const sanitized = this.sanitizeMarkdown(markdownSection);
          proseToStream.push(sanitized.clean);
          errors.push(...sanitized.errors);
        }
        this.buffer = "";
      }
    } else {
      const sanitized = this.sanitizeMarkdown(chunk);
      proseToStream.push(sanitized.clean);
      errors.push(...sanitized.errors);
      this.buffer = "";
    }

    return {
      proseToStream: proseToStream.join(""),
      completedToolCalls,
      pendingBuffer: this.buffer,
      errors
    };
  }

  /**
   * Flush any remaining content when stream ends
   */
  flush(): ParseResult {
    const errors: string[] = [];
    let proseToStream = "";
    const completedToolCalls: ToolCall[] = [];

    if (this.buffer.trim()) {
      if (!this.delimiterFound) {
        const delimiterIndex = this.buffer.indexOf(EMOJI_SEA_DELIMITER);
        
        if (delimiterIndex !== -1) {
          const toolCallsSection = this.buffer.substring(0, delimiterIndex).trim();
          const markdownSection = this.buffer.substring(delimiterIndex + EMOJI_SEA_DELIMITER.length).trim();
          
          if (toolCallsSection && !this.toolCallsExtracted) {
            this.toolCallsExtracted = true;
            const parsed = this.parseToolCallsJson(toolCallsSection);
            completedToolCalls.push(...parsed.toolCalls);
            errors.push(...parsed.errors);
          }
          
          const sanitized = this.sanitizeMarkdown(markdownSection);
          proseToStream = sanitized.clean;
          errors.push(...sanitized.errors);
        } else {
          proseToStream = this.buffer;
        }
      } else {
        const sanitized = this.sanitizeMarkdown(this.buffer);
        proseToStream = sanitized.clean;
        errors.push(...sanitized.errors);
      }
    }
    
    this.buffer = "";
    
    return {
      proseToStream,
      completedToolCalls,
      pendingBuffer: "",
      errors
    };
  }

  /**
   * Parse JSON tool calls from the section before the delimiter.
   * STRICT: Only accepts JSON arrays, not single objects.
   */
  private parseToolCallsJson(content: string): { toolCalls: ToolCall[]; errors: string[] } {
    const toolCalls: ToolCall[] = [];
    const errors: string[] = [];
    
    try {
      const trimmed = content.trim();
      if (!trimmed) {
        return { toolCalls, errors };
      }
      
      const jsonStart = trimmed.indexOf("[");
      const jsonEnd = trimmed.lastIndexOf("]");
      
      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
        if (trimmed.includes("{")) {
          errors.push("Tool calls must be a JSON array, not a single object. Expected format: [{...}]");
        }
        return { toolCalls, errors };
      }
      
      const jsonStr = trimmed.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      
      if (!Array.isArray(parsed)) {
        errors.push("Tool calls must be a JSON array. Got non-array value.");
        return { toolCalls, errors };
      }
      
      for (const item of parsed) {
        const result = toolCallSchema.safeParse(item);
        if (result.success) {
          toolCalls.push(result.data);
        } else {
          errors.push(`Invalid tool call in array: ${result.error.message}`);
        }
      }
    } catch (error) {
      if (content.includes("{") || content.includes("[")) {
        errors.push(`Failed to parse tool calls JSON: ${error}`);
      }
    }
    
    return { toolCalls, errors };
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = "";
    this.delimiterFound = false;
    this.toolCallsExtracted = false;
    this.extractedToolCalls = [];
    this.parseErrors = [];
  }
  
  /**
   * Get all extracted tool calls
   */
  getExtractedToolCalls(): ToolCall[] {
    return this.extractedToolCalls;
  }
  
  /**
   * Check if delimiter was found
   */
  wasDelimiterFound(): boolean {
    return this.delimiterFound;
  }
}

export const delimiterParser = new DelimiterParser();
