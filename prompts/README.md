# Meowstik - System Prompt Architecture

## Overview

This directory contains the modular system prompt configuration for Nebula, the AI assistant powering Meowstik. The prompt is split into separate files for maintainability, versioning, and easy customization.

## File Structure

```
prompts/
├── README.md              # This file - documentation
├── core-directives.md     # Fundamental behavior rules and constraints
├── personality.md         # Character, tone, and communication style
└── tools.md               # Tool definitions with implementation details
```

## How It Works

The `PromptComposer` service in `server/services/prompt-composer.ts` loads these files at startup and assembles them into a complete system prompt. The order of assembly is:

1. **Core Directives** - Establishes fundamental rules and constraints
2. **Personality** - Defines character and communication style
3. **Tools** - Provides detailed tool specifications

## Prompt Assembly

```typescript
// server/services/prompt-composer.ts
const systemPrompt = [
  coreDirectives,
  personality,
  tools,
  contextualInstructions  // Added dynamically based on attachments
].join('\n\n');
```

## Customization

### Modifying Behavior
Edit `core-directives.md` to change fundamental rules like:
- Response format requirements
- Security constraints
- Error handling policies

### Adjusting Personality
Edit `personality.md` to change:
- Tone and communication style
- Level of formality
- Verbosity preferences

### Adding/Modifying Tools
Edit `tools.md` to:
- Add new tool types
- Modify tool parameters
- Update implementation details

## Dynamic Context

The prompt composer adds contextual instructions based on:
- **Screenshots present**: Image analysis instructions
- **Files attached**: Document processing instructions
- **Voice input**: Speech-to-text context

## Version Control

Each prompt file should be version-controlled. Consider adding version headers:

```markdown
<!-- Version: 1.0.0 -->
<!-- Last Updated: 2024-12-07 -->
```

## Testing Prompts

To test prompt changes:
1. Modify the relevant file
2. Restart the application
3. Test with various input types
4. Verify tool execution works correctly

## Response Schema

All responses must be a JSON object with tool calls:

```json
{
  "toolCalls": [
    {"type": "say", "id": "v1", "operation": "speak", "parameters": {"utterance": "..."}},
    {"type": "send_chat", "id": "c1", "operation": "respond", "parameters": {"content": "..."}},
    ...other tool calls...
  ]
}
```

**All output goes through tools:**
- Text to chat → `send_chat`
- Voice output → `say`
- File operations → `file_put`
- Commands → `terminal_execute`

See `tools.md` for complete tool documentation.
