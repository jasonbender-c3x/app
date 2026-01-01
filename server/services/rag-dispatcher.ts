/**
 * =============================================================================
 * NEBULA CHAT - RAG DISPATCHER SERVICE
 * =============================================================================
 * 
 * Handles the dispatch and execution of structured LLM outputs.
 * 
 * RESPONSIBILITIES:
 * -----------------
 * 1. Parse structured LLM responses into actionable operations
 * 2. Execute tool calls (API calls, file operations, searches)
 * 3. Process file creation/modification requests
 * 4. Handle autoexec script execution with security guardrails
 * 5. Format outputs using the defined delimiter system
 * 
 * EXECUTION FLOW:
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │                        RAG DISPATCHER                                 │
 * │                                                                        │
 * │  Structured LLM Response                                               │
 * │          │                                                             │
 * │          ▼                                                             │
 * │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────────┐│
 * │  │ Validate Schema │───▶│ Execute Tools   │───▶│ Process File Ops  ││
 * │  └─────────────────┘    └─────────────────┘    └────────────────────┘│
 * │          │                      │                       │             │
 * │          ▼                      ▼                       ▼             │
 * │  ┌─────────────────────────────────────────────────────────────────┐ │
 * │  │ Log Execution Results & Return Chat Content                     │ │
 * │  └─────────────────────────────────────────────────────────────────┘ │
 * └───────────────────────────────────────────────────────────────────────┘
 * =============================================================================
 */

import { storage } from "../storage";
import { 
  structuredLLMResponseSchema,
  type StructuredLLMResponse,
  type ToolCall,
  type FileOperation,
  type BinaryFileOperation,
  type AutoexecScript,
  webSearchParamsSchema,
  googleSearchParamsSchema,
  duckduckgoSearchParamsSchema,
  browserScrapeParamsSchema
} from "@shared/schema";
import { webSearch, formatSearchResult } from "../integrations/web-search";
import { searchWeb } from "../integrations/web-scraper";
import { browserScrape } from "../integrations/browser-scraper";
import { tavilySearch, tavilyQnA, tavilyDeepResearch } from "../integrations/tavily";
import { perplexitySearch, perplexityQuickAnswer, perplexityDeepResearch, perplexityNews } from "../integrations/perplexity";
import * as googleTasks from "../integrations/google-tasks";
import * as gmail from "../integrations/gmail";
import * as googleCalendar from "../integrations/google-calendar";
import * as googleDrive from "../integrations/google-drive";
import * as googleDocs from "../integrations/google-docs";
import * as googleSheets from "../integrations/google-sheets";
import * as googleContacts from "../integrations/google-contacts";
import * as github from "../integrations/github";
import * as browserbase from "../integrations/browserbase";
import * as twilio from "../integrations/twilio";
import { ragService } from "./rag-service";
import { chunkingService } from "./chunking-service";
import { clientRouter } from "./client-router";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";

/**
 * Path Prefix Routing System
 * 
 * Unified prefix system for file and terminal operations:
 * 
 * FILE PATHS (file_get, file_put):
 * - server:path or just path → Server filesystem (default)
 * - client:path → Client machine via connected desktop-app
 * - editor:path → Monaco editor canvas
 * 
 * TERMINAL COMMANDS (terminal_execute):
 * - server:command or just command → Server (default)
 * - client:command → Client machine via connected desktop-app
 * 
 * EDITOR OPERATIONS (editor_load):
 * - editor:server:path or editor:path → Load file from server into Monaco editor (default)
 * - editor:client:path → Load file from client into Monaco editor
 */

type PathTarget = 'server' | 'client' | 'editor';

interface ParsedPath {
  target: PathTarget;
  path: string;
  editorSubTarget?: 'server' | 'client'; // For editor:server: or editor:client:
}

/**
 * Parse a path with prefix routing
 * Returns the target (server/client/editor) and the clean path
 * 
 * Throws error for invalid prefixes (e.g., client: with no path)
 */
function parsePathPrefix(rawPath: string, defaultTarget: PathTarget = 'server'): ParsedPath {
  if (!rawPath) return { target: defaultTarget, path: '' };
  
  // Handle editor: prefix with possible sub-target
  if (rawPath.startsWith('editor:')) {
    const afterEditor = rawPath.substring('editor:'.length);
    
    if (afterEditor.startsWith('client:')) {
      const clientPath = afterEditor.substring('client:'.length);
      if (!clientPath || clientPath.trim() === '') {
        throw new Error('editor:client: requires a path (e.g., editor:client:/home/user/file.txt)');
      }
      return { 
        target: 'editor', 
        path: clientPath,
        editorSubTarget: 'client'
      };
    }
    if (afterEditor.startsWith('server:')) {
      const serverPath = afterEditor.substring('server:'.length);
      if (!serverPath || serverPath.trim() === '') {
        throw new Error('editor:server: requires a path (e.g., editor:server:src/index.ts)');
      }
      return { 
        target: 'editor', 
        path: serverPath,
        editorSubTarget: 'server'
      };
    }
    // editor: without sub-target - path is filename for editor canvas
    // This is for writing directly to editor, no source file needed
    if (!afterEditor || afterEditor.trim() === '') {
      throw new Error('editor: requires a filename (e.g., editor:app.tsx)');
    }
    return { target: 'editor', path: afterEditor, editorSubTarget: undefined };
  }
  
  // Handle client: prefix
  if (rawPath.startsWith('client:')) {
    const clientPath = rawPath.substring('client:'.length);
    if (!clientPath || clientPath.trim() === '') {
      throw new Error('client: requires a path (e.g., client:/home/user/file.txt)');
    }
    return { target: 'client', path: clientPath };
  }
  
  // Handle explicit server: prefix
  if (rawPath.startsWith('server:')) {
    const serverPath = rawPath.substring('server:'.length);
    if (!serverPath || serverPath.trim() === '') {
      throw new Error('server: requires a path (e.g., server:package.json)');
    }
    return { target: 'server', path: serverPath };
  }
  
  // No prefix = default target
  return { target: defaultTarget, path: rawPath };
}

/**
 * Zod schemas for tool call parameter validation
 * Ensures type safety when executing tool calls
 */
const apiCallParamsSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).default("GET"),
  headers: z.record(z.string()).optional().default({}),
  body: z.unknown().optional()
});

const searchParamsSchema = z.object({
  query: z.string(),
  scope: z.string().optional()
});

const execAsync = promisify(exec);

const AUTOEXEC_DISABLED = false;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for created files

/**
 * Result of autoexec script execution
 */
export interface AutoexecExecutionResult {
  command: string;
  output: string;
  exitCode: number;
  success: boolean;
  duration: number;
}

/**
 * Result of dispatching a structured response
 */
export interface DispatchResult {
  success: boolean;
  chatContent?: string;
  filesCreated: string[];
  filesModified: string[];
  toolResults: ToolExecutionResult[];
  errors: string[];
  executionTime: number;
  pendingAutoexec: AutoexecScript | null;
}

