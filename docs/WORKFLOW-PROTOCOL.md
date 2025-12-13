# Human-AI Workflow Protocol

A turn-based collaboration system for file editing and code generation between humans and AI.

---

## Overview

This document defines the operational boundaries and data flow triggers for the collaborative editing environment. The system facilitates continuous iteration through a turn-based model where control alternates between the human user and the AI assistant.

---

## Core Concepts

### Turn-Based Collaboration

| Turn | Actor | Actions |
|------|-------|---------|
| **Human's Turn** | User | Edit in canvas, Save, Upload to LLM, Cancel, Discard |
| **Computer's Turn** | AI | Generate content, Send diffs, Create files, Execute tools |

### The Canvas

The "canvas" is the editing environment where files are opened and modified. It supports multiple editor types based on file content:

| Editor Alias | Use Case | Examples |
|--------------|----------|----------|
| `Monaco` | Code and text files | `.js`, `.ts`, `.py`, `.html`, `.css`, `.json`, `.md` |
| `WYSIWYG` | Rich text documents | `.docx`, `.rtf` (future) |
| `Terminal` | Script execution | Bash scripts, command sequences |

---

## Three Workflow Pathways

### Workflow 1: Ingestion (Editing Existing Files)

**Trigger:** User attaches a file to a prompt, or asks the LLM to use an existing workspace file.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  User attaches   │     │  App stores copy │     │  File opens in   │
│  file to prompt  │ ──▶ │  in workspace    │ ──▶ │  Canvas editor   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  LLM receives    │
                         │  file as context │
                         │  (Ground Truth)  │
                         └──────────────────┘
```

**Flow:**
1. User attaches file to a chat prompt
2. App receives the file and stores a copy in the workspace
3. File content is sent to the LLM as context (I-Frame / Ground Truth)
4. App opens the file in the appropriate canvas editor
5. **→ Human's Turn begins**

---

### Workflow 2: Creation (LLM-Generated Content)

**Trigger:** User asks the AI to create a new file or document.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  User: "Create   │     │  LLM generates   │     │  Tool call with  │
│  a landing page" │ ──▶ │  file content    │ ──▶ │  path alias      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │  File opens in   │ ◀── │  App saves file  │
                         │  specified editor│     │  to workspace    │
                         └──────────────────┘     └──────────────────┘
```

**Flow:**
1. User prompts: "Create a project report template"
2. LLM generates the file content
3. LLM sends content via tool call with **path alias**: `Monaco.CodeEditor:src/report.html`
4. App's tool server parses the alias:
   - Strips the editor directive (`Monaco.CodeEditor`)
   - Extracts the clean file path (`src/report.html`)
   - Saves the file to the workspace
5. App opens the file in the specified editor (Monaco)
6. **→ Human's Turn begins**

---

### Workflow 3: Execution (Script Generation)

**Trigger:** User asks the AI to run commands or execute code.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  User: "Run the  │     │  LLM generates   │     │  Tool call to    │
│  test suite"     │ ──▶ │  bash script     │ ──▶ │  <terminal>      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │  Script executes │
                                                  │  in sandbox      │
                                                  └──────────────────┘
