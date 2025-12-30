/**
 * JIT (Just-In-Time) Tool Protocol
 * 
 * Lightweight preprocessor using Gemini 2.0 Flash Lite to predict which tools
 * are needed based on user query, then injects only relevant detailed examples
 * into context instead of full tool manifest every call.
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
  | "general";

// Tool prediction result
export interface ToolPrediction {
  categories: ToolCategory[];
  confidence: number;
  reasoning: string;
}

// Detailed tool example with usage pattern
interface ToolExample {
  tool: string;
  category: ToolCategory;
  description: string;
  example: string;
  priority: number; // 1-10, higher = more common
}

// Top 10 most common tools (always included in base manifest)
const CORE_TOOLS: string[] = [
  "send_chat",
  "say",
  "gmail_list",
  "gmail_send",
  "calendar_events",
  "calendar_create",
  "drive_list",
  "drive_search",
  "file_get",
  "file_put",
];

// Full tool examples repository
const TOOL_EXAMPLES: ToolExample[] = [
  // Email tools
  {
    tool: "gmail_list",
    category: "email",
    description: "List inbox emails",
    example: `{"type": "gmail_list", "id": "e1", "operation": "list", "parameters": {"maxResults": 5}}`,
    priority: 9,
  },
  {
    tool: "gmail_read",
    category: "email",
    description: "Read full email content",
    example: `{"type": "gmail_read", "id": "e2", "operation": "read", "parameters": {"messageId": "abc123"}}`,
    priority: 7,
  },
  {
    tool: "gmail_search",
    category: "email",
    description: "Search emails with Gmail syntax",
    example: `{"type": "gmail_search", "id": "e3", "operation": "search", "parameters": {"query": "from:boss@company.com is:unread", "maxResults": 10}}`,
    priority: 8,
  },
  {
    tool: "gmail_send",
    category: "email",
    description: "Send email",
    example: `{"type": "gmail_send", "id": "e4", "operation": "send", "parameters": {"to": "user@example.com", "subject": "Hello", "body": "Message content here"}}`,
    priority: 9,
  },
  
  // Calendar tools
  {
    tool: "calendar_list",
    category: "calendar",
    description: "List all calendars",
    example: `{"type": "calendar_list", "id": "c1", "operation": "list", "parameters": {}}`,
    priority: 6,
  },
  {
    tool: "calendar_events",
    category: "calendar",
    description: "List calendar events",
    example: `{"type": "calendar_events", "id": "c2", "operation": "list", "parameters": {"timeMin": "2024-01-01T00:00:00Z", "timeMax": "2024-01-31T23:59:59Z", "maxResults": 10}}`,
    priority: 9,
  },
  {
    tool: "calendar_create",
    category: "calendar",
    description: "Create calendar event",
    example: `{"type": "calendar_create", "id": "c3", "operation": "create", "parameters": {"summary": "Team Meeting", "start": "2024-01-15T14:00:00", "end": "2024-01-15T15:00:00", "description": "Weekly sync"}}`,
    priority: 9,
  },
  {
    tool: "calendar_update",
    category: "calendar",
    description: "Update calendar event",
    example: `{"type": "calendar_update", "id": "c4", "operation": "update", "parameters": {"eventId": "event123", "summary": "Updated Meeting"}}`,
    priority: 6,
  },
  {
    tool: "calendar_delete",
    category: "calendar",
    description: "Delete calendar event",
    example: `{"type": "calendar_delete", "id": "c5", "operation": "delete", "parameters": {"eventId": "event123"}}`,
    priority: 5,
  },
  
  // Drive tools
  {
    tool: "drive_list",
    category: "drive",
    description: "List files in Drive",
    example: `{"type": "drive_list", "id": "d1", "operation": "list", "parameters": {"maxResults": 10}}`,
    priority: 8,
  },
  {
    tool: "drive_search",
    category: "drive",
    description: "Search files in Drive",
    example: `{"type": "drive_search", "id": "d2", "operation": "search", "parameters": {"query": "project report", "maxResults": 5}}`,
    priority: 8,
  },
  {
    tool: "drive_read",
    category: "drive",
    description: "Read file content from Drive",
    example: `{"type": "drive_read", "id": "d3", "operation": "read", "parameters": {"fileId": "1abc123xyz"}}`,
    priority: 7,
  },
  {
    tool: "drive_create",
    category: "drive",
    description: "Create file in Drive",
    example: `{"type": "drive_create", "id": "d4", "operation": "create", "parameters": {"name": "notes.txt", "content": "File content", "mimeType": "text/plain"}}`,
    priority: 6,
  },
  
  // Docs tools
  {
    tool: "docs_read",
    category: "docs",
    description: "Read Google Doc",
    example: `{"type": "docs_read", "id": "doc1", "operation": "read", "parameters": {"documentId": "1abc123xyz"}}`,
    priority: 7,
  },
  {
    tool: "docs_create",
    category: "docs",
    description: "Create Google Doc",
    example: `{"type": "docs_create", "id": "doc2", "operation": "create", "parameters": {"title": "My Document", "content": "Initial content"}}`,
    priority: 6,
  },
  
  // Sheets tools
  {
    tool: "sheets_read",
    category: "sheets",
    description: "Read Google Sheet",
    example: `{"type": "sheets_read", "id": "sh1", "operation": "read", "parameters": {"spreadsheetId": "1abc", "range": "Sheet1!A1:D10"}}`,
    priority: 7,
  },
  {
    tool: "sheets_write",
    category: "sheets",
    description: "Write to Google Sheet",
    example: `{"type": "sheets_write", "id": "sh2", "operation": "write", "parameters": {"spreadsheetId": "1abc", "range": "Sheet1!A1", "values": [["Name", "Value"], ["Item 1", "100"]]}}`,
    priority: 6,
  },
  
  // Tasks tools
  {
    tool: "tasks_list",
    category: "tasks",
    description: "List task lists",
    example: `{"type": "tasks_list", "id": "t1", "operation": "list", "parameters": {}}`,
    priority: 7,
  },
  {
    tool: "tasks_get",
    category: "tasks",
    description: "Get tasks from a list",
    example: `{"type": "tasks_get", "id": "t2", "operation": "get", "parameters": {"taskListId": "list123"}}`,
    priority: 7,
  },
  {
    tool: "tasks_create",
    category: "tasks",
    description: "Create task",
    example: `{"type": "tasks_create", "id": "t3", "operation": "create", "parameters": {"title": "Buy groceries", "notes": "Milk, eggs, bread"}}`,
    priority: 7,
  },
  
  // GitHub tools
  {
    tool: "github_repos",
    category: "github",
    description: "List repositories",
    example: `{"type": "github_repos", "id": "g1", "operation": "list", "parameters": {}}`,
    priority: 7,
  },
  {
    tool: "github_contents",
    category: "github",
    description: "List directory contents or get file info from repo",
    example: `{"type": "github_contents", "id": "g2", "operation": "contents", "parameters": {"owner": "user", "repo": "project", "path": "src/"}}`,
    priority: 9,
  },
  {
    tool: "github_file_read",
    category: "github",
    description: "Read file from repo",
    example: `{"type": "github_file_read", "id": "g3", "operation": "read", "parameters": {"owner": "user", "repo": "project", "path": "src/index.ts"}}`,
    priority: 7,
  },
  {
    tool: "github_issues",
    category: "github",
    description: "List repository issues",
    example: `{"type": "github_issues", "id": "g3", "operation": "list", "parameters": {"owner": "user", "repo": "project", "state": "open"}}`,
    priority: 6,
  },
  {
    tool: "github_issue_create",
    category: "github",
    description: "Create GitHub issue",
    example: `{"type": "github_issue_create", "id": "g4", "operation": "create", "parameters": {"owner": "user", "repo": "project", "title": "Bug report", "body": "Description of issue"}}`,
    priority: 6,
  },
  {
    tool: "github_pr_create",
    category: "github",
    description: "Create pull request",
    example: `{"type": "github_pr_create", "id": "g5", "operation": "create", "parameters": {"owner": "user", "repo": "project", "title": "Feature X", "head": "feature-branch", "base": "main"}}`,
    priority: 5,
  },
  
  // Search tools
  {
    tool: "web_search",
    category: "search",
    description: "Web search",
    example: `{"type": "web_search", "id": "s1", "operation": "search", "parameters": {"query": "latest news about AI", "maxResults": 5}}`,
    priority: 8,
  },
  {
    tool: "google_search",
    category: "search",
    description: "Google search",
    example: `{"type": "google_search", "id": "s2", "operation": "search", "parameters": {"query": "best restaurants nearby"}}`,
    priority: 7,
  },
  
  // File tools
  {
    tool: "file_get",
    category: "file",
    description: "Read local file or editor canvas",
    example: `{"type": "file_get", "id": "f1", "operation": "read", "parameters": {"path": "editor:/app/src/main.js"}}`,
    priority: 9,
  },
  {
    tool: "file_put",
    category: "file",
    description: "Write local file or editor canvas",
    example: `{"type": "file_put", "id": "f2", "operation": "write", "parameters": {"path": "editor:/app/src/main.js", "content": "console.log('Hello');"}}`,
    priority: 9,
  },
  
  // Terminal tools
  {
    tool: "terminal_execute",
    category: "file",
    description: "Execute shell command",
    example: `{"type": "terminal_execute", "id": "t1", "operation": "execute", "parameters": {"command": "ls -la", "timeout": 30000}}`,
    priority: 9,
  },
  
  // Voice tools
  {
    tool: "say",
    category: "voice",
    description: "Speak text with TTS",
    example: `{"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "Hello, how can I help?", "voiceId": "Kore", "style": "Say warmly"}}`,
    priority: 10,
  },
  
  // Codebase tools
  {
    tool: "codebase_analyze",
    category: "codebase",
    description: "Analyze codebase structure",
    example: `{"type": "codebase_analyze", "id": "ca1", "operation": "analyze", "parameters": {"path": "."}}`,
    priority: 5,
  },
  
  // Contacts tools
  {
    tool: "contacts_list",
    category: "contacts",
    description: "List contacts",
    example: `{"type": "contacts_list", "id": "ct1", "operation": "list", "parameters": {"maxResults": 20}}`,
    priority: 6,
  },
  {
    tool: "contacts_search",
    category: "contacts",
    description: "Search contacts",
    example: `{"type": "contacts_search", "id": "ct2", "operation": "search", "parameters": {"query": "John"}}`,
    priority: 6,
  },
  
  // General tools (always included)
  {
    tool: "send_chat",
    category: "general",
    description: "Send text to chat window",
    example: `{"type": "send_chat", "id": "chat1", "operation": "respond", "parameters": {"content": "Here's my response with **markdown** support."}}`,
    priority: 10,
  },
];

// Compressed base manifest (always included)
const BASE_MANIFEST = `## Core Tools (Always Available)
| Tool | Description |
|------|-------------|
| send_chat | Send text to chat (content:string) |
| say | Speak with TTS (utterance:string, voiceId?, style?) |
| gmail_list | List emails (maxResults?) |
| gmail_send | Send email (to, subject, body) |
| calendar_events | List events (timeMin?, timeMax?) |
| calendar_create | Create event (summary, start, end) |
| drive_list | List Drive files |
| drive_search | Search Drive (query) |
| file_get | Read file (path) |
| file_put | Write file (path, content) |`;

// Category keywords for prediction
const CATEGORY_KEYWORDS: Record<ToolCategory, string[]> = {
  email: ["email", "mail", "inbox", "send", "message", "unread", "gmail", "reply", "forward"],
  calendar: ["calendar", "event", "meeting", "schedule", "appointment", "remind", "when", "today", "tomorrow", "week"],
  drive: ["drive", "file", "folder", "document", "upload", "download", "share", "storage"],
  docs: ["doc", "document", "google doc", "write", "draft", "text"],
  sheets: ["sheet", "spreadsheet", "excel", "data", "table", "cell", "row", "column"],
  tasks: ["task", "todo", "to-do", "checklist", "reminder", "done", "complete"],
  github: ["github", "repo", "repository", "code", "commit", "pull request", "pr", "issue", "branch"],
  search: ["search", "find", "look up", "google", "web", "internet", "research"],
  file: ["file", "read", "write", "edit", "editor", "code", "save", "open"],
  voice: ["say", "speak", "voice", "audio", "talk", "tell"],
  browser: ["browser", "webpage", "website", "url", "screenshot", "navigate"],
  codebase: ["codebase", "analyze", "project", "structure", "glossary"],
  contacts: ["contact", "person", "phone", "address", "people"],
  general: [],
};

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
   * Uses Gemini 2.0 Flash for speed
   */
  async predictTools(userQuery: string): Promise<ToolPrediction> {
    // First, try keyword-based fast prediction
    const keywordCategories = this.keywordBasedPrediction(userQuery);
    
    // If we have high-confidence keyword matches, use those
    if (keywordCategories.length > 0) {
      return {
        categories: keywordCategories,
        confidence: 0.8,
        reasoning: `Keyword-based prediction: ${keywordCategories.join(", ")}`,
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
      reasoning: "Fallback to general tools",
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
          break; // Only add each category once
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

    const prompt = `Analyze this user query and predict which tool categories will be needed.

Categories:
- email: Gmail operations (read, send, search emails)
- calendar: Calendar events (list, create, update)
- drive: Google Drive files (list, search, read, create)
- docs: Google Docs (read, create, edit)
- sheets: Google Sheets (read, write data)
- tasks: Google Tasks (list, create, complete)
- github: GitHub repos, issues, PRs
- search: Web search
- file: Local file operations
- voice: Text-to-speech
- browser: Web browsing, screenshots
- codebase: Code analysis
- contacts: People/contacts
- general: Basic chat/response

User query: "${query}"

Respond with JSON only:
{"categories": ["category1", "category2"], "confidence": 0.9, "reasoning": "brief explanation"}`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.1, maxOutputTokens: 200 },
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
    const relevantExamples: ToolExample[] = [];
    
    // Always include general tools
    const generalTools = TOOL_EXAMPLES.filter(t => t.category === "general");
    relevantExamples.push(...generalTools);

    // Add tools for predicted categories
    for (const category of prediction.categories) {
      const categoryTools = TOOL_EXAMPLES.filter(t => t.category === category);
      relevantExamples.push(...categoryTools);
    }

    // Sort by priority, dedupe
    const uniqueTools = Array.from(new Map(relevantExamples.map(t => [t.tool, t])).values());
    uniqueTools.sort((a, b) => b.priority - a.priority);

    // Build context
    let context = BASE_MANIFEST + "\n\n";
    
    if (prediction.categories.length > 0 && prediction.categories[0] !== "general") {
      context += `## Predicted Tools: ${prediction.categories.join(", ")}\n\n`;
      
      for (const example of uniqueTools.slice(0, 15)) { // Limit to top 15
        context += `### ${example.tool}\n`;
        context += `${example.description}\n`;
        context += `\`\`\`json\n${example.example}\n\`\`\`\n\n`;
      }
    }

    return context;
  }

  /**
   * Get the full tool context for a user message
   * Combines prediction + context building
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
   * Get all available tool examples (for debugging/reference)
   */
  getAllExamples(): ToolExample[] {
    return [...TOOL_EXAMPLES];
  }

  /**
   * Get core tools list
   */
  getCoreTools(): string[] {
    return [...CORE_TOOLS];
  }
}

export const jitToolProtocol = new JITToolProtocol();