/**
 * Result of executing a single tool call
 */
export interface ToolExecutionResult {
  toolId: string;
  type: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

/**
 * RAGDispatcher
 * 
 * Orchestrates the execution of structured LLM outputs.
 */
export class RAGDispatcher {
  /**
   * Base directory for file operations (sandboxed)
   */
  private readonly workspaceDir: string;

  constructor() {
    this.workspaceDir = process.cwd();
  }

  /**
   * Dispatch and execute a structured LLM response
   * 
   * @param response - The structured response from the LLM
   * @param messageId - ID of the message triggering this dispatch
   * @returns Dispatch result with all execution outcomes
   */
  async dispatch(response: unknown, messageId: string): Promise<DispatchResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const toolResults: ToolExecutionResult[] = [];

    const parseResult = structuredLLMResponseSchema.safeParse(response);
    if (!parseResult.success) {
      return {
        success: false,
        chatContent: "Failed to parse structured response",
        filesCreated: [],
        filesModified: [],
        toolResults: [],
        errors: [parseResult.error.message],
        executionTime: Date.now() - startTime,
        pendingAutoexec: null
      };
    }

    const structured = parseResult.data;

    // Execute all tool calls - file operations are now done via file_put tool
    if (structured.toolCalls && structured.toolCalls.length > 0) {
      for (const toolCall of structured.toolCalls) {
        const result = await this.executeToolCall(toolCall, messageId);
        toolResults.push(result);
        if (!result.success && result.error) {
          errors.push(`Tool ${toolCall.id}: ${result.error}`);
        }
        // Track file operations from file_put tool results
        if (toolCall.type === "file_put" && result.success) {
          const filePath = (toolCall.parameters as { path?: string })?.path;
          if (filePath) {
            filesCreated.push(filePath);
          }
        }
      }
    }

    // Extract chat content from send_chat tool results
    let chatContent = "";
    for (const result of toolResults) {
      if (result.type === "send_chat" && result.success && result.result) {
        const sendChatResult = result.result as { content?: string };
        if (sendChatResult.content) {
          chatContent += sendChatResult.content + "\n";
        }
      }
    }

    return {
      success: errors.length === 0,
      chatContent: chatContent.trim() || undefined,
      filesCreated,
      filesModified,
      toolResults,
      errors,
      executionTime: Date.now() - startTime,
      pendingAutoexec: null
    };
  }

  /**
   * Execute a single tool call (public for external use)
   */
  async executeToolCall(toolCall: ToolCall, messageId: string): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let taskId: string | null = null;

