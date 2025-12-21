# Meowstik - Features To Be Implemented

This document tracks planned features and enhancements for future development.

---

## 1. Playwright Local Stub

### Description
Implement a local Playwright testing stub that allows automated browser testing without requiring external infrastructure.

### Requirements
- [ ] Create a sandboxed Playwright environment
- [ ] Support basic browser automation commands (navigate, click, type, screenshot)
- [ ] Return structured test results to the chat interface
- [ ] Handle timeouts and errors gracefully
- [ ] Support headless and headed modes

### Implementation Notes
- Consider using Playwright's browser contexts for isolation
- May need to limit concurrent test sessions
- Should integrate with the existing terminal tool pattern

---

## 2. Prompt Construction Stack

### Description
Document and enhance the modular prompt construction system that builds the AI's system prompt from multiple sources.

### Current Architecture
```
prompts/
├── core-directives.md    # Base instructions
├── personality.md        # Tone and communication style
├── tools.md             # Available tool definitions
└── README.md            # Overview
```

### Enhancements Needed
- [ ] Document the prompt loading order and priority
- [ ] Add support for conditional prompt sections (load based on context)
- [ ] Create prompt templates for different use cases
- [ ] Add prompt versioning/changelog
- [ ] Implement prompt A/B testing framework

### Technical Details
- Prompts are loaded by `server/services/prompt-composer.ts`
- Markdown files are concatenated into the final system prompt
- Token counting should be added to prevent exceeding limits

---

## 3. Detailed Tool Usage Instructions

### Description
Create comprehensive documentation on how to use each tool available to the AI, including examples, edge cases, and best practices.

### Tools to Document

#### Google Workspace Tools
| Tool | Status | Priority |
|------|--------|----------|
| `gmail_list` | [ ] | High |
| `gmail_read` | [ ] | High |
| `gmail_search` | [ ] | Medium |
| `gmail_send` | [ ] | High |
| `drive_list` | [ ] | High |
| `drive_read` | [ ] | High |
| `drive_search` | [ ] | Medium |
| `drive_create` | [ ] | Medium |
| `drive_update` | [ ] | Medium |
| `drive_delete` | [ ] | Low |
| `calendar_list` | [ ] | High |
| `calendar_events` | [ ] | High |
| `calendar_create` | [ ] | High |
| `calendar_update` | [ ] | Medium |
| `calendar_delete` | [ ] | Low |
| `docs_read` | [ ] | High |
| `docs_create` | [ ] | Medium |
| `docs_append` | [ ] | Medium |
| `docs_replace` | [ ] | Low |
| `sheets_read` | [ ] | High |
| `sheets_write` | [ ] | Medium |
| `sheets_append` | [ ] | Medium |
| `sheets_create` | [ ] | Medium |
| `sheets_clear` | [ ] | Low |
| `tasks_list` | [ ] | High |
| `tasks_create` | [ ] | High |
| `tasks_complete` | [ ] | High |
| `tasks_delete` | [ ] | Low |

#### System Tools
| Tool | Status | Priority |
|------|--------|----------|
| `terminal_execute` | [ ] | High |
| `web_search` | [ ] | Medium |

### Documentation Template for Each Tool
```markdown
## tool_name

### Purpose
Brief description of what this tool does.

### Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | Yes | Description |

### Return Value
Description of what the tool returns.

### Example Usage
\`\`\`json
{
  "tool": "tool_name",
  "params": {
    "param1": "value"
  }
}
\`\`\`

### Common Errors
- Error 1: Cause and solution
- Error 2: Cause and solution

### Best Practices
- Tip 1
- Tip 2
```

---

## 4. Orchestration Layer

### Description
Implement an intelligent orchestration layer that preprocesses user input before sending to the AI, improving response quality and enabling complex multi-step workflows.

### Components

#### 4.1 Input Cleanup & Expansion
- [ ] **Typo Correction**: Fix common misspellings
- [ ] **Abbreviation Expansion**: "cal" → "calendar", "doc" → "document"
- [ ] **Context Injection**: Add relevant context from chat history
- [ ] **Entity Recognition**: Identify names, dates, file references
- [ ] **Pronoun Resolution**: Replace "it", "that", "them" with actual references

**Example Transformation:**
```
Input:  "send the doc to john tmrw"
Output: "Send the document 'Q4 Report.docx' to john@company.com tomorrow (December 9, 2025)"
```

#### 4.2 Intent Classification
- [ ] **Primary Intent Detection**: What is the user trying to accomplish?
- [ ] **Tool Routing**: Which tool(s) are needed?
- [ ] **Complexity Assessment**: Simple query vs. multi-step workflow
- [ ] **Confirmation Requirements**: Does this action need user confirmation?

**Classification Categories:**
| Category | Description | Example |
|----------|-------------|---------|
| `query` | Information retrieval | "What meetings do I have today?" |
| `action_simple` | Single tool execution | "Send an email to Bob" |
| `action_complex` | Multi-tool workflow | "Schedule a meeting and send invites" |
| `conversation` | General chat | "How are you?" |
| `code_help` | Programming assistance | "Write a function to sort arrays" |
| `file_operation` | Document manipulation | "Create a spreadsheet with sales data" |

#### 4.3 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INPUT                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 1: PREPROCESSING                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Cleanup   │→ │  Expansion  │→ │  Normalize  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 2: CLASSIFICATION                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Intent    │→ │   Entity    │→ │   Routing   │          │
│  │  Detection  │  │ Extraction  │  │  Decision   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 3: ENRICHMENT                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Context   │→ │   History   │→ │  Knowledge  │          │
│  │  Addition   │  │  Retrieval  │  │    Base     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    ENHANCED PROMPT                           │
│          (Sent to Gemini for processing)                     │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Checklist

