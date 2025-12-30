# Docs Review

These documents were moved from `docs/` for review before public display.

## Reason for Review

| Directory | Contents | Reason |
|-----------|----------|--------|
| `buckets/` | Personal knowledge buckets | Contains personal info (name, location) |
| `drive-imports/` | Imported Google Drive docs | May contain sensitive/personal content |
| `idea-extraction/` | JSON data files | Raw data, not documentation |
| `internal/` | Session logs, system prompts | Internal implementation details |

## Files Moved

### buckets/
- PERSONAL_LIFE.md - Personal info (name, location, health, finances)
- CREATOR.md - Personal attribution
- PROJECTS.md - Personal projects list
- INDEX.md - Index for personal buckets

### drive-imports/
- AI_CORE_DIRECTIVE.md - Kernel spec from Drive
- AI_Agent_Research_Analysis.md - Research notes
- Building_Vertex_AI_RAG_System.md - RAG guide
- Prompt_Life_Cycle_RAG.md - Prompt lifecycle

### idea-extraction/
- all-ideas.json - Raw JSON (245 ideas)
- stats.json - Statistics data

### internal/
- SESSION_LOG.md - Internal session log
- 04-system-prompt.md - System prompt (sensitive)
- LIVE_MODE_E2E_EVALUATION.md - Internal testing

## Action Required

Review each file and decide:
1. **Keep private** - Leave in docs-review/
2. **Make public** - Move back to docs/ and add to docCategories
3. **Delete** - Remove if obsolete
