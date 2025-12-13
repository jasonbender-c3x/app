/**
 * =============================================================================
 * NEBULA CHAT - PROMPT COMPOSER SERVICE
 * =============================================================================
 * 
 * Assembles multimodal prompts from user input, attachments, and context
 * into a structured request for the RAG backend.
 * 
 * RESPONSIBILITY:
 * ---------------
 * Takes raw user input (text, files, screenshots, voice transcripts) and
 * composes a complete prompt object ready for LLM processing.
 * 
 * PROMPT ARCHITECTURE:
 * -------------------
 * The system prompt is loaded from separate modular files:
 * - prompts/core-directives.md - Fundamental behavior rules
 * - prompts/personality.md - Character and communication style
 * - prompts/tools.md - Tool definitions and implementation
 * 
 * INPUT SOURCES:
 * - User typed text
 * - Voice-to-text transcriptions
 * - File attachments (documents, images)
 * - Screenshots captured via screen capture
 * - Conversation history for context
 * 
 * OUTPUT:
 * - Structured prompt object with all content normalized
 * - System instructions based on context
 * - File content extracted and included
 * =============================================================================
 */

import { storage } from "../storage";
import type { Draft, Attachment, Message } from "@shared/schema";
import { ragService } from "./rag-service";
import { tavilySearch } from "../integrations/tavily";
import * as fs from "fs";
import * as path from "path";

/**
 * Composed prompt structure ready for LLM processing
 */
export interface ComposedPrompt {
  systemPrompt: string;
  userMessage: string;
  attachments: ComposedAttachment[];
  conversationHistory: ConversationTurn[];
  metadata: PromptMetadata;
}

/**
 * Processed attachment for inclusion in prompt
 */
export interface ComposedAttachment {
  type: "file" | "screenshot" | "voice_transcript";
  filename: string;
  mimeType?: string;
  content: string;
  isBase64: boolean;
}

/**
 * Conversation turn for history context
 */
export interface ConversationTurn {
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

/**
 * Metadata about the composed prompt
 */
export interface PromptMetadata {
  chatId: string;
  draftId?: string;
  hasVoiceInput: boolean;
  hasFileAttachments: boolean;
  hasScreenshots: boolean;
  composedAt: Date;
}

/**
 * PromptComposer
 * 
 * Service for assembling complete prompts from various input sources.
 * Handles normalization, extraction, and structuring of multimodal content.
 * 
 * Loads system prompt components from modular files in the prompts/ directory.
 */
export class PromptComposer {
  private coreDirectives: string = "";
  private personality: string = "";
  private tools: string = "";
  private promptsLoaded: boolean = false;

