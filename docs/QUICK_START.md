# Agent Attribution System - Quick Start

## What Was Built

A complete agent attribution system that clearly identifies which AI agent performed each GitHub operation (commits, PRs, issues) while maintaining security through OAuth authentication.

## Quick Setup (3 commands)

```bash
# 1. Apply database schema
npm run db:push

# 2. Initialize default agents
npm run seed:agents

# 3. Verify installation
curl http://localhost:5000/api/agents
```

## Quick Test (2 commands)

```bash
# Demo (dry run, safe)
npx tsx scripts/demo-agent-attribution.ts

# Create test PR (requires GitHub auth)
CREATE_DEMO_PR=true npx tsx scripts/demo-agent-attribution.ts
```

## How It Works

### Before
```
All actions → @jasonbender-c3x
❌ Can't distinguish AI from human actions
```

### After
```
AI actions → Agentia Compiler (compiler@agentia.dev)
Human actions → @jasonbender-c3x
✅ Clear attribution with audit trail
```

## Example Commit

```
Author: Agentia Compiler <compiler@agentia.dev>
Committer: jasonbender-c3x <jason@example.com>

[Evolution] Add analysis report

---
🤖 Automated action by Agentia Compiler
```

## Example PR Footer

```markdown
---
*Created by: **Agentia Compiler** (compiler@agentia.dev)*
```

## 10 Predefined Agents

1. ✅ **Agentia Compiler** - Main AI agent (enabled, full permissions)
2. ✅ **Guest Agent** - Limited guest access (enabled, limited permissions)
3-10. 🔴 **Agents 2-9** - Reserved for future (disabled)

## API Quick Reference

```bash
# List agents
curl http://localhost:5000/api/agents

# Get agent details
curl http://localhost:5000/api/agents/{id}

# View recent activity
curl http://localhost:5000/api/agents/activity/recent?limit=20

# Agent-specific activity
curl http://localhost:5000/api/agents/{id}/activity?limit=50
```

## Code Example

```typescript
import { storage } from './server/storage';
import * as github from './server/integrations/github';

// Get agent
const agent = await storage.getAgentByName("Agentia Compiler");

// Create PR with attribution
await github.createPullRequestWithAgent(
  owner, repo, title, body, head,
  {
    name: agent.displayName,
    email: agent.email,
    signature: agent.githubSignature
  }
);

// Log activity
await storage.logAgentActivity({
  agentId: agent.id,
  activityType: 'pr',
  platform: 'github',
  action: 'create',
  success: true
});
```

## Key Files

| File | Purpose |
|------|---------|
| `docs/AGENT_ATTRIBUTION.md` | Complete documentation (9.5KB) |
| `docs/BEFORE_AFTER_COMPARISON.md` | Before/after comparison (10.6KB) |
| `scripts/seed-agents.ts` | Initialize agents |
| `scripts/demo-agent-attribution.ts` | Interactive demo |
| `server/routes/agents.ts` | Agent management API |
| `server/integrations/github.ts` | Agent-aware functions |
| `server/services/agent-attribution-examples.ts` | Code examples |

## Database Tables

### agent_identities
Stores agent profiles with name, email, type, permissions, signature.

### agent_activity_log
Complete audit trail of all agent actions with timestamps, success/failure.

## Security Model

```
┌─────────────────┐
│ User OAuth      │ ← Authentication (secure)
└────────┬────────┘
         ▼
┌─────────────────┐
│ API Call        │ ← Authorization (permissions)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Agent Identity  │ ← Attribution (who did it)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Activity Log    │ ← Audit (tracking)
└─────────────────┘
```

## Features

✅ Clear agent identity for all automated actions
✅ Complete audit trail with timestamps
✅ Permission-based access control
✅ Multi-agent support (10 agents)
✅ RESTful API for management
✅ GitHub commit/PR/issue attribution
✅ Activity logging and querying
✅ Interactive demonstration
✅ Comprehensive documentation
✅ Backward compatible (no breaking changes)

## Evolution Engine Integration

The Evolution Engine automatically uses agent attribution:

```typescript
// Automatically attributed to Agentia Compiler
const report = await generateEvolutionReport();
const result = await createEvolutionPR(report, { owner, repo });
```

Result:
- Commit shows "Agentia Compiler" as author
- PR includes agent signature footer
- Activity logged to database

## Next Steps

1. **Review documentation:** Start with `docs/AGENT_ATTRIBUTION.md`
2. **Run demo:** `npx tsx scripts/demo-agent-attribution.ts`
3. **Test setup:** Apply schema and seed agents
4. **Verify GitHub:** Create test PR and check attribution
5. **Deploy:** Push to production and monitor activity logs

## Support

- **Documentation:** `docs/AGENT_ATTRIBUTION.md`
- **Examples:** `server/services/agent-attribution-examples.ts`
- **Scripts Guide:** `scripts/README.md`
- **Before/After:** `docs/BEFORE_AFTER_COMPARISON.md`

## Status

✅ **Implementation Complete**
✅ **Documentation Complete**  
✅ **Demo Ready**
🔄 **Testing Required** (database migration + seeding)

---

**Total Implementation:** ~1500 lines of code + 30KB documentation
**Files:** 15 files (9 created, 6 modified)
**Ready for:** Testing and deployment
