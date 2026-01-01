/**
 * JIT (Just-In-Time) Tool Protocol v2
 * 
 * Compressed manifest with schema definition + full tool list.
 * No per-tool examples needed - single generic schema covers all.
 */

import { GoogleGenAI } from "@google/genai";

// Tool categories for classification
export type ToolCategory = 
  | "email"
  | "calendar"
  | "drive"
  | "docs"
  | "sheets"
  | "tasks"
  | "github"
  | "search"
  | "file"
  | "voice"
  | "browser"
  | "codebase"
  | "contacts"
  | "queue"
  | "sms"
  | "general";

// Tool prediction result
export interface ToolPrediction {
  categories: ToolCategory[];
  confidence: number;
  reasoning: string;
}

// Compressed tool definition (name + params only)
interface ToolDef {
  name: string;
  params: string;
  category: ToolCategory;
}

// ============================================================================
// COMPLETE TOOL MANIFEST (81 tools)
// ============================================================================

const ALL_TOOLS: ToolDef[] = [
  // === GENERAL (1) ===
  { name: "debug_echo", params: "message:string", category: "general" },
  
  // === FILE (5) - Paths support prefixes: server: (default), client:, editor: ===
  { name: "file_get", params: "path:string (prefix: server:, client:, editor:)", category: "file" },
  { name: "file_put", params: "path:string (prefix: server:, client:, editor:), content:string", category: "file" },
  { name: "file_ingest", params: "path:string", category: "file" },
  { name: "terminal_execute", params: "command:string (prefix: server:, client:), timeout?:number", category: "file" },
  { name: "editor_load", params: "path:string", category: "file" },
  
  // === EMAIL (4) ===
  { name: "gmail_list", params: "maxResults?:number", category: "email" },
  { name: "gmail_read", params: "messageId:string", category: "email" },
  { name: "gmail_send", params: "to:string, subject:string, body:string, cc?, bcc?", category: "email" },
  { name: "gmail_search", params: "query:string, maxResults?:number", category: "email" },
  
  // === SMS / TWILIO (4) ===
  { name: "sms_send", params: "to:string (E.164 phone), body:string (1-1600 chars)", category: "sms" },
  { name: "sms_list", params: "limit?:number", category: "sms" },
  { name: "call_make", params: "to:string (E.164 phone), message?:string (TTS), twimlUrl?:string", category: "sms" },
  { name: "call_list", params: "limit?:number", category: "sms" },
  
  // === CALENDAR (5) ===
  { name: "calendar_list", params: "(none)", category: "calendar" },
  { name: "calendar_events", params: "calendarId?, timeMin?, timeMax?, maxResults?", category: "calendar" },
  { name: "calendar_create", params: "summary:string, start:string, end:string, description?, location?", category: "calendar" },
  { name: "calendar_update", params: "eventId:string, summary?, start?, end?, description?", category: "calendar" },
  { name: "calendar_delete", params: "eventId:string", category: "calendar" },
  
  // === DRIVE (6) ===
  { name: "drive_list", params: "folderId?, maxResults?", category: "drive" },
  { name: "drive_read", params: "fileId:string", category: "drive" },
  { name: "drive_search", params: "query:string, maxResults?", category: "drive" },
  { name: "drive_create", params: "name:string, content:string, mimeType?, folderId?", category: "drive" },
  { name: "drive_update", params: "fileId:string, content:string", category: "drive" },
  { name: "drive_delete", params: "fileId:string", category: "drive" },
  
  // === DOCS (4) ===
  { name: "docs_read", params: "documentId:string", category: "docs" },
  { name: "docs_create", params: "title:string, content?:string", category: "docs" },
  { name: "docs_append", params: "documentId:string, content:string", category: "docs" },
  { name: "docs_replace", params: "documentId:string, find:string, replace:string", category: "docs" },
  
  // === SHEETS (5) ===
  { name: "sheets_read", params: "spreadsheetId:string, range:string", category: "sheets" },
  { name: "sheets_create", params: "title:string", category: "sheets" },
  { name: "sheets_write", params: "spreadsheetId:string, range:string, values:array", category: "sheets" },
  { name: "sheets_append", params: "spreadsheetId:string, range:string, values:array", category: "sheets" },
  { name: "sheets_clear", params: "spreadsheetId:string, range:string", category: "sheets" },
  
  // === TASKS (6) ===
  { name: "tasks_list", params: "(none)", category: "tasks" },
  { name: "tasks_get", params: "taskListId:string", category: "tasks" },
  { name: "tasks_create", params: "title:string, notes?, due?, taskListId?", category: "tasks" },
  { name: "tasks_update", params: "taskId:string, title?, notes?, due?", category: "tasks" },
  { name: "tasks_delete", params: "taskId:string", category: "tasks" },
  { name: "tasks_complete", params: "taskId:string", category: "tasks" },
  
  // === GITHUB (15) ===
  { name: "github_repos", params: "username?, org?, type?", category: "github" },
  { name: "github_repo_get", params: "owner:string, repo:string", category: "github" },
  { name: "github_repo_search", params: "query:string, maxResults?", category: "github" },
  { name: "github_contents", params: "owner:string, repo:string, path:string", category: "github" },
  { name: "github_file_read", params: "owner:string, repo:string, path:string, ref?", category: "github" },
  { name: "github_code_search", params: "query:string, owner?, repo?", category: "github" },
  { name: "github_issues", params: "owner:string, repo:string, state?, labels?", category: "github" },
  { name: "github_issue_get", params: "owner:string, repo:string, issueNumber:number", category: "github" },
  { name: "github_issue_create", params: "owner:string, repo:string, title:string, body?", category: "github" },
  { name: "github_issue_update", params: "owner:string, repo:string, issueNumber:number, title?, body?, state?", category: "github" },
  { name: "github_issue_comment", params: "owner:string, repo:string, issueNumber:number, body:string", category: "github" },
  { name: "github_pulls", params: "owner:string, repo:string, state?", category: "github" },
  { name: "github_pull_get", params: "owner:string, repo:string, pullNumber:number", category: "github" },
  { name: "github_commits", params: "owner:string, repo:string, sha?, path?", category: "github" },
  { name: "github_user", params: "username?", category: "github" },
  
  // === SEARCH (12) ===
  { name: "search", params: "query:string, scope?", category: "search" },
  { name: "web_search", params: "query:string, maxTokens?, searchRecency?, domains?", category: "search" },
  { name: "google_search", params: "query:string, maxResults?", category: "search" },
  { name: "duckduckgo_search", params: "query:string, maxResults?", category: "search" },
  { name: "browser_scrape", params: "url:string, selector?, waitFor?", category: "search" },
  { name: "tavily_search", params: "query:string, searchDepth?, maxResults?", category: "search" },
  { name: "tavily_qna", params: "query:string", category: "search" },
  { name: "tavily_research", params: "query:string, topic?", category: "search" },
  { name: "perplexity_search", params: "query:string, model?", category: "search" },
  { name: "perplexity_quick", params: "query:string", category: "search" },
  { name: "perplexity_research", params: "query:string", category: "search" },
  { name: "perplexity_news", params: "query:string", category: "search" },
  
  // === BROWSER (3) ===
  { name: "browserbase_load", params: "url:string, waitFor?", category: "browser" },
  { name: "browserbase_screenshot", params: "url:string, fullPage?", category: "browser" },
  { name: "browserbase_action", params: "action:string, selector?, value?", category: "browser" },
  
  // === CONTACTS (6) ===
  { name: "contacts_list", params: "maxResults?:number", category: "contacts" },
  { name: "contacts_search", params: "query:string", category: "contacts" },
  { name: "contacts_get", params: "resourceName:string", category: "contacts" },
  { name: "contacts_create", params: "givenName:string, familyName?, email?, phone?", category: "contacts" },
  { name: "contacts_update", params: "resourceName:string, givenName?, familyName?, email?, phone?", category: "contacts" },
  { name: "contacts_delete", params: "resourceName:string", category: "contacts" },
  
  // === QUEUE (4) ===
  { name: "queue_create", params: "name:string, description?", category: "queue" },
  { name: "queue_batch", params: "queueId:string, tasks:array", category: "queue" },
  { name: "queue_list", params: "status?", category: "queue" },
  { name: "queue_start", params: "queueId:string", category: "queue" },
];

