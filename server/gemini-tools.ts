/**
 * Gemini Function Calling Tool Declarations
 * 
 * Converts our Zod schemas to Gemini's FunctionDeclaration format
 * for native structured output instead of JSON text parsing
 */
import type { FunctionDeclaration } from "@google/genai";

export const geminiFunctionDeclarations: FunctionDeclaration[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE OUTPUT TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "send_chat",
    description: "Send final response to the chat window. TERMINATES the agentic loop. Use after gathering all information.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The markdown-formatted response to display in chat"
        }
      },
      required: ["content"]
    }
  },
  {
    name: "say",
    description: "Generate HD voice audio output. Does NOT terminate the loop - use alongside or before send_chat. Required when voice mode is enabled.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        utterance: {
          type: "string",
          description: "Text to speak aloud"
        },
        voice: {
          type: "string",
          enum: ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"],
          description: "Voice to use (default: Kore)"
        }
      },
      required: ["utterance"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "file_get",
    description: "Read file content. Prefix path with 'editor:' for Monaco canvas files.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" }
      },
      required: ["path"]
    }
  },
  {
    name: "file_put",
    description: "Write/create a file. Prefix path with 'editor:' for Monaco canvas.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "File content" },
        mimeType: { type: "string", description: "MIME type (optional)" },
        summary: { type: "string", description: "Change summary (optional)" }
      },
      required: ["path", "content"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GMAIL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "gmail_list",
    description: "List recent emails from inbox",
    parametersJsonSchema: {
      type: "object",
      properties: {
        maxResults: { type: "number", description: "Max emails to return (default: 10)" },
        labelIds: { type: "array", items: { type: "string" }, description: "Label IDs to filter" }
      }
    }
  },
  {
    name: "gmail_read",
    description: "Read a specific email by ID",
    parametersJsonSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Email message ID" }
      },
      required: ["messageId"]
    }
  },
  {
    name: "gmail_search",
    description: "Search emails with Gmail query syntax",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query (e.g., 'from:nick subject:meeting')" },
        maxResults: { type: "number", description: "Max results (default: 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "gmail_send",
    description: "Send an email",
    parametersJsonSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body (plain text or HTML)" },
        cc: { type: "string", description: "CC recipient (optional)" },
        bcc: { type: "string", description: "BCC recipient (optional)" }
      },
      required: ["to", "subject", "body"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DRIVE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "drive_list",
    description: "List files in Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "Folder ID to list (optional, defaults to root)" },
        maxResults: { type: "number", description: "Max files to return" }
      }
    }
  },
  {
    name: "drive_read",
    description: "Read a file's content from Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to read" }
      },
      required: ["fileId"]
    }
  },
  {
    name: "drive_search",
    description: "Search files in Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results" }
      },
      required: ["query"]
    }
  },
  {
    name: "drive_create",
    description: "Create a new file in Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name" },
        content: { type: "string", description: "File content" },
        mimeType: { type: "string", description: "MIME type (optional)" },
        folderId: { type: "string", description: "Parent folder ID (optional)" }
      },
      required: ["name", "content"]
    }
  },
  {
    name: "drive_update",
    description: "Update an existing file in Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to update" },
        content: { type: "string", description: "New content" }
      },
      required: ["fileId", "content"]
    }
  },
  {
    name: "drive_delete",
    description: "Delete a file from Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to delete" }
      },
      required: ["fileId"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE CALENDAR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "calendar_list",
    description: "List available calendars",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "calendar_events",
    description: "Get calendar events",
    parametersJsonSchema: {
      type: "object",
      properties: {
        calendarId: { type: "string", description: "Calendar ID (default: primary)" },
        maxResults: { type: "number", description: "Max events to return" },
        timeMin: { type: "string", description: "Start time filter (ISO datetime)" },
        timeMax: { type: "string", description: "End time filter (ISO datetime)" }
      }
    }
  },
  {
    name: "calendar_create",
    description: "Create a calendar event",
    parametersJsonSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Event title" },
        start: { type: "string", description: "Start datetime (ISO format)" },
        end: { type: "string", description: "End datetime (ISO format)" },
        description: { type: "string", description: "Event description" },
        location: { type: "string", description: "Event location" }
      },
      required: ["summary", "start", "end"]
    }
  },
  {
    name: "calendar_update",
    description: "Update a calendar event",
    parametersJsonSchema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "Event ID to update" },
        summary: { type: "string", description: "New title" },
        start: { type: "string", description: "New start time" },
        end: { type: "string", description: "New end time" },
        description: { type: "string", description: "New description" }
      },
      required: ["eventId"]
    }
  },
  {
    name: "calendar_delete",
    description: "Delete a calendar event",
    parametersJsonSchema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "Event ID to delete" },
        calendarId: { type: "string", description: "Calendar ID (default: primary)" }
      },
      required: ["eventId"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DOCS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "docs_read",
    description: "Read a Google Doc's content",
    parametersJsonSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" }
      },
      required: ["documentId"]
    }
  },
  {
    name: "docs_create",
    description: "Create a new Google Doc",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        content: { type: "string", description: "Initial content (optional)" }
      },
      required: ["title"]
    }
  },
  {
    name: "docs_append",
    description: "Append content to a Google Doc",
    parametersJsonSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        content: { type: "string", description: "Content to append" }
      },
      required: ["documentId", "content"]
    }
  },
  {
    name: "docs_replace",
    description: "Find and replace text in a Google Doc",
    parametersJsonSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        find: { type: "string", description: "Text to find" },
        replace: { type: "string", description: "Replacement text" }
      },
      required: ["documentId", "find", "replace"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE SHEETS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "sheets_read",
    description: "Read data from a Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to read (e.g., 'Sheet1!A1:D10')" }
      },
      required: ["spreadsheetId", "range"]
    }
  },
  {
    name: "sheets_write",
    description: "Write data to a Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to write" },
        values: { type: "array", items: { type: "array" }, description: "2D array of values" }
      },
      required: ["spreadsheetId", "range", "values"]
    }
  },
  {
    name: "sheets_append",
    description: "Append rows to a Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to append to" },
        values: { type: "array", items: { type: "array" }, description: "2D array of values" }
      },
      required: ["spreadsheetId", "range", "values"]
    }
  },
  {
    name: "sheets_create",
    description: "Create a new Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Spreadsheet title" }
      },
      required: ["title"]
    }
  },
  {
    name: "sheets_clear",
    description: "Clear a range in a Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to clear" }
      },
      required: ["spreadsheetId", "range"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE TASKS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "tasks_list",
    description: "List tasks from a task list",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskListId: { type: "string", description: "Task list ID (optional)" },
        maxResults: { type: "number", description: "Max tasks to return" }
      }
    }
  },
  {
    name: "tasks_create",
    description: "Create a new task",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        notes: { type: "string", description: "Task notes/description" },
        due: { type: "string", description: "Due date (ISO format)" },
        taskListId: { type: "string", description: "Task list ID (optional)" }
      },
      required: ["title"]
    }
  },
  {
    name: "tasks_update",
    description: "Update an existing task",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
        title: { type: "string", description: "New title" },
        notes: { type: "string", description: "New notes" },
        due: { type: "string", description: "New due date" }
      },
      required: ["taskId"]
    }
  },
  {
    name: "tasks_complete",
    description: "Mark a task as complete",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
        taskListId: { type: "string", description: "Task list ID (optional)" }
      },
      required: ["taskId"]
    }
  },
  {
    name: "tasks_delete",
    description: "Delete a task",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
        taskListId: { type: "string", description: "Task list ID (optional)" }
      },
      required: ["taskId"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE CONTACTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "contacts_list",
    description: "List contacts from Google Contacts",
    parametersJsonSchema: {
      type: "object",
      properties: {
        pageSize: { type: "number", description: "Number of contacts per page" },
        pageToken: { type: "string", description: "Page token for pagination" }
      }
    }
  },
  {
    name: "contacts_search",
    description: "Search contacts by name, email, or phone",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        pageSize: { type: "number", description: "Max results" }
      },
      required: ["query"]
    }
  },
  {
    name: "contacts_create",
    description: "Create a new contact",
    parametersJsonSchema: {
      type: "object",
      properties: {
        givenName: { type: "string", description: "First name" },
        familyName: { type: "string", description: "Last name (optional)" },
        email: { type: "string", description: "Email address (optional)" },
        phoneNumber: { type: "string", description: "Phone number (optional)" }
      },
      required: ["givenName"]
    }
  },
  {
    name: "contacts_update",
    description: "Update an existing contact",
    parametersJsonSchema: {
      type: "object",
      properties: {
        resourceName: { type: "string", description: "Contact resource name" },
        givenName: { type: "string", description: "New first name" },
        email: { type: "string", description: "New email" },
        phoneNumber: { type: "string", description: "New phone number" }
      },
      required: ["resourceName"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TERMINAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "terminal_execute",
    description: "Execute a shell command on the server",
    parametersJsonSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" }
      },
      required: ["command"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "web_search",
    description: "Search the web for information",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results (default: 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "browser_scrape",
    description: "Scrape content from a webpage using Playwright",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to scrape" },
        selector: { type: "string", description: "CSS selector for content (optional)" }
      },
      required: ["url"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GITHUB
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "github_repos",
    description: "List repositories for a user",
    parametersJsonSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "GitHub username (optional, defaults to authenticated user)" }
      }
    }
  },
  {
    name: "github_contents",
    description: "List contents of a repository directory",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "Path in repository (optional, defaults to root)" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_file_read",
    description: "Read a file from a GitHub repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path" }
      },
      required: ["owner", "repo", "path"]
    }
  },
  {
    name: "github_code_search",
    description: "Search code in GitHub repositories",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Code search query" },
        owner: { type: "string", description: "Owner to limit search (optional)" },
        repo: { type: "string", description: "Repo to limit search (optional)" }
      },
      required: ["query"]
    }
  },
  {
    name: "github_issues",
    description: "List issues in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "Issue state filter" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_pulls",
    description: "List pull requests in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "PR state filter" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_commits",
    description: "List commits in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        maxResults: { type: "number", description: "Max commits to return" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_issue_create",
    description: "Create a new issue",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Issue body (optional)" }
      },
      required: ["owner", "repo", "title"]
    }
  },
  {
    name: "github_issue_comment",
    description: "Add a comment to an issue",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        issueNumber: { type: "number", description: "Issue number" },
        body: { type: "string", description: "Comment body" }
      },
      required: ["owner", "repo", "issueNumber", "body"]
    }
  },
  {
    name: "github_branch_create",
    description: "Create a new branch",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        branch: { type: "string", description: "New branch name" },
        sourceBranch: { type: "string", description: "Source branch (default: main)" }
      },
      required: ["owner", "repo", "branch"]
    }
  },
  {
    name: "github_file_create",
    description: "Create or update a file in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path" },
        content: { type: "string", description: "File content" },
        message: { type: "string", description: "Commit message" },
        branch: { type: "string", description: "Branch name (optional)" }
      },
      required: ["owner", "repo", "path", "content", "message"]
    }
  },
  {
    name: "github_pr_create",
    description: "Create a pull request",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "PR title" },
        body: { type: "string", description: "PR body (optional)" },
        head: { type: "string", description: "Head branch" },
        base: { type: "string", description: "Base branch" }
      },
      required: ["owner", "repo", "title", "head", "base"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TWILIO SMS/VOICE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "sms_send",
    description: "Send an SMS message via Twilio",
    parametersJsonSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number (E.164 format, e.g., +15551234567)" },
        body: { type: "string", description: "Message content" }
      },
      required: ["to", "body"]
    }
  },
  {
    name: "sms_list",
    description: "List recent SMS messages",
    parametersJsonSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max messages to return (default: 20)" }
      }
    }
  },
  {
    name: "call_make",
    description: "Make a phone call via Twilio",
    parametersJsonSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number (E.164 format)" },
        message: { type: "string", description: "Message to speak on the call (optional)" },
        twimlUrl: { type: "string", description: "Custom TwiML URL (optional)" }
      },
      required: ["to"]
    }
  },
  {
    name: "call_list",
    description: "List recent phone calls",
    parametersJsonSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max calls to return (default: 20)" }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JOB QUEUE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "queue_create",
    description: "Create a single background job",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name" },
        goal: { type: "string", description: "Job goal/description" },
        priority: { type: "number", description: "Priority (0 = highest)" },
        dependencies: { type: "array", items: { type: "string" }, description: "Job IDs this depends on" }
      },
      required: ["name", "goal"]
    }
  },
  {
    name: "queue_batch",
    description: "Create multiple jobs at once",
    parametersJsonSchema: {
      type: "object",
      properties: {
        jobs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              goal: { type: "string" },
              priority: { type: "number" },
              dependencies: { type: "array", items: { type: "string" } }
            },
            required: ["name", "goal"]
          },
          description: "Array of job definitions"
        }
      },
      required: ["jobs"]
    }
  },
  {
    name: "queue_list",
    description: "List jobs in the queue",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "running", "completed", "failed"], description: "Filter by status" },
        limit: { type: "number", description: "Max jobs to return" }
      }
    }
  },
  {
    name: "queue_start",
    description: "Start processing the job queue",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BROWSERBASE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "browserbase_load",
    description: "Load a URL in a Browserbase headless browser session",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to load" }
      },
      required: ["url"]
    }
  },
  {
    name: "browserbase_screenshot",
    description: "Take a screenshot of the current Browserbase session",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Browserbase session ID" }
      },
      required: ["sessionId"]
    }
  }
];

/**
 * Get tool declarations for a specific set of tools
 * Useful for limiting which tools are available in certain contexts
 */
export function getToolDeclarations(toolNames?: string[]): FunctionDeclaration[] {
  if (!toolNames) {
    return geminiFunctionDeclarations;
  }
  return geminiFunctionDeclarations.filter(tool => tool.name && toolNames.includes(tool.name));
}

/**
 * Get tool names as a string array for toolConfig.allowedFunctionNames
 */
export function getAllToolNames(): string[] {
  return geminiFunctionDeclarations.map(tool => tool.name).filter((name): name is string => !!name);
}