#### Phase 1: Basic Preprocessing
- [ ] Create `server/services/orchestration/preprocessor.ts`
- [ ] Implement text normalization (lowercase, trim, etc.)
- [ ] Add common abbreviation dictionary
- [ ] Basic typo detection using edit distance

#### Phase 2: Classification System
- [ ] Create `server/services/orchestration/classifier.ts`
- [ ] Define intent categories and training examples
- [ ] Implement rule-based classification (v1)
- [ ] Add ML-based classification (v2, optional)

#### Phase 3: Context Enrichment
- [ ] Create `server/services/orchestration/enricher.ts`
- [ ] Integrate with chat history for context
- [ ] Add entity resolution (files, contacts, events)
- [ ] Implement coreference resolution

#### Phase 4: Integration
- [ ] Create `server/services/orchestration/index.ts` as main entry point
- [ ] Update `server/routes.ts` to use orchestration layer
- [ ] Add logging and metrics for each stage
- [ ] Create bypass mechanism for direct queries

### Configuration Options
```typescript
interface OrchestrationConfig {
  preprocessing: {
    enabled: boolean;
    fixTypos: boolean;
    expandAbbreviations: boolean;
  };
  classification: {
    enabled: boolean;
    confidenceThreshold: number;
  };
  enrichment: {
    enabled: boolean;
    maxHistoryMessages: number;
    includeFileContext: boolean;
  };
}
```

---

## 5. Enhanced Canvas / Editor

### Description
Upgrade the Monaco editor page into a full-featured code canvas with file management and LLM integration.

### Current State
- Monaco editor at `/editor` route
- Saves/loads from localStorage only
- HTML preview in sandboxed iframe
- No connection to chat or LLM

### Proposed Features

#### 5.1 UI Layout
```
┌────────────────────────────────────────────────────────────────┐
│  [Save] [Save As] [Upload to LLM]    📄 filename.html          │
├─────────────────────────────┬──────────────────────────────────┤
│                             │                                  │
│      Monaco Editor          │        Preview Pane              │
│      (any text file)        │        (HTML/CSS/JS only)        │
│                             │                                  │
│   - HTML, CSS, JS           │   ┌────────────────────────┐    │
│   - Python, JSON            │   │   Rendered output      │    │
│   - Markdown, etc.          │   │                        │    │
│                             │   └────────────────────────┘    │
│                             │                                  │
└─────────────────────────────┴──────────────────────────────────┘
```

#### 5.2 File Management
| Button | Function |
|--------|----------|
| **Save** | Save current file to server filesystem |
| **Save As** | Save with new filename/location |
| **Open** | Browse and open files from server |
| **New** | Create new blank file |

#### 5.3 LLM Integration
| Button | Function |
|--------|----------|
| **Upload to LLM** | Send current code + chat history to AI for review/improvement |

**Workflow:**
1. User edits code in Monaco
2. Clicks "Upload to LLM"
3. Code + recent chat context sent to Gemini
4. LLM responds with feedback, suggestions, or improved code
5. User can apply changes or continue editing

#### 5.4 Preview Pane
- **HTML/CSS/JS files**: Live rendered preview in iframe
- **Other files**: No preview (or syntax-highlighted read view)
- Preview updates on save or manually via refresh button

### Implementation Checklist

#### Phase 1: File System Backend
- [ ] Create `GET /api/files/:path` - read file content
- [ ] Create `PUT /api/files/:path` - write file content
- [ ] Create `GET /api/files` - list files in directory
- [ ] Create `DELETE /api/files/:path` - delete file
- [ ] Add file path validation and security checks

#### Phase 2: Editor UI Updates
- [ ] Add toolbar with Save, Save As, Open, New buttons
- [ ] Add file browser dialog component
- [ ] Add "Upload to LLM" button
- [ ] Show current filename in header
- [ ] Add unsaved changes indicator

#### Phase 3: LLM Integration
- [ ] Create `canvas_upload` tool or API endpoint
- [ ] Send code + chat context to Gemini
- [ ] Handle streaming response
- [ ] Display LLM feedback in chat or inline

#### Phase 4: File Navigation
- [ ] Support opening files via URL param: `/editor?file=path/to/file.html`
- [ ] Add recent files list
- [ ] Remember last opened file

### Editor Options
Monaco is current choice, but alternatives exist:

| Editor | Pros | Cons |
|--------|------|------|
| **Monaco** | VS Code engine, full-featured | Heavy (~2MB) |
| **CodeMirror 6** | Lightweight, mobile-friendly | Less IntelliSense |
| **Ace Editor** | Battle-tested, fast | Older architecture |
| **Simple textarea** | Minimal, fast | No syntax highlighting |

### Notes
- Keep HTML preview separate from script execution (Terminal handles that)
- Consider WebSocket for real-time collaboration later
- File permissions: only allow access to designated workspace folder

---

## Priority Matrix

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Enhanced Canvas / Editor | Medium | High | P1 |
| Orchestration Layer | High | High | P1 |
| Tool Documentation | Medium | High | P2 |
| Prompt Construction Stack | Medium | Medium | P2 |
| Playwright Local Stub | High | Medium | P3 |

---

## Notes

- All features should maintain backward compatibility
- Add feature flags for gradual rollout
- Include comprehensive error handling
- Write unit tests for each component
- Update `replit.md` as features are implemented