```

**Flow:**
1. User prompts: "Run npm test"
2. LLM generates the command or script
3. LLM sends script to `<terminal>` editor via tool call
4. App executes the script in a sandboxed environment
5. Output is displayed to the user
6. **→ Human's Turn begins** (user can review output and respond)

---

## Path Alias System

The path alias system allows the LLM to specify both the destination file path and the appropriate editor to open it in.

### Alias Format

```
<EditorType>.<EditorVariant>:<filepath>
```

### Examples

| Alias | Editor | File Path |
|-------|--------|-----------|
| `Monaco.CodeEditor:src/app.js` | Monaco | `src/app.js` |
| `Monaco.MarkdownEditor:docs/README.md` | Monaco | `docs/README.md` |
| `Terminal.Bash:scripts/deploy.sh` | Terminal | `scripts/deploy.sh` |
| `WYSIWYG.Document:reports/q4.docx` | WYSIWYG | `reports/q4.docx` |

### Parsing Logic

```typescript
function parsePathAlias(aliasPath: string): { editor: string; filePath: string } {
  const colonIndex = aliasPath.indexOf(':');
  if (colonIndex === -1) {
    // No alias, default to Monaco
    return { editor: 'Monaco', filePath: aliasPath };
  }
  
  const editorPart = aliasPath.substring(0, colonIndex);
  const filePath = aliasPath.substring(colonIndex + 1);
  
  return { editor: editorPart, filePath };
}
```

---

## Human's Turn: Canvas Controls

When a file is open in the canvas, the user has these controls:

### Button Actions

| Button | Action | Result |
|--------|--------|--------|
| **Save** | Save current changes to workspace | File persisted, `isDirty` cleared |
| **Save As** | Save with new filename | New file created, original unchanged |
| **Upload to LLM** | Send file + chat context to AI | **→ Computer's Turn** |
| **Cancel** | Discard current edit session | **→ Human's Turn restarts** |
| **Discard** | Close file without saving | Editing ends completely |

### State Indicators

| Indicator | Meaning |
|-----------|---------|
| `isDirty` | File has unsaved changes |
| `autoSave` | Automatically save changes periodically |

### Turn Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                        HUMAN'S TURN                              │
│                                                                  │
│   [Edit in Canvas] ─┬─▶ [Save] ───▶ Remains Human's Turn       │
│                     │                                            │
│                     ├─▶ [Save + Upload] ──▶ Computer's Turn     │
│                     │                                            │
│                     ├─▶ [Cancel] ───▶ Restarts Human's Turn     │
│                     │                                            │
│                     └─▶ [Discard] ───▶ Editing Ends             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Computer's Turn: AI Actions

When it's the AI's turn, it can:

1. **Analyze** the uploaded file content
2. **Generate** improvements, fixes, or new content
3. **Send diffs** for incremental changes (preferred)
4. **Send full file** for complete replacements
5. **Execute tools** (terminal commands, API calls, etc.)

After the AI completes its action:
- **→ Human's Turn** begins again
- User reviews changes in the canvas
- Cycle continues until user is satisfied

---

## Diff-Based Updates

When modifying existing files, the AI should prefer sending diffs rather than full file replacements:

### Diff Format

```json
{
  "tool": "canvas_update",
  "params": {
    "filePath": "src/app.js",
    "changes": [
      {
        "type": "replace",
        "startLine": 15,
        "endLine": 20,
        "content": "// New implementation\nfunction improved() {\n  return true;\n}"
      },
      {
        "type": "insert",
        "afterLine": 30,
        "content": "// Added helper function\nfunction helper() {}"
      }
    ]
  }
}
```

### Benefits of Diff-Based Updates

| Benefit | Description |
|---------|-------------|
| **Efficiency** | Less data transferred |
| **Clarity** | User sees exactly what changed |
| **Reversibility** | Easier to undo specific changes |
| **Context preservation** | User's edits outside changed regions are preserved |

---

## Workflow Summary Table

| Workflow | Input Source | LLM Role | Output Method | Target Editor |
|----------|--------------|----------|---------------|---------------|
| **Ingestion** | User-uploaded file | Reasoning & context | Full file display | Monaco, etc. |
| **Creation** | User prompt | Content generation | Tool call with alias | Specified editor |
| **Execution** | User prompt | Script generation | Tool call to terminal | Terminal (sandboxed) |

---

## Implementation Checklist

### Phase 1: Path Alias Parser
- [ ] Create `server/services/path-alias-parser.ts`
- [ ] Implement alias parsing logic
- [ ] Add editor type validation
- [ ] Handle default (no alias) case

### Phase 2: Canvas Tool Integration
- [ ] Create `canvas_open` tool for LLM to open files in editor
- [ ] Create `canvas_update` tool for diff-based updates
- [ ] Create `canvas_create` tool for new file creation
- [ ] Integrate with existing tool dispatch system

### Phase 3: Frontend Canvas Controls
- [ ] Add toolbar with Save, Save As, Upload buttons
- [ ] Implement `isDirty` state tracking
- [ ] Add autoSave toggle
- [ ] Create Cancel/Discard confirmation dialogs

### Phase 4: Turn Management
- [ ] Implement turn state tracking
- [ ] Add visual indicator for current turn
- [ ] Handle turn transitions on button clicks
- [ ] Sync turn state between chat and canvas

---

## Notes

- The system never truly "closes" - it facilitates continuous iteration
- Files are always saved to workspace before opening in canvas
- The terminal editor runs in a sandboxed environment for safety
- Diff-based updates are preferred over full file replacements
- All workflows end with **Human's Turn** to maintain user control