// ============================================================================
// SCHEMA DEFINITION (single generic example)
// ============================================================================

const TOOL_SCHEMA = `## Tool Call Schema

All tools use this JSON structure:
\`\`\`json
{
  "type": "<tool_name>",
  "id": "<unique_id>",
  "parameters": { <tool_params> }
}
\`\`\`

## Path Prefix Routing (file_get, file_put, terminal_execute)
- \`server:path\` or just \`path\` → Server filesystem (Replit workspace, default)
- \`client:/path\` → Client machine via desktop-app (user's computer)
- \`editor:filename\` → Monaco editor canvas (for live editing)

Examples:
- \`{"type": "file_get", "id": "f1", "parameters": {"path": "package.json"}}\` → reads from server
- \`{"type": "file_get", "id": "f2", "parameters": {"path": "client:/home/user/file.txt"}}\` → reads from user's computer
- \`{"type": "file_put", "id": "f3", "parameters": {"path": "editor:app.tsx", "content": "..."}}\` → saves to editor
- \`{"type": "terminal_execute", "id": "t1", "parameters": {"command": "client:ls -la"}}\` → runs on user's computer

Example (general):
\`\`\`json
{"type": "gmail_send", "id": "e1", "parameters": {"to": "user@example.com", "subject": "Hello", "body": "Message"}}
\`\`\``;

