# Meowstik Master Roadmap v2

*Last updated: December 30, 2025*

## Overview

Consolidated roadmap from 245 extracted ideas, grouped by theme and priority.

---

## Tool Usage Statistics (from database)

| Rank | Tool | Calls | Status |
|------|------|-------|--------|
| 1 | `send_chat` | 137 | ✅ Core tool |
| 2 | `say` | 86 | ✅ Core tool |
| 3 | `terminal_execute` | 55 | ✅ Added to JIT |
| 4 | `github_contents` | 37 | ✅ Added to JIT |
| 5 | `gmail_search` | 28 | ✅ In JIT |
| 6 | `file_put` | 17 | ✅ Core tool |
| 7 | `gmail_read` | 10 | ✅ In JIT |
| 8 | `gmail_list` | 10 | ✅ Core tool |
| 9 | `file_get` | 8 | ✅ Core tool |
| 10 | `github_file_read` | 7 | ✅ In JIT |

---

## Priority Tiers

### TIER 1: Active Development 🔥

| # | Name | Combines | Status |
|---|------|----------|--------|
| **1** | **Verbosity Slider** | verbosity_modes, reading_mode_toggle, expressive_audio | ✅ COMPLETE |
| **2** | **Collaborative Editing** | collaborative_file_editing (x3), live_mode, separate_windows | 🔥 MAJOR |
| **3** | **Desktop/Browser Control** | computer_use, local_browser, browser_extension, desktop_file_access | 🔥 PRIORITY |
| **3b** | **Chromecasting** | cast_to_chromecast, screen_mirror, multi_device_output | NEW |
| **3c** | **Multi-Monitor Setup** | multi_monitor_support, extended_display, screen_management | NEW |

### TIER 2: Architecture Foundations

| # | Name | Combines | Status |
|---|------|----------|--------|
| **4** | **Kernel + Personality + Tools** | kernel_compiler_model, installable_personality, version_control, dual_output, JIT_tool_instructions | Planned |
| **5** | **Cognitive Cascade + Orchestration** | cognitive_cascade, tool_preprocessor, prompt_construction, multi_instance_architecture, non_blocking_processes, task_separation | 🔥 MAJOR |

### TIER 3: UX Improvements

| # | Name | Combines | Status |
|---|------|----------|--------|
| **6** | **Hyperlinks Everywhere** | hyperlink_file_listing, email_links, immersive_links, tool_call_indicators | Pending |
| **7** | **Email Enhancement** | email_content_cleanup, thread_context, urgency_check, find_and_reply | Pending |
| **8** | **Contacts Integration** | contacts_list_access, list_google_contacts | Pending |
| **8b** | **External Docs Site** | docusaurus_setup, github_pages_hosting, custom_domain, docs_sync | NEW |

### TIER 4: Data & Ingestion

| # | Name | Combines | Status |
|---|------|----------|--------|
| **9** | **Ingest Everything** | full_repo_ingestion, ingest_old_conversations, historical_conversations | Partial |
| **10** | **Discord + External Scraping** | Discord_scraper, NotebookLM_IP_repo, Codebase_as_SQL | NEW |

### TIER 5: Vision / Long-term

| # | Name | Combines | Status |
|---|------|----------|--------|
| **11** | **True Companion Mode** | true_companion_mode, cron_wakeups, persistent_identity | Vision |
| **12** | **Self-Evolution Engine** | self_evolution, protocol_self_evolve, incremental_self_modification | Vision |
| **13** | **JSON/Stream Architecture** | json_object_architecture, command_chaining, execute_queue | Vision |

### Deferred

| # | Name | Reason |
|---|------|--------|
| ~~14~~ | ~~Knowledge Buckets~~ | May become obsolete - evaluate after RAG improvements |

---

## Detailed Specifications

### 1. Verbosity Slider

**3-stop slider UI:**

| Mode | Behavior |
|------|----------|
| **Muse** | Silent - no speech output |
| **Quiet** | Speak only the `say` tool output |
| **Verbose** | Speak the `send_chat` content (full response) |
| **Experimental** | Multivoice TTS (different voices for different speakers) |

**Implementation:**
- Add slider to chat header or settings
- Store preference in user settings / localStorage
- Modify audio playback logic based on mode

---

### 2. Collaborative Editing