    try {
      const task = await storage.createToolTask({
        messageId,
        taskType: toolCall.type,
        payload: toolCall,
        status: "running"
      });
      taskId = task.id;

      let result: unknown;

      switch (toolCall.type) {
        case "api_call":
          result = await this.executeApiCall(toolCall);
          break;
        case "search":
          result = await this.executeSearch(toolCall);
          break;
        case "web_search":
          result = await this.executeWebSearch(toolCall);
          break;
        case "google_search":
          result = await this.executeGoogleSearch(toolCall);
          break;
        case "duckduckgo_search":
          result = await this.executeDuckDuckGoSearch(toolCall);
          break;
        case "browser_scrape":
          result = await this.executeBrowserScrape(toolCall);
          break;
        case "file_ingest":
          result = await this.executeFileOperation(toolCall);
          break;
        case "file_get":
          result = await this.executeFileGet(toolCall);
          break;
        case "file_put":
          result = await this.executeFilePut(toolCall);
          break;
        case "tasks_list":
          result = await this.executeTasksList(toolCall);
          break;
        case "tasks_get":
          result = await this.executeTasksGet(toolCall);
          break;
        case "tasks_create":
          result = await this.executeTasksCreate(toolCall);
          break;
        case "tasks_update":
          result = await this.executeTasksUpdate(toolCall);
          break;
        case "tasks_delete":
          result = await this.executeTasksDelete(toolCall);
          break;
        case "tasks_complete":
          result = await this.executeTasksComplete(toolCall);
          break;
        case "gmail_list":
          result = await this.executeGmailList(toolCall);
          break;
        case "gmail_read":
          result = await this.executeGmailRead(toolCall);
          break;
        case "gmail_send":
          result = await this.executeGmailSend(toolCall);
          break;
        case "gmail_search":
          result = await this.executeGmailSearch(toolCall);
          break;
        case "sms_send":
          result = await this.executeSmsSend(toolCall);
          break;
        case "sms_list":
          result = await this.executeSmsList(toolCall);
          break;
        case "call_make":
          result = await this.executeCallMake(toolCall);
          break;
        case "call_list":
          result = await this.executeCallList(toolCall);
          break;
        case "calendar_list":
          result = await this.executeCalendarList(toolCall);
          break;
        case "calendar_events":
          result = await this.executeCalendarEvents(toolCall);
          break;
        case "calendar_create":
          result = await this.executeCalendarCreate(toolCall);
          break;
        case "calendar_update":
          result = await this.executeCalendarUpdate(toolCall);
          break;
        case "calendar_delete":
          result = await this.executeCalendarDelete(toolCall);
          break;
        case "drive_list":
          result = await this.executeDriveList(toolCall);
          break;
        case "drive_read":
          result = await this.executeDriveRead(toolCall);
          break;
        case "drive_search":
          result = await this.executeDriveSearch(toolCall);
          break;
        case "drive_create":
          result = await this.executeDriveCreate(toolCall);
          break;
        case "drive_update":
          result = await this.executeDriveUpdate(toolCall);
          break;
        case "drive_delete":
          result = await this.executeDriveDelete(toolCall);
          break;
        case "docs_read":
          result = await this.executeDocsRead(toolCall);
          break;
        case "docs_create":
          result = await this.executeDocsCreate(toolCall);
          break;
        case "docs_append":
          result = await this.executeDocsAppend(toolCall);
          break;
        case "docs_replace":
          result = await this.executeDocsReplace(toolCall);
          break;
        case "sheets_read":
          result = await this.executeSheetsRead(toolCall);
          break;
        case "sheets_create":
          result = await this.executeSheetsCreate(toolCall);
          break;
        case "sheets_write":
          result = await this.executeSheetsWrite(toolCall);
          break;
        case "sheets_append":
          result = await this.executeSheetsAppend(toolCall);
          break;
        case "sheets_clear":
          result = await this.executeSheetsClear(toolCall);
          break;
        case "terminal_execute":
          result = await this.executeTerminal(toolCall);
          break;
        case "tavily_search":
          result = await this.executeTavilySearch(toolCall);
          break;
        case "tavily_qna":
          result = await this.executeTavilyQnA(toolCall);
          break;
        case "tavily_research":
          result = await this.executeTavilyResearch(toolCall);
          break;
        case "perplexity_search":
          result = await this.executePerplexitySearch(toolCall);
          break;
        case "perplexity_quick":
          result = await this.executePerplexityQuick(toolCall);
          break;
        case "perplexity_research":
          result = await this.executePerplexityResearch(toolCall);
          break;
        case "perplexity_news":
          result = await this.executePerplexityNews(toolCall);
          break;
        case "github_repos":
          result = await this.executeGithubRepos(toolCall);
          break;
        case "github_repo_get":
          result = await this.executeGithubRepoGet(toolCall);
          break;
        case "github_repo_search":
          result = await this.executeGithubRepoSearch(toolCall);
          break;
        case "github_contents":
          result = await this.executeGithubContents(toolCall);
          break;
        case "github_file_read":
          result = await this.executeGithubFileRead(toolCall);
          break;
        case "github_code_search":
          result = await this.executeGithubCodeSearch(toolCall);
          break;
        case "github_issues":
          result = await this.executeGithubIssues(toolCall);
          break;
        case "github_issue_get":
          result = await this.executeGithubIssueGet(toolCall);
          break;
        case "github_issue_create":
          result = await this.executeGithubIssueCreate(toolCall);
          break;
        case "github_issue_update":
          result = await this.executeGithubIssueUpdate(toolCall);
          break;
        case "github_issue_comment":
          result = await this.executeGithubIssueComment(toolCall);
          break;
        case "github_pulls":
          result = await this.executeGithubPulls(toolCall);
          break;
        case "github_pull_get":
          result = await this.executeGithubPullGet(toolCall);
          break;
        case "github_commits":
          result = await this.executeGithubCommits(toolCall);
          break;
        case "github_user":
          result = await this.executeGithubUser(toolCall);
          break;
        case "browserbase_load":
          result = await this.executeBrowserbaseLoad(toolCall);
          break;
        case "browserbase_screenshot":
          result = await this.executeBrowserbaseScreenshot(toolCall);
          break;
        case "browserbase_action":
          result = await this.executeBrowserbaseAction(toolCall);
          break;
        case "contacts_list":
          result = await this.executeContactsList(toolCall);
          break;
        case "contacts_search":
          result = await this.executeContactsSearch(toolCall);
          break;
        case "contacts_get":
          result = await this.executeContactsGet(toolCall);
          break;
        case "contacts_create":
          result = await this.executeContactsCreate(toolCall);
          break;
        case "contacts_update":
          result = await this.executeContactsUpdate(toolCall);
          break;
        case "contacts_delete":
          result = await this.executeContactsDelete(toolCall);
          break;
        case "debug_echo":
          result = await this.executeDebugEcho(toolCall);
          break;
        case "queue_create":
          result = await this.executeQueueCreate(toolCall);
          break;
        case "queue_batch":
          result = await this.executeQueueBatch(toolCall);
          break;
        case "queue_list":
          result = await this.executeQueueList(toolCall);
          break;
        case "queue_start":
          result = await this.executeQueueStart(toolCall);
          break;
        default:
          result = { message: `Custom tool type: ${toolCall.type}` };
      }

      // Update task status to completed
      if (taskId) {
        await storage.updateToolTaskStatus(taskId, "completed", result);
      }

      return {
        toolId: toolCall.id,
        type: toolCall.type,
        success: true,
        result,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      // Update task status to failed
      if (taskId) {
        await storage.updateToolTaskStatus(taskId, "failed", undefined, error.message);
      }
      
      return {
        toolId: toolCall.id,
        type: toolCall.type,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Execute an API call tool with validated parameters
   */
  private async executeApiCall(toolCall: ToolCall): Promise<unknown> {
    const parseResult = apiCallParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid API call parameters: ${parseResult.error.message}`);
    }

    const { url, method, headers, body } = parseResult.data;

    const isGetOrHead = method === "GET" || method === "HEAD";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: isGetOrHead ? undefined : (body ? JSON.stringify(body) : undefined)
    });

    return response.json();
  }

  /**
   * Execute a search operation with validated parameters
   */
  private async executeSearch(toolCall: ToolCall): Promise<unknown> {
    const parseResult = searchParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid search parameters: ${parseResult.error.message}`);
    }

    const { query, scope } = parseResult.data;
    return { message: `Search executed for: ${query}`, scope };
  }

  /**
   * Execute a web search using Perplexity API
   */
  private async executeWebSearch(toolCall: ToolCall): Promise<unknown> {
    const parseResult = webSearchParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid web search parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const result = await webSearch({
      query: params.query,
      maxTokens: params.maxTokens,
      searchRecency: params.searchRecency,
      domains: params.domains
    });

    if (!result.success) {
      throw new Error(result.error || "Web search failed");
    }

    return {
      content: result.content,
      citations: result.citations,
      formattedResult: formatSearchResult(result)
    };
  }

  /**
   * Execute Google Custom Search (fast, API-based)
   */
  private async executeGoogleSearch(toolCall: ToolCall): Promise<unknown> {
    const parseResult = googleSearchParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid Google search parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const result = await webSearch({
      query: params.query,
      maxTokens: 1024,
      searchRecency: params.searchRecency,
      domains: params.domains
    });

    if (!result.success) {
      throw new Error(result.error || "Google search failed");
    }

    return {
      success: true,
      query: params.query,
      results: result.citations?.map((url, i) => ({
        url,
        snippet: result.content?.split('\n').slice(i * 3, (i + 1) * 3).join('\n') || ''
      })) || [],
      content: result.content,
      formattedResult: formatSearchResult(result)
    };
  }

  /**
   * Execute DuckDuckGo search (free, no API key needed)
   */
  private async executeDuckDuckGoSearch(toolCall: ToolCall): Promise<unknown> {
    const parseResult = duckduckgoSearchParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid DuckDuckGo search parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const response = await searchWeb(params.query, params.maxResults);

    if (!response.success) {
      throw new Error(response.error || "DuckDuckGo search failed");
    }

    return {
      success: true,
      query: params.query,
      results: response.results,
      count: response.results.length
    };
  }

  /**
   * Execute browser scrape using Playwright (for JS-heavy sites)
   */
  private async executeBrowserScrape(toolCall: ToolCall): Promise<unknown> {
    const parseResult = browserScrapeParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid browser scrape parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const result = await browserScrape(params.url, params.timeout);

    if (!result.success) {
      throw new Error(result.error || "Browser scrape failed");
    }

    return {
      success: true,
      url: result.url,
      title: result.title,
      content: result.content
    };
  }

  /**
   * Execute file ingest/upload operations
   */
  private async executeFileOperation(toolCall: ToolCall): Promise<unknown> {
    return { message: "File operation processed", parameters: toolCall.parameters };
  }

  /**
   * Process a text file creation/replacement
   * 
   * PROTOCOL:
   * - If path starts with "editor:" → save to Monaco editor canvas (frontend handling)
   * - Otherwise → write to filesystem
   */
  private async processTextFile(fileOp: FileOperation): Promise<string> {
    const content = fileOp.encoding === "base64" 
      ? Buffer.from(fileOp.content, "base64").toString("utf8")
      : fileOp.content;

    if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File content exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
    }

    // Handle editor: prefix - files meant for Monaco editor canvas
    if (fileOp.path.startsWith("editor:")) {
      const editorPath = fileOp.path.substring("editor:".length) || `/${fileOp.filename}`;
      console.log(`[RAGDispatcher] Targeting file to editor canvas: ${editorPath}`);
      // Return editor path for frontend processing
      return editorPath;
    }

    // Standard filesystem write
    const sanitizedPath = this.sanitizePath(fileOp.path, fileOp.filename);
    const fullPath = path.join(this.workspaceDir, sanitizedPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf8");

    if (fileOp.permissions) {
      try {
        await fs.chmod(fullPath, parseInt(fileOp.permissions, 8));
      } catch (error) {
        console.warn(`[RAGDispatcher] Failed to set permissions ${fileOp.permissions} on ${sanitizedPath}:`, error);
      }
    }

    return sanitizedPath;
  }

  /**
   * Process a file append operation
   */
  private async processAppendFile(fileOp: FileOperation): Promise<string> {
    const content = fileOp.encoding === "base64"
      ? Buffer.from(fileOp.content, "base64").toString("utf8")
      : fileOp.content;

    const sanitizedPath = this.sanitizePath(fileOp.path, fileOp.filename);
    const fullPath = path.join(this.workspaceDir, sanitizedPath);

    await fs.appendFile(fullPath, content, "utf8");

    return sanitizedPath;
  }

  /**
   * Process a binary file creation
   * 
   * PROTOCOL:
   * - If path starts with "editor:" → save to Monaco editor canvas (frontend handling)
   * - Otherwise → write to filesystem
   */
  private async processBinaryFile(binOp: BinaryFileOperation): Promise<string> {
    const buffer = Buffer.from(binOp.base64Content, "base64");

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Binary file exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
    }

    // Handle editor: prefix - files meant for Monaco editor canvas
    if (binOp.path.startsWith("editor:")) {
      const editorPath = binOp.path.substring("editor:".length) || `/${binOp.filename}`;
      console.log(`[RAGDispatcher] Targeting binary file to editor canvas: ${editorPath}`);
      // Return editor path for frontend processing
      return editorPath;
    }

    // Standard filesystem write
    const sanitizedPath = this.sanitizePath(binOp.path, binOp.filename);
    const fullPath = path.join(this.workspaceDir, sanitizedPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    if (binOp.permissions) {
      try {
        await fs.chmod(fullPath, parseInt(binOp.permissions, 8));
      } catch (error) {
        console.warn(`[RAGDispatcher] Failed to set permissions ${binOp.permissions} on ${sanitizedPath}:`, error);
      }
    }

    return sanitizedPath;
  }

  /**
   * Process autoexec script (DISABLED by default for security)
   * Public method for async execution from routes.ts
   */
  async processAutoexec(
    autoexec: AutoexecScript, 
    messageId: string
  ): Promise<AutoexecExecutionResult> {
    const startTime = Date.now();
    const command = autoexec.content.split('\n').find(line => 
      line.trim() && !line.startsWith('#') && !line.startsWith('#!/')
    ) || autoexec.content.substring(0, 100);

    if (AUTOEXEC_DISABLED) {
      console.warn("[RAGDispatcher] Autoexec is disabled for security");
      return {
        command,
        output: "Autoexec execution is disabled for security reasons",
        exitCode: 1,
        success: false,
        duration: Date.now() - startTime
      };
    }

    try {
      const scriptPath = path.join(this.workspaceDir, ".nebula", "autoexec.666");
      await fs.mkdir(path.dirname(scriptPath), { recursive: true });
      await fs.writeFile(scriptPath, autoexec.content, "utf8");
      await fs.chmod(scriptPath, 0o700);

      await storage.createExecutionLog({
        taskId: null,
        action: "autoexec_start",
        input: { scriptPath, requiresSudo: autoexec.requiresSudo }
      });

      const execCommand = autoexec.requiresSudo ? `sudo ${scriptPath}` : scriptPath;
      const { stdout, stderr } = await execAsync(execCommand, {
        timeout: autoexec.timeout,
        cwd: this.workspaceDir
      });

      await storage.createExecutionLog({
        taskId: null,
        action: "autoexec_complete",
        output: { stdout },
        exitCode: "0"
      });

      return { 
        command,
        output: stdout + (stderr ? `\n${stderr}` : ''),
        exitCode: 0,
        success: true,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      const exitCode = error.code || 1;
      await storage.createExecutionLog({
        taskId: null,
        action: "autoexec_error",
        output: { error: error.message },
        exitCode: exitCode.toString()
      });

      return { 
        command,
        output: error.stderr || error.stdout || error.message,
        exitCode,
        success: false,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Sanitize file paths to prevent directory traversal attacks
   */
  private sanitizePath(filePath: string, filename: string): string {
    const cleanPath = filePath.replace(/\.\./g, "").replace(/^\/+/, "");
    const cleanFilename = path.basename(filename);
    return path.join(cleanPath, cleanFilename);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE TASKS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeTasksList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId?: string; showCompleted?: boolean };
    const tasks = await googleTasks.listTasks(params?.taskListId || '@default', params?.showCompleted ?? true);
    return { tasks, count: tasks.length };
  }

  private async executeTasksGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId: string; taskId: string };
    return await googleTasks.getTask(params.taskListId, params.taskId);
  }

  private async executeTasksCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { title: string; notes?: string; due?: string; taskListId?: string };
    return await googleTasks.createTask(params.taskListId || '@default', params.title, params.notes, params.due);
  }

  private async executeTasksUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId: string; taskId: string; updates: Record<string, unknown> };
    return await googleTasks.updateTask(params.taskListId, params.taskId, params.updates);
  }

  private async executeTasksDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId: string; taskId: string };
    return await googleTasks.deleteTask(params.taskListId, params.taskId);
  }

  private async executeTasksComplete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId: string; taskId: string };
    return await googleTasks.completeTask(params.taskListId, params.taskId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE CONTACTS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeContactsList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { pageSize?: number; pageToken?: string };
    const result = await googleContacts.listContacts(params?.pageSize || 100, params?.pageToken);
    return { contacts: result.contacts, count: result.contacts.length, nextPageToken: result.nextPageToken };
  }

  private async executeContactsSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; pageSize?: number };
    const contacts = await googleContacts.searchContacts(params.query, params?.pageSize || 30);
    return { contacts, count: contacts.length, query: params.query };
  }

  private async executeContactsGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { resourceName: string };
    const contact = await googleContacts.getContact(params.resourceName);
    if (!contact) {
      throw new Error(`Contact not found: ${params.resourceName}`);
    }
    return contact;
  }

  private async executeContactsCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      givenName: string;
      familyName?: string;
      email?: string;
      phoneNumber?: string;
      organization?: string;
      title?: string;
    };
    const contact = await googleContacts.createContact(params);
    return { success: true, contact, message: `Contact "${params.givenName}" created successfully` };
  }

  private async executeContactsUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      resourceName: string;
      givenName?: string;
      familyName?: string;
      email?: string;
      phoneNumber?: string;
      organization?: string;
      title?: string;
    };
    const { resourceName, ...updates } = params;
    const contact = await googleContacts.updateContact(resourceName, updates);
    return { success: true, contact, message: `Contact updated successfully` };
  }

  private async executeContactsDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { resourceName: string };
    const success = await googleContacts.deleteContact(params.resourceName);
    return { success, message: success ? "Contact deleted" : "Failed to delete contact" };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GMAIL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeGmailList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { maxResults?: number; labelIds?: string[] };
    const emails = await gmail.listEmails(params?.maxResults || 20, params?.labelIds || ['INBOX']);
    return { emails, count: emails.length };
  }

  private async executeGmailRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { messageId: string };
    return await gmail.getEmail(params.messageId);
  }

  private async executeGmailSend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { to: string; subject: string; body: string };
    return await gmail.sendEmail(params.to, params.subject, params.body);
  }

  private async executeGmailSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; maxResults?: number };
    const emails = await gmail.searchEmails(params.query, params.maxResults || 20);
    return { emails, count: emails.length, query: params.query };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE CALENDAR HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeCalendarList(toolCall: ToolCall): Promise<unknown> {
    const calendars = await googleCalendar.listCalendars();
    return { calendars, count: calendars.length };
  }

  private async executeCalendarEvents(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { calendarId?: string; timeMin?: string; timeMax?: string; maxResults?: number };
    const events = await googleCalendar.listEvents(params?.calendarId || 'primary', params?.timeMin, params?.timeMax, params?.maxResults || 20);
    return { events, count: events.length };
  }

  private async executeCalendarCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      summary: string; 
      start: string; 
      end: string; 
      description?: string; 
      calendarId?: string;
      timeZone?: string;
    };
    const startObj = { dateTime: params.start, timeZone: params.timeZone };
    const endObj = { dateTime: params.end, timeZone: params.timeZone };
    return await googleCalendar.createEvent(params.calendarId || 'primary', params.summary, startObj, endObj, params.description);
  }

  private async executeCalendarUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      calendarId: string; 
      eventId: string; 
      updates: Record<string, unknown>;
    };
    return await googleCalendar.updateEvent(params.calendarId, params.eventId, params.updates);
  }

  private async executeCalendarDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { calendarId: string; eventId: string };
    await googleCalendar.deleteEvent(params.calendarId, params.eventId);
    return { success: true, message: `Event ${params.eventId} deleted from calendar ${params.calendarId}` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DRIVE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeDriveList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query?: string; pageSize?: number };
    const files = await googleDrive.listDriveFiles(params?.query, params?.pageSize || 20);
    return { files, count: files.length };
  }

  private async executeDriveRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { fileId: string };
    return await googleDrive.getDriveFile(params.fileId);
  }

  private async executeDriveSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; pageSize?: number };
    const files = await googleDrive.searchDriveFiles(params.query);
    return { files, count: files.length, query: params.query };
  }

  private async executeDriveCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { name: string; content?: string; mimeType?: string };
    return await googleDrive.createDriveFile(params.name, params.content || '', params.mimeType || 'text/plain');
  }

  private async executeDriveUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { fileId: string; content: string; mimeType?: string };
    return await googleDrive.updateDriveFile(params.fileId, params.content, params.mimeType || 'text/plain');
  }

  private async executeDriveDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { fileId: string };
    await googleDrive.deleteDriveFile(params.fileId);
    return { success: true, message: `File ${params.fileId} deleted` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DOCS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeDocsRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { documentId: string };
    const text = await googleDocs.getDocumentText(params.documentId);
    return { documentId: params.documentId, text };
  }

  private async executeDocsCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { title: string };
    return await googleDocs.createDocument(params.title);
  }

  private async executeDocsAppend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { documentId: string; text: string };
    await googleDocs.appendText(params.documentId, params.text);
    return { success: true, documentId: params.documentId, message: 'Text appended successfully' };
  }

  private async executeDocsReplace(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { documentId: string; oldText: string; newText: string };
    await googleDocs.replaceText(params.documentId, params.oldText, params.newText);
    return { success: true, documentId: params.documentId, message: 'Text replaced successfully' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE SHEETS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeSheetsRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { spreadsheetId: string; range?: string };
    if (params.range) {
      const values = await googleSheets.getSheetValues(params.spreadsheetId, params.range);
      return { spreadsheetId: params.spreadsheetId, range: params.range, values };
    }
    return await googleSheets.getSpreadsheet(params.spreadsheetId);
  }

  private async executeSheetsCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { title: string; sheetTitles?: string[] };
    return await googleSheets.createSpreadsheet(params.title, params.sheetTitles);
  }

  private async executeSheetsWrite(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { spreadsheetId: string; range: string; values: unknown[][] };
    const result = await googleSheets.updateSheetValues(params.spreadsheetId, params.range, params.values);
    return { success: true, spreadsheetId: params.spreadsheetId, range: params.range, updatedCells: result.updatedCells };
  }

  private async executeSheetsAppend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { spreadsheetId: string; range: string; values: unknown[][] };
    const result = await googleSheets.appendSheetValues(params.spreadsheetId, params.range, params.values);
    return { success: true, spreadsheetId: params.spreadsheetId, range: params.range, updatedRows: result.updates?.updatedRows };
  }

  private async executeSheetsClear(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { spreadsheetId: string; range: string };
    await googleSheets.clearSheetRange(params.spreadsheetId, params.range);
    return { success: true, spreadsheetId: params.spreadsheetId, range: params.range, message: 'Range cleared successfully' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TERMINAL HANDLER
  // Supports server:/client: prefix routing
  // - server:command or just command → Execute on Replit server (default)
  // - client:command → Execute on connected desktop-app client
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeTerminal(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { command: string; cwd?: string; timeout?: number };
    
    if (!params.command || typeof params.command !== 'string') {
      throw new Error('Terminal execute requires a command parameter');
    }

    // Parse prefix to determine target
    const parsed = parsePathPrefix(params.command, 'server');
    const actualCommand = parsed.path;
    
    // Route to client if client: prefix
    if (parsed.target === 'client') {
      console.log(`[RAGDispatcher] Routing terminal command to client: ${actualCommand}`);
      
      if (!clientRouter.hasConnectedAgent()) {
        throw new Error('No desktop agent connected. Start the Meowstik desktop app on your computer to use client: commands.');
      }
      
      const result = await clientRouter.executeTerminal(actualCommand, {
        cwd: params.cwd,
        timeout: params.timeout || 30000
      });
      
      return {
        success: result.exitCode === 0,
        target: 'client',
        command: actualCommand,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      };
    }

    // Execute on server (default)
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(actualCommand, {
        cwd: this.workspaceDir,
        timeout: params.timeout || 30000,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      // Save output to terminal log file
      const timestamp = new Date().toISOString();
      const logEntry = `\n[${timestamp}] $ ${actualCommand}\n${stdout}${stderr ? '\n[stderr]\n' + stderr : ''}\n`;
      const logPath = path.join(this.workspaceDir, '.local', 'terminal-output.txt');
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry, 'utf8');

      return {
        success: true,
        target: 'server',
        command: actualCommand,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      // Save error output to terminal log file
      const timestamp = new Date().toISOString();
      const logEntry = `\n[${timestamp}] $ ${actualCommand}\n[error] ${error.message}\n${error.stdout || ''}${error.stderr || ''}\n`;
      const logPath = path.join(this.workspaceDir, '.local', 'terminal-output.txt');
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry, 'utf8');

      return {
        success: false,
        target: 'server',
        command: actualCommand,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
        exitCode: error.code || 1,
        duration: Date.now() - startTime
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE GET/PUT HANDLERS
  // Supports server:/client:/editor: prefix routing
  // - server:path or just path → Server filesystem (default)
  // - client:path → Client machine via connected desktop-app
  // - editor:path → Monaco editor canvas
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * File Get Tool - Read a file with prefix routing
   * - server:path or just path → Read from server filesystem (default)
   * - client:path → Read from client via desktop-app
   * - editor:path → Read from Monaco editor canvas
   */
  private async executeFileGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { path: string; encoding?: string };
    
    if (!params.path || typeof params.path !== 'string') {
      throw new Error('file_get requires a path parameter');
    }

    // Parse prefix to determine target
    const parsed = parsePathPrefix(params.path, 'server');
    const actualPath = parsed.path;

    // Route to editor canvas
    if (parsed.target === 'editor') {
      console.log(`[RAGDispatcher] Reading from editor canvas: ${actualPath}`);
      return {
        type: 'file_get',
        path: actualPath,
        source: 'editor',
        encoding: params.encoding || 'utf8',
        message: `Request to read file from editor canvas: ${actualPath}`
      };
    }

    // Route to client machine
    if (parsed.target === 'client') {
      console.log(`[RAGDispatcher] Reading file from client: ${actualPath}`);
      
      if (!clientRouter.hasConnectedAgent()) {
        throw new Error('No desktop agent connected. Start the Meowstik desktop app on your computer to use client: paths.');
      }
      
      const content = await clientRouter.readFile(actualPath, params.encoding || 'utf8');
      
      return {
        type: 'file_get',
        path: actualPath,
        source: 'client',
        content,
        encoding: params.encoding || 'utf8'
      };
    }

    // Read from server filesystem (default)
    const sanitizedPath = actualPath.replace(/\.\./g, "").replace(/^\/+/, "");
    const fullPath = path.join(this.workspaceDir, sanitizedPath);
    
    const content = await fs.readFile(fullPath, params.encoding === 'base64' ? 'base64' : 'utf8');
    
    return {
      type: 'file_get',
      path: sanitizedPath,
      source: 'server',
      content,
      encoding: params.encoding || 'utf8'
    };
  }

  /**
   * File Put Tool - Write/create a file with prefix routing
   * - server:path or just path → Write to server filesystem (default)
   * - client:path → Write to client via desktop-app
   * - editor:path → Write to Monaco editor canvas
   */
  private async executeFilePut(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      path: string; 
      content: string; 
      mimeType?: string;
      permissions?: string;
      summary?: string;
    };
    
    if (!params.path || typeof params.path !== 'string') {
      throw new Error('file_put requires a path parameter');
    }
    if (!params.content && params.content !== '') {
      throw new Error('file_put requires a content parameter');
    }

    // Parse prefix to determine target
    const parsed = parsePathPrefix(params.path, 'server');
    const actualPath = parsed.path;

    // Route to editor canvas
    if (parsed.target === 'editor') {
      console.log(`[RAGDispatcher] Writing to editor canvas: ${actualPath}`);
      
      // Auto-ingest into RAG if content is text-based
      const mimeType = params.mimeType || this.detectMimeType(actualPath);
      let ingestResult = null;
      if (chunkingService.supportsTextExtraction(mimeType)) {
        try {
          ingestResult = await ragService.ingestDocument(
            params.content,
            `editor-${Date.now()}`,
            path.basename(actualPath),
            mimeType
          );
          console.log(`[RAGDispatcher] Auto-ingested editor file: ${actualPath}, chunks: ${ingestResult.chunksCreated}`);
        } catch (error) {
          console.warn(`[RAGDispatcher] Failed to auto-ingest editor file:`, error);
        }
      }
      
      return {
        type: 'file_put',
        path: actualPath,
        destination: 'editor',
        content: params.content,
        mimeType,
        summary: params.summary,
        ingested: ingestResult?.success || false,
        chunksCreated: ingestResult?.chunksCreated || 0,
        message: `File saved to editor canvas: ${actualPath}. View at /editor`
      };
    }

    // Route to client machine
    if (parsed.target === 'client') {
      console.log(`[RAGDispatcher] Writing file to client: ${actualPath}`);
      
      if (!clientRouter.hasConnectedAgent()) {
        throw new Error('No desktop agent connected. Start the Meowstik desktop app on your computer to use client: paths.');
      }
      
      await clientRouter.writeFile(actualPath, params.content, { permissions: params.permissions });
      
      return {
        type: 'file_put',
        path: actualPath,
        destination: 'client',
        mimeType: params.mimeType || this.detectMimeType(actualPath),
        summary: params.summary,
        message: `File written to client: ${actualPath}`
      };
    }

    // Write to server filesystem (default)
    const sanitizedPath = actualPath.replace(/\.\./g, "").replace(/^\/+/, "");
    const fullPath = path.join(this.workspaceDir, sanitizedPath);
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, params.content, 'utf8');
    
    if (params.permissions) {
      try {
        await fs.chmod(fullPath, parseInt(params.permissions, 8));
      } catch (error) {
        console.warn(`[RAGDispatcher] Failed to set permissions on ${sanitizedPath}:`, error);
      }
    }

    // Auto-ingest into RAG if content is text-based
    const mimeType = params.mimeType || this.detectMimeType(sanitizedPath);
    let ingestResult = null;
    if (chunkingService.supportsTextExtraction(mimeType)) {
      try {
        ingestResult = await ragService.ingestDocument(
          params.content,
          `file-${Date.now()}`,
          path.basename(sanitizedPath),
          mimeType
        );
        console.log(`[RAGDispatcher] Auto-ingested file: ${sanitizedPath}, chunks: ${ingestResult.chunksCreated}`);
      } catch (error) {
        console.warn(`[RAGDispatcher] Failed to auto-ingest file:`, error);
      }
    }

    return {
      type: 'file_put',
      path: sanitizedPath,
      destination: 'server',
      mimeType,
      summary: params.summary,
      ingested: ingestResult?.success || false,
      chunksCreated: ingestResult?.chunksCreated || 0,
      message: `File written to: ${sanitizedPath}`
    };
  }

  /**
   * Detect MIME type from file extension
   */
  private detectMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.jsx': 'application/javascript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.py': 'text/x-python',
      '.sql': 'text/x-sql',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    return mimeTypes[ext] || 'text/plain';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAVILY SEARCH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeTavilySearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      query: string; 
      searchDepth?: 'basic' | 'advanced';
      maxResults?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
    };
    return await tavilySearch({
      query: params.query,
      searchDepth: params.searchDepth || 'basic',
      maxResults: params.maxResults || 5,
      includeAnswer: true,
      includeDomains: params.includeDomains,
      excludeDomains: params.excludeDomains,
    });
  }

  private async executeTavilyQnA(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string };
    return await tavilyQnA(params.query);
  }

  private async executeTavilyResearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; maxResults?: number };
    return await tavilyDeepResearch(params.query, params.maxResults || 10);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERPLEXITY SEARCH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executePerplexitySearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      query: string; 
      model?: string;
      searchRecency?: 'hour' | 'day' | 'week' | 'month';
    };
    return await perplexitySearch({
      query: params.query,
      model: params.model,
      returnCitations: true,
      searchRecency: params.searchRecency,
    });
  }

  private async executePerplexityQuick(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string };
    return await perplexityQuickAnswer(params.query);
  }

  private async executePerplexityResearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string };
    return await perplexityDeepResearch(params.query);
  }

  private async executePerplexityNews(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; recency?: 'hour' | 'day' | 'week' };
    return await perplexityNews(params.query, params.recency || 'day');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GITHUB HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeGithubRepos(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { perPage?: number; page?: number; sort?: 'created' | 'updated' | 'pushed' | 'full_name' };
    const repos = await github.listUserRepos(params?.perPage || 30, params?.page || 1, params?.sort || 'updated');
    return { repos, count: repos.length };
  }

  private async executeGithubRepoGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string };
    return await github.getRepo(params.owner, params.repo);
  }

  private async executeGithubRepoSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; perPage?: number };
    return await github.searchRepos(params.query, params.perPage || 10);
  }

  private async executeGithubContents(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; path?: string; ref?: string };
    return await github.getRepoContents(params.owner, params.repo, params.path || '', params.ref);
  }

  private async executeGithubFileRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; path: string; ref?: string };
    return await github.getFileContent(params.owner, params.repo, params.path, params.ref);
  }

  private async executeGithubCodeSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; perPage?: number };
    return await github.searchCode(params.query, params.perPage || 10);
  }

  private async executeGithubIssues(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; perPage?: number };
    const issues = await github.listIssues(params.owner, params.repo, params.state || 'open', params.perPage || 30);
    return { issues, count: issues.length };
  }

  private async executeGithubIssueGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; issueNumber: number };
    return await github.getIssue(params.owner, params.repo, params.issueNumber);
  }

  private async executeGithubIssueCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; title: string; body?: string; labels?: string[]; assignees?: string[] };
    return await github.createIssue(params.owner, params.repo, params.title, params.body, params.labels, params.assignees);
  }

  private async executeGithubIssueUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; issueNumber: number; updates: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; assignees?: string[] } };
    return await github.updateIssue(params.owner, params.repo, params.issueNumber, params.updates);
  }

  private async executeGithubIssueComment(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; issueNumber: number; body: string };
    return await github.addIssueComment(params.owner, params.repo, params.issueNumber, params.body);
  }

  private async executeGithubPulls(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; perPage?: number };
    const pulls = await github.listPullRequests(params.owner, params.repo, params.state || 'open', params.perPage || 30);
    return { pulls, count: pulls.length };
  }

  private async executeGithubPullGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; pullNumber: number };
    return await github.getPullRequest(params.owner, params.repo, params.pullNumber);
  }

  private async executeGithubCommits(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; sha?: string; perPage?: number };
    const commits = await github.listCommits(params.owner, params.repo, params.sha, params.perPage || 30);
    return { commits, count: commits.length };
  }

  private async executeGithubUser(toolCall: ToolCall): Promise<unknown> {
    return await github.getAuthenticatedUser();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BROWSERBASE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeBrowserbaseLoad(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { url: string; textOnly?: boolean; waitForSelector?: string; timeout?: number };
    const result = await browserbase.loadPage(params.url, {
      textOnly: params.textOnly,
      waitForSelector: params.waitForSelector,
      timeout: params.timeout,
    });
    return {
      url: result.url,
      title: result.title,
      html: result.text || result.html.substring(0, 10000),
      sessionId: result.sessionId,
      replayUrl: result.sessionId ? browserbase.getSessionReplayUrl(result.sessionId) : undefined,
    };
  }

  private async executeBrowserbaseScreenshot(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { url: string; fullPage?: boolean; timeout?: number };
    const result = await browserbase.takeScreenshot(params.url, {
      fullPage: params.fullPage,
      timeout: params.timeout,
    });
    return {
      url: result.url,
      screenshotSize: result.screenshot.length,
      sessionId: result.sessionId,
      replayUrl: result.sessionId ? browserbase.getSessionReplayUrl(result.sessionId) : undefined,
      message: 'Screenshot captured successfully',
    };
  }

  private async executeBrowserbaseAction(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      url: string;
      actions: Array<{
        type: 'click' | 'type' | 'scroll' | 'wait' | 'screenshot';
        selector?: string;
        text?: string;
        delay?: number;
      }>;
    };
    const result = await browserbase.executeBrowserAction(params.url, params.actions);
    return {
      success: result.success,
      results: result.results,
      sessionId: result.sessionId,
      replayUrl: browserbase.getSessionReplayUrl(result.sessionId),
    };
  }

  /**
   * Debug Echo Tool - Returns all context the LLM received
   * Useful for debugging what information is being passed to the AI
   */
  private async executeDebugEcho(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      include_system?: boolean;
      include_history?: boolean;
      include_tools?: boolean;
      raw_input?: string;
      conversation_context?: unknown;
    };

    // Gather debug information
    const debugInfo: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      toolCall: {
        id: toolCall.id,
        type: toolCall.type,
        operation: toolCall.operation,
        parameters: toolCall.parameters,
      },
    };

    // Include raw input if provided
    if (params.raw_input) {
      debugInfo.raw_input = params.raw_input;
    }

    // Include conversation context if provided
    if (params.conversation_context) {
      debugInfo.conversation_context = params.conversation_context;
    }

    // Get last stored debug buffer if available
    try {
      const debugBuffer = await import('./llm-debug-buffer');
      if (debugBuffer.llmDebugBuffer) {
        debugInfo.lastPrompt = debugBuffer.llmDebugBuffer.getLastPrompt();
        debugInfo.lastSystemInstruction = debugBuffer.llmDebugBuffer.getLastSystemInstruction();
        debugInfo.lastMessages = debugBuffer.llmDebugBuffer.getLastMessages();
      }
    } catch {
      debugInfo.debugBufferError = "Debug buffer not available";
    }

    return {
      type: "debug_echo",
      message: "Debug information retrieved successfully",
      debug: debugInfo,
    };
  }

  // =========================================================================
  // QUEUE TOOLS - AI batch processing queue
  // =========================================================================

  /**
   * Create a single task in the queue
   */
  private async executeQueueCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      title: string;
      description?: string;
      taskType: string;
      priority?: number;
      input?: Record<string, unknown>;
      estimatedDuration?: number;
      parentId?: string;
      chatId?: string;
    };

    if (!params.title || !params.taskType) {
      throw new Error("Task title and taskType are required");
    }

    const task = await storage.createQueuedTask({
      title: params.title,
      description: params.description || null,
      taskType: params.taskType,
      priority: params.priority || 0,
      input: params.input || null,
      estimatedDuration: params.estimatedDuration || null,
      parentId: params.parentId || null,
      chatId: params.chatId || null,
    });

    return {
      type: "queue_create",
      message: `Task "${params.title}" created successfully`,
      task,
    };
  }

  /**
   * Create multiple tasks in the queue at once
   */
  private async executeQueueBatch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      tasks: Array<{
        title: string;
        description?: string;
        taskType: string;
        priority?: number;
        input?: Record<string, unknown>;
        estimatedDuration?: number;
        parentId?: string;
      }>;
      chatId?: string;
    };

    if (!params.tasks || !Array.isArray(params.tasks) || params.tasks.length === 0) {
      throw new Error("tasks array is required and must not be empty");
    }

    const tasksToCreate = params.tasks.map((t, idx) => ({
      title: t.title,
      description: t.description || null,
      taskType: t.taskType || "action",
      priority: t.priority ?? (params.tasks.length - idx), // Higher priority for earlier tasks
      input: t.input || null,
      estimatedDuration: t.estimatedDuration || null,
      parentId: t.parentId || null,
      chatId: params.chatId || null,
    }));

    const createdTasks = await storage.createQueuedTasks(tasksToCreate);

    return {
      type: "queue_batch",
      message: `${createdTasks.length} tasks created successfully`,
      tasks: createdTasks,
    };
  }

  /**
   * List tasks in the queue
   */
  private async executeQueueList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      status?: string;
      chatId?: string;
      limit?: number;
    };

    const tasks = await storage.getQueuedTasks({
      status: params.status,
      chatId: params.chatId,
      limit: params.limit || 20,
    });

    const stats = await storage.getQueueStats();

    return {
      type: "queue_list",
      message: `Found ${tasks.length} tasks`,
      tasks,
      stats,
    };
  }

  /**
   * Start the next pending task in the queue
   */
  private async executeQueueStart(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      taskId?: string;
    };

    let task;
    if (params.taskId) {
      task = await storage.getQueuedTaskById(params.taskId);
      if (!task) {
        throw new Error(`Task ${params.taskId} not found`);
      }
    } else {
      task = await storage.getNextPendingTask();
      if (!task) {
        return {
          type: "queue_start",
          message: "No pending tasks in the queue",
          task: null,
        };
      }
    }

    const updatedTask = await storage.updateQueuedTask(task.id, {
      status: "running",
      startedAt: new Date(),
    });

    return {
      type: "queue_start",
      message: `Task "${task.title}" started`,
      task: updatedTask,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TWILIO SMS/VOICE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send an SMS message via Twilio
   */
  private async executeSmsSend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { to: string; body: string };
    
    if (!params.to || !params.body) {
      throw new Error("sms_send requires 'to' (phone number) and 'body' parameters");
    }

    // Validate phone number format (basic E.164 check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(params.to.replace(/[\s\-\(\)]/g, ''))) {
      throw new Error("Invalid phone number format. Please use E.164 format (e.g., +14155551234)");
    }

    if (params.body.length < 1 || params.body.length > 1600) {
      throw new Error("SMS body must be between 1 and 1600 characters");
    }

    try {
      const result = await twilio.sendSMS(params.to, params.body);
      
      return {
        type: "sms_send",
        success: true,
        sid: result.sid,
        status: result.status,
        to: result.to,
        from: result.from,
        message: `SMS sent successfully to ${params.to}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "sms_send",
        success: false,
        to: params.to,
        error: errorMessage,
        message: `Failed to send SMS: ${errorMessage}`,
      };
    }
  }

  /**
   * List recent SMS messages from Twilio
   */
  private async executeSmsList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { limit?: number };
    
    try {
      const messages = await twilio.getMessages(params.limit || 20);
      
      return {
        type: "sms_list",
        success: true,
        messages,
        count: messages.length,
        message: `Retrieved ${messages.length} SMS messages`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "sms_list",
        success: false,
        error: errorMessage,
        message: `Failed to list SMS messages: ${errorMessage}`,
      };
    }
  }

  /**
   * Make a voice call via Twilio
   */
  private async executeCallMake(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { to: string; message?: string; twimlUrl?: string };
    
    if (!params.to) {
      throw new Error("call_make requires 'to' (phone number) parameter");
    }

    if (!params.message && !params.twimlUrl) {
      throw new Error("call_make requires either 'message' (text to speak) or 'twimlUrl' parameter");
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(params.to.replace(/[\s\-\(\)]/g, ''))) {
      throw new Error("Invalid phone number format. Please use E.164 format (e.g., +14155551234)");
    }

    try {
      let result;
      if (params.twimlUrl) {
        // Use custom TwiML URL
        result = await twilio.makeCall(params.to, params.twimlUrl);
      } else {
        // Use text-to-speech message
        result = await twilio.makeCallWithMessage(params.to, params.message!);
      }
      
      return {
        type: "call_make",
        success: true,
        sid: result.sid,
        status: result.status,
        to: result.to,
        from: result.from,
        message: `Call initiated to ${params.to}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "call_make",
        success: false,
        to: params.to,
        error: errorMessage,
        message: `Failed to make call: ${errorMessage}`,
      };
    }
  }

  /**
   * List recent voice calls from Twilio
   */
  private async executeCallList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { limit?: number };
    
    try {
      const calls = await twilio.getCalls(params.limit || 20);
      
      return {
        type: "call_list",
        success: true,
        calls,
        count: calls.length,
        message: `Retrieved ${calls.length} call records`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "call_list",
        success: false,
        error: errorMessage,
        message: `Failed to list calls: ${errorMessage}`,
      };
    }
  }
}

export const ragDispatcher = new RAGDispatcher();
