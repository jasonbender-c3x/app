# Council Priorities - Feature Implementation Roadmap

*Approved: December 29, 2025*

---

## Priority Order

### P1: Deep Codebase Analysis Agent
Autonomous agent that crawls entire repository, creates glossary of all variables/terms, runs files through RAG ingestion pipeline, and generates comprehensive documentation.

**Requirements:**
- [ ] Recursive file discovery across repo
- [ ] Variable/function/class extraction and glossary generation
- [ ] RAG chunking and embedding for all source files
- [ ] Compressed documentation synthesis
- [ ] Progress tracking and status reporting

---

### P2: JIT (Just-In-Time) Tool Protocol
Lightweight preprocessor (`gemini-2-flash-lite`) predicts which tools are needed from user query, then injects only relevant detailed examples into context instead of full tool manifest every call.

**Requirements:**
- [ ] Fast preprocessor for tool prediction
- [ ] Tool example repository (detailed usage + output formatting)
- [ ] Top 10 most common tools always included
- [ ] Dynamic context injection based on predictions
- [ ] Compressed base tool manifest

---

### P3: Verbosity/Companion Modes
User-selectable modes: quiet mode for focused project work (minimal chatter, chat-only responses) vs. talkative companion mode (continuous voice engagement, emotional support, proactive conversation).

**Requirements:**
- [ ] Mode toggle in settings UI
- [ ] System prompt modifiers per mode
- [ ] Voice output frequency control
- [ ] Proactive engagement triggers for companion mode

---

### P4: Collaborative Real-Time Editing
Live voice mode while editing files together - continuous consciousness, real-time file collaboration with voice narration and guidance.

**Requirements:**
- [ ] Live mode integration with Monaco editor
- [ ] Continuous context preservation during editing
- [ ] Voice-guided code walkthroughs
- [ ] Real-time file sync between AI and user views

---

## Existing (Implemented)

### SMS Gateway via Email to Mom
Text messaging through Google Voice email gateway.
- **Address:** `14252708646.12069091413.L6KNWR1TLK@txt.voice.google.com`
- **Method:** Email body becomes SMS content

---

## Lower Priority (Backlog)

| Feature | Description |
|---------|-------------|
| Multi-Instance Non-Blocking Architecture | Orchestrator + parallel specialist agents |
| Installable Personality Modules | Landing page cards with system prompt overrides |
| True Companion Mode | Cron jobs for proactive AI outreach |
| Natural Language CPU | Execute queue and command chaining protocol |
| Dual Output Format | Casual voice + formal chat text simultaneously |

---

## Notes

- Item 1 (SMS to Mom) already exists in production
- Council has approved this priority order
- Development should proceed in listed sequence