  /**
   * Load prompt components from files
   * Called lazily on first compose() call
   */
  private loadPrompts(): void {
    if (this.promptsLoaded) return;

    const promptsDir = path.join(process.cwd(), "prompts");

    try {
      this.coreDirectives = fs.readFileSync(
        path.join(promptsDir, "core-directives.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load core-directives.md, using fallback");
      this.coreDirectives = this.getFallbackCoreDirectives();
    }

    try {
      this.personality = fs.readFileSync(
        path.join(promptsDir, "personality.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load personality.md, using fallback");
      this.personality = this.getFallbackPersonality();
    }

    try {
      this.tools = fs.readFileSync(
        path.join(promptsDir, "tools.md"),
        "utf-8"
      );
    } catch (error) {
      console.warn("Could not load tools.md, using fallback");
      this.tools = this.getFallbackTools();
    }

    this.promptsLoaded = true;
  }

  /**
   * Fallback core directives if file is not found
   */
  private getFallbackCoreDirectives(): string {
    return `# Core Directives

You are Nebula, an advanced AI assistant. You must:
1. Provide accurate, helpful responses
2. Process multimodal inputs (text, images, documents)
3. Communicate clearly and naturally

Always respond in natural conversational language. Be helpful, concise, and informative.`;
  }

  /**
   * Fallback personality if file is not found
   */
  private getFallbackPersonality(): string {
    return `# Personality

Be professional, helpful, and precise. Communicate clearly and provide actionable responses.`;
  }

  /**
   * Fallback tools if file is not found
   */
  private getFallbackTools(): string {
    return `# Capabilities

You can analyze documents, images, and other attachments. When users share files, examine their content and provide helpful insights.`;
  }

  /**
   * Compose a complete prompt from a draft and its attachments
   * 
   * @param draftId - ID of the draft to compose
   * @param chatId - ID of the parent chat for context
   * @returns Fully composed prompt ready for processing
   */
  async composeFromDraft(draftId: string, chatId: string): Promise<ComposedPrompt> {
    const draft = await storage.getDraftById(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const attachments = await storage.getAttachmentsByDraftId(draftId);
    const history = await storage.getMessagesByChatId(chatId);

    return this.compose({
      textContent: draft.textContent || "",
      voiceTranscript: draft.voiceTranscript || "",
      attachments,
      history,
      chatId,
      draftId
    });
  }

  /**
   * Compose a prompt from individual components
   * Used for direct message composition without drafts
   */
  async compose(params: {
    textContent: string;
    voiceTranscript?: string;
    attachments?: Attachment[];
    history?: Message[];
    chatId: string;
    draftId?: string;
  }): Promise<ComposedPrompt> {
    const { textContent, voiceTranscript = "", attachments = [], history = [], chatId, draftId } = params;

    // Ensure prompts are loaded
    this.loadPrompts();

    const userMessage = this.buildUserMessage(textContent, voiceTranscript);
    const composedAttachments = await this.processAttachments(attachments);
    const conversationHistory = this.buildHistory(history);

    // Retrieve relevant document chunks via RAG
    const ragContext = await ragService.buildContext(userMessage, 5);
    const ragContextString = ragService.formatContextForPrompt(ragContext);

    // Perform web search if query would benefit from real-time information
    let webContextString = "";
    if (this.needsWebSearch(userMessage)) {
      console.log("Web search triggered for query:", userMessage.slice(0, 50));
      webContextString = await this.getWebSearchContext(userMessage);
    }

    // Build system prompt with RAG context and web search results
    const systemPrompt = this.buildSystemPrompt(composedAttachments, ragContextString, webContextString);

    return {
      systemPrompt,
      userMessage,
      attachments: composedAttachments,
      conversationHistory,
      metadata: {
        chatId,
        draftId,
        hasVoiceInput: voiceTranscript.length > 0,
        hasFileAttachments: attachments.some(a => a.type === "file"),
        hasScreenshots: attachments.some(a => a.type === "screenshot"),
        composedAt: new Date()
      }
    };
  }

  /**
   * Build the user message from text and voice input
   */
  private buildUserMessage(textContent: string, voiceTranscript: string): string {
    const parts: string[] = [];
    
    if (textContent.trim()) {
      parts.push(textContent.trim());
    }
    
    if (voiceTranscript.trim()) {
      if (parts.length > 0) {
        parts.push(" " + voiceTranscript.trim());
      } else {
        parts.push(voiceTranscript.trim());
      }
    }
    
    return parts.join("");
  }

  /**
   * Process attachments for inclusion in the prompt
   */
  private async processAttachments(attachments: Attachment[]): Promise<ComposedAttachment[]> {
    return attachments.map(attachment => ({
      type: attachment.type as "file" | "screenshot" | "voice_transcript",
      filename: attachment.filename,
      mimeType: attachment.mimeType || undefined,
      content: attachment.content || "",
      isBase64: this.isBinaryMimeType(attachment.mimeType || "")
    }));
  }

  /**
   * Build conversation history for context
   */
  private buildHistory(messages: Message[]): ConversationTurn[] {
    return messages.slice(-10).map(msg => ({
      role: msg.role as "user" | "ai",
      content: msg.content,
      timestamp: msg.createdAt
    }));
  }

  /**
   * Detect if a query would benefit from web search
   * Returns true for questions about current events, recent info, specific facts, etc.
   */
  private needsWebSearch(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    const searchTriggers = [
      "what is", "who is", "where is", "when did", "how do", "how does",
      "latest", "recent", "current", "today", "news", "update",
      "price", "cost", "weather", "stock", "crypto",
      "search", "look up", "find out", "tell me about",
      "what happened", "when was", "how many", "how much",
      "best", "top", "popular", "trending", "new",
      "2024", "2025", "this year", "this month", "this week",
      "where can", "how to", "what are", "why is", "why do"
    ];
    
    return searchTriggers.some(trigger => lowerQuery.includes(trigger));
  }

  /**
   * Perform web search and format results for context
   */
  private async getWebSearchContext(query: string): Promise<string> {
    if (!process.env.TAVILY_API_KEY) {
      return "";
    }

    try {
      const results = await tavilySearch({
        query,
        searchDepth: "basic",
        maxResults: 5,
        includeAnswer: true
      });

      if (!results.results || results.results.length === 0) {
        return "";
      }

      let context = "## Live Web Search Results\n\n";
      context += "The following real-time information was retrieved from the web:\n\n";
      
      if (results.answer) {
        context += `**Summary:** ${results.answer}\n\n`;
      }
      
      context += "**Sources:**\n";
      for (const result of results.results.slice(0, 5)) {
        context += `- **${result.title}**: ${result.content.slice(0, 300)}...\n  URL: ${result.url}\n\n`;
      }
      
      context += "\nUse this real-time information to provide accurate, up-to-date responses. Cite sources when appropriate.";
      
      return context;
    } catch (error) {
      console.error("Tavily search failed:", error);
      return "";
    }
  }

  /**
   * Build system prompt from modular components
   * Assembles: Core Directives + Personality + Tools + RAG Context + Web Search + Contextual Instructions
   */
  private buildSystemPrompt(attachments: ComposedAttachment[], ragContext?: string, webContext?: string): string {
    const parts: string[] = [
      this.coreDirectives,
      this.personality,
      this.tools
    ];

    // Add RAG context if available
    if (ragContext && ragContext.trim()) {
      parts.push(`
## Retrieved Knowledge Context

The following information was retrieved from previously uploaded documents and may be relevant to the user's query:

${ragContext}`);
    }

    // Add web search context if available
    if (webContext && webContext.trim()) {
      parts.push(webContext);
    }

    // Add contextual instructions based on attachments
    if (attachments.some(a => a.type === "screenshot")) {
      parts.push(`
## Current Context: Screenshots

The user has attached screenshots to this message. When analyzing:
- Describe what you observe clearly and specifically
- Identify UI elements, text, errors, or relevant details
- Extract any visible text using OCR if helpful
- Suggest actions based on the screenshot content
- Reference specific parts of the image when explaining`);
    }

    if (attachments.some(a => a.type === "file")) {
      parts.push(`
## Current Context: File Attachments

The user has attached files to this message. When processing:
- Analyze the file content thoroughly
- Reference specific sections or data points
- Summarize key information when appropriate
- Suggest actions or next steps based on the content`);
    }

    if (attachments.some(a => a.type === "voice_transcript")) {
      parts.push(`
## Current Context: Voice Input

This message includes voice-transcribed input. Consider:
- The transcription may contain minor errors
- Focus on the user's intent rather than exact wording
- Clarify if the request seems ambiguous`);
    }

    parts.push(`
## Final Instruction

Always respond in natural, conversational language. Be clear, helpful, and concise.`);

    return parts.join("\n\n");
  }

  /**
   * Check if a MIME type represents binary data
   */
  private isBinaryMimeType(mimeType: string): boolean {
    const binaryPrefixes = ["image/", "audio/", "video/", "application/octet-stream"];
    return binaryPrefixes.some(prefix => mimeType.startsWith(prefix));
  }

  /**
   * Force reload of prompt files
   * Useful for development or hot-reloading
   */
  reloadPrompts(): void {
    this.promptsLoaded = false;
    this.loadPrompts();
  }

  /**
   * Get the currently loaded prompt components
   * Useful for debugging or inspection
   */
  getPromptComponents(): { coreDirectives: string; personality: string; tools: string } {
    this.loadPrompts();
    return {
      coreDirectives: this.coreDirectives,
      personality: this.personality,
      tools: this.tools
    };
  }
}

export const promptComposer = new PromptComposer();