// ============================================================================
// COMPRESSED MANIFEST BUILDER
// ============================================================================

function buildCompressedManifest(categories?: ToolCategory[]): string {
  let manifest = TOOL_SCHEMA + "\n\n## Available Tools\n\n";
  
  // Group tools by category
  const byCategory = new Map<ToolCategory, ToolDef[]>();
  
  for (const tool of ALL_TOOLS) {
    // If categories specified, filter to only those
    if (categories && categories.length > 0 && !categories.includes(tool.category) && tool.category !== "general") {
      continue;
    }
    
    if (!byCategory.has(tool.category)) {
      byCategory.set(tool.category, []);
    }
    byCategory.get(tool.category)!.push(tool);
  }
  
  // Build table per category
  for (const [category, tools] of Array.from(byCategory.entries())) {
    manifest += `### ${category.toUpperCase()}\n`;
    manifest += "| Tool | Parameters |\n";
    manifest += "|------|------------|\n";
    for (const tool of tools) {
      manifest += `| ${tool.name} | ${tool.params} |\n`;
    }
    manifest += "\n";
  }
  
  return manifest;
}

// Category keywords for prediction
const CATEGORY_KEYWORDS: Record<ToolCategory, string[]> = {
  email: ["email", "mail", "inbox", "send", "message", "unread", "gmail", "reply", "forward"],
  calendar: ["calendar", "event", "meeting", "schedule", "appointment", "remind", "when", "today", "tomorrow", "week"],
  drive: ["drive", "file", "folder", "document", "upload", "download", "share", "storage", "google drive"],
  docs: ["doc", "document", "google doc", "write", "draft", "text"],
  sheets: ["sheet", "spreadsheet", "excel", "data", "table", "cell", "row", "column"],
  tasks: ["task", "todo", "to-do", "checklist", "reminder", "done", "complete"],
  github: ["github", "repo", "repository", "code", "commit", "pull request", "pr", "issue", "branch"],
  search: ["search", "find", "look up", "google", "web", "internet", "research", "tavily", "perplexity"],
  file: ["file", "read", "write", "edit", "editor", "code", "save", "open", "terminal", "command", "shell", "run"],
  voice: [], // Removed - no longer used
  sms: ["sms", "text", "message", "phone", "call", "twilio"],
  browser: ["browser", "webpage", "website", "url", "screenshot", "navigate", "scrape"],
  codebase: ["codebase", "analyze", "project", "structure", "glossary"],
  contacts: ["contact", "person", "phone", "address", "people"],
  queue: ["queue", "batch", "parallel", "tasks"],
  general: [],
};

