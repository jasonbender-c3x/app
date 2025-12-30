# Ragent Documentation Index

Welcome to the Ragent (AI Agent) documentation. This index provides comprehensive guides on configuring, customizing, and understanding Meowstik's AI agent capabilities.

---

## Quick Navigation

### Configuration & Behavior
- [Agent Configuration Guide](./agent-configuration.md) - How to customize agent behavior, personality, and decision-making
- [Workflow Orchestration](./job-orchestration.md) - Multi-worker job processing and task dependencies

### Core Systems
- [RAG Pipeline](../RAG_PIPELINE.md) - Retrieval-Augmented Generation for context-aware responses
- [System Overview](../SYSTEM_OVERVIEW.md) - High-level architecture and component interactions
- [Prompt Lifecycle](../03-prompt-lifecycle.md) - How prompts flow through the system

### Developer Reference
- [Database Schemas](../01-database-schemas.md) - Data models and storage structure
- [Tool Call Schema](../05-tool-call-schema.md) - Tool invocation format and validation
- [UI Architecture](../02-ui-architecture.md) - Frontend component organization

---

## Key Concepts

### 1. Layered Behavior Control

The agent's behavior is controlled through multiple layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| **System Directives** | `prompts/core-directives.md` | Core rules and constraints |
| **Personality Prompt** | `prompts/personality.md` | Voice, tone, interaction style |
| **Tool Manifest** | `server/services/jit-tool-protocol.ts` | Available capabilities |
| **Runtime Settings** | UI Settings Page | Verbosity, voice mode, preferences |
| **Workflow Config** | Job submissions | Task priorities and dependencies |

### 2. Tool Categories

The agent has access to **81 tools** organized into categories:

- **Files** (6): `file_get`, `file_put`, `file_list`, `file_delete`, `file_copy`, `file_move`
- **Email** (4): `gmail_list`, `gmail_read`, `gmail_send`, `gmail_search`
- **SMS/Voice** (4): `sms_send`, `sms_list`, `call_make`, `call_list`
- **Calendar** (5): `calendar_list`, `calendar_events`, `calendar_create`, `calendar_update`, `calendar_delete`
- **Drive** (5): `drive_list`, `drive_read`, `drive_create`, `drive_upload`, `drive_search`
- **GitHub** (12): Repository, issues, PRs, commits, file operations
- **Tasks** (5): `tasks_lists`, `tasks_list`, `tasks_get`, `tasks_create`, `tasks_complete`
- **Browser** (4): `browser_navigate`, `browser_screenshot`, `browser_click`, `browser_type`
- **Terminal** (3): `terminal_execute`, `terminal_read`, `terminal_write`
- **And more...** See [Tool Protocol Reference](./tool-protocol.md)

### 3. Decision Flow

```
User Input → JIT Tool Prediction → Context Retrieval (RAG) → Gemini Processing → Tool Execution → Response
```

---

## Getting Started

1. **[Configure Agent Behavior](./agent-configuration.md)** - Set up personality and rules
2. **[Understand the Tool System](./tool-protocol.md)** - Learn what the agent can do
3. **[Create Custom Workflows](./job-orchestration.md)** - Define multi-step task automation
4. **[Tune RAG Settings](../RAG_PIPELINE.md)** - Customize knowledge retrieval

---

## Related Pages

- [Settings UI](/settings) - Configure agent preferences in the app
- [Help & How-To](/help) - User-facing documentation
- [Vision & Roadmap](../v2-roadmap/MASTER-ROADMAP.md) - Future development plans