**Features:**
- Real-time cursor sharing in Monaco editor
- Voice channel active during editing session
- User and AI can both edit the same file
- Live preview updates

**Architecture:**
- WebSocket for cursor sync
- OT (Operational Transform) or CRDT for conflict resolution
- Voice mode runs parallel to text editing

---

### 3. Desktop/Browser Control (PRIORITY)

**Components:**
- Browser extension for Chrome
- Local agent (Node.js/Electron)
- Screen sharing / VNC relay
- Mouse/keyboard injection

**Already exists:**
- `/collaborate` page
- Desktop agent package design
- Browserbase integration

**Needs:**
- Extension bridge implementation
- Audio capture from desktop
- Bidirectional control flow

---

### 3b. Chromecasting

**Features:**
- Cast Meowstik UI to Chromecast/Google TV devices
- Stream AI responses to TV display
- Cast audio output to Chromecast audio devices
- Multi-device casting (cast to multiple devices)

**Use Cases:**
- Living room AI assistant
- Big-screen code review
- Hands-free voice interaction on TV

**Implementation:**
- Google Cast SDK integration
- Cast sender/receiver apps
- Audio routing for TTS output
- Remote control via phone/computer

---

### 3c. Multi-Monitor Setup

**Features:**
- Detect and manage multiple displays
- Assign different components to different monitors
- Chat on one screen, code editor on another
- Full-screen presentation mode

**Use Cases:**
- Developer workstation with chat + editor
- Presentation mode with audience view
- Dedicated monitoring dashboard

**Implementation:**
- Window management API (Electron/browser)
- Layout persistence per user
- Screen detection and assignment UI

---

### 4. Kernel + Personality + Tools

**Combines:**
- **Kernel system** - Version-controlled AI configuration
- **Installable personalities** - Cards/modules that modify behavior
- **Tool instructions** - JIT examples as installable packages
- **Dual output** - Casual voice + formal text

**Structure:**
```
kernel/
├── base.md           # Core identity
├── personality/
│   ├── default.md
│   ├── companion.md
│   └── professional.md
├── tools/
│   ├── manifest.json # Compressed tool list
│   └── examples/     # JIT examples per category
└── evolution/
    └── changelog.md  # Self-modification history
```

---

### 5. Cognitive Cascade + Orchestration

**Combines:**
- **Cognitive Cascade** - Strategist/Analyst/Technician tiers
- **Orchestration Layer** - Preprocess (typo fix, intent classify)
- **Prompt Construction** - Modular, conditional loading
- **Multi-instance** - Non-blocking parallel processes
- **Task Separation** - Different instances for different work

**Flow:**
```
User Input
    ↓
[Orchestrator] - Typo fix, abbreviation expand, intent classify
    ↓
[Strategist] - High-level planning (Pro model)
    ↓
[Analyst] - Breakdown & routing (Flash model)
    ↓
[Technician(s)] - Execute tools (Flash Lite, parallel)
    ↓
[Synthesizer] - Combine results
    ↓
Response
```

---

## Implementation Order

1. **Verbosity Slider** - Quick win, improves UX immediately
2. **Desktop/Browser Control** - Enables powerful agent capabilities
3. **Collaborative Editing** - Core differentiator
4. **Kernel + Personality** - Foundation for modularity
5. **Orchestration** - Performance & reliability at scale

---

## Completed Items

| Item | Date |
|------|------|
| Verbosity Slider (4-mode: Muse/Quiet/Verbose/Experimental) | 2025-12-30 |
| Say/Send_chat Differentiation (different content, proper formatting) | 2025-12-30 |
| JIT Tool Protocol v2 (Compressed Manifest - 78 tools) | 2025-12-30 |
| Master Roadmap Consolidation (245 ideas → 13 priorities) | 2025-12-30 |
| Deep Codebase Analysis Agent | 2025-12-29 |
| JIT Tool Protocol v1 | 2025-12-29 |
| RAG Pipeline with Vector Store | 2025-12-28 |
| Gemini TTS Integration | 2025-12-27 |
| GitHub Integration | 2025-12-26 |
| Google Workspace Integration | 2025-12-25 |

---

## Stats

- **Total Ideas Extracted:** 245
- **Completed:** 17
- **In Progress:** 10
- **Pending:** 204
- **Needs Alternative:** 13
- **Deferred:** 1 (Knowledge Buckets)