// ============================================================================
// JIT TOOL PROTOCOL CLASS
// ============================================================================

class JITToolProtocol {
  private ai: GoogleGenAI | null = null;
  
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Fast prediction of which tool categories are needed based on user query
   */
  async predictTools(userQuery: string): Promise<ToolPrediction> {
    // First, try keyword-based fast prediction
    const keywordCategories = this.keywordBasedPrediction(userQuery);
    
    // If we have high-confidence keyword matches, use those
    if (keywordCategories.length > 0) {
      return {
        categories: keywordCategories,
        confidence: 0.8,
        reasoning: `Keyword match: ${keywordCategories.join(", ")}`,
      };
    }

    // Otherwise, use LLM for more nuanced prediction
    if (this.ai) {
      try {
        const prediction = await this.llmBasedPrediction(userQuery);
        return prediction;
      } catch (err) {
        console.error("[JIT] LLM prediction failed:", err);
      }
    }

    // Fallback to general tools only
    return {
      categories: ["general"],
      confidence: 0.5,
      reasoning: "Fallback to general",
    };
  }

  /**
   * Fast keyword-based prediction (no API call)
   */
  private keywordBasedPrediction(query: string): ToolCategory[] {
    const lowerQuery = query.toLowerCase();
    const matchedCategories: ToolCategory[] = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerQuery.includes(keyword)) {
          matchedCategories.push(category as ToolCategory);
          break;
        }
      }
    }

    return matchedCategories;
  }

  /**
   * LLM-based prediction for complex queries
   */
  private async llmBasedPrediction(query: string): Promise<ToolPrediction> {
    if (!this.ai) {
      return { categories: ["general"], confidence: 0.5, reasoning: "No API key" };
    }

    const categoryList = Object.keys(CATEGORY_KEYWORDS).join(", ");
    
    const prompt = `Predict tool categories for: "${query}"
Categories: ${categoryList}
JSON only: {"categories": ["cat1"], "confidence": 0.9, "reasoning": "brief"}`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.1, maxOutputTokens: 100 },
    });

    try {
      const text = response.text?.replace(/```json\n?|\n?```/g, "").trim() || "";
      const parsed = JSON.parse(text);
      return {
        categories: parsed.categories || ["general"],
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || "LLM prediction",
      };
    } catch {
      return { categories: ["general"], confidence: 0.5, reasoning: "Parse error" };
    }
  }

  /**
   * Build context-optimized tool manifest based on predictions
   */
  buildToolContext(prediction: ToolPrediction): string {
    // If general only, return full manifest
    if (prediction.categories.length === 0 || 
        (prediction.categories.length === 1 && prediction.categories[0] === "general")) {
      return buildCompressedManifest();
    }
    
    // Otherwise return filtered manifest
    return buildCompressedManifest(prediction.categories);
  }

  /**
   * Get the full tool context for a user message
   */
  async getOptimizedToolContext(userQuery: string): Promise<{
    context: string;
    prediction: ToolPrediction;
  }> {
    const prediction = await this.predictTools(userQuery);
    const context = this.buildToolContext(prediction);
    
    return { context, prediction };
  }

  /**
   * Get full compressed manifest (all tools)
   */
  getFullManifest(): string {
    return buildCompressedManifest();
  }

  /**
   * Get all tool definitions
   */
  getAllTools(): ToolDef[] {
    return [...ALL_TOOLS];
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): ToolDef[] {
    return ALL_TOOLS.filter(t => t.category === category);
  }
}

export const jitToolProtocol = new JITToolProtocol();
