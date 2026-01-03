# Agent Attribution System

## Overview

The Agent Attribution System provides per-agent tracking and attribution for all automated actions performed by the AI system. This ensures clear accountability and auditability for GitHub commits, pull requests, issues, and Google Workspace operations.

## Architecture

### Database Schema

The system introduces two new tables:

1. **`agent_identities`** - Stores agent profiles with unique names, emails, and permissions
2. **`agent_activity_log`** - Audit trail of all actions performed by agents

### Agent Types

- **Compiler** (`compiler`): Main AI agent with full system permissions
- **Guest** (`guest`): Limited-access agent for guest users
- **Specialized** (`specialized`): Custom agents for specific tasks (Agents 2-9)

### Permission Levels

- **Full** (`full`): Complete access to all operations
- **Limited** (`limited`): Read + basic write operations
- **Readonly** (`readonly`): Read-only access

## Predefined Agents

### 1. Agentia Compiler
- **Email**: `compiler@agentia.dev`
- **Type**: Compiler
- **Permissions**: Full
- **Purpose**: Primary AI agent for autonomous operations

### 2. Guest Agent
- **Email**: `guest@agentia.dev`
- **Type**: Guest
- **Permissions**: Limited
- **Purpose**: Guest user operations with restricted access

### 3-10. Agent 2-9
- **Emails**: `agent2@agentia.dev` through `agent9@agentia.dev`
- **Type**: Specialized
- **Permissions**: Full
- **Purpose**: Reserved for future specialized implementations
- **Status**: Disabled by default

## How Attribution Works

### GitHub Operations

#### Commits
When creating commits, the system uses Git's native author field:

```typescript
// Traditional approach (attributed to authenticated user)
await github.createOrUpdateFile(owner, repo, path, content, message, branch);

// Agent-attributed approach (custom author)
await github.createOrUpdateFileWithAgent(
  owner, repo, path, content, message, branch,
  {
    name: "Agentia Compiler",
    email: "compiler@agentia.dev",
    signature: "🤖 Automated action by Agentia Compiler"
  }
);
```

The Git commit will show:
- **Author**: Agentia Compiler <compiler@agentia.dev>
- **Committer**: [Authenticated user from GitHub OAuth]

#### Pull Requests
PR descriptions are automatically amended with agent attribution:

```typescript
await github.createPullRequestWithAgent(
  owner, repo, title, body, head, agent
);
```

Result:
```markdown
[Original PR body]

---
*Created by: **Agentia Compiler** (compiler@agentia.dev)*
```

#### Issues
Issue bodies receive similar attribution footers:

```typescript
await github.createIssueWithAgent(
  owner, repo, title, agent, body, labels, assignees
);
```

### Google Workspace Operations

For Google Workspace, the authenticated user's credentials authorize the API calls, but:

1. **Email signatures** can include agent attribution
2. **Document comments** identify the acting agent
3. **Activity logs** track which agent performed each operation

### Activity Logging

All agent actions are logged to the database:

```typescript
await storage.logAgentActivity({
  agentId: agent.id,
  activityType: 'pr',
  platform: 'github',
  resourceType: 'pull_request',
  resourceId: prNumber.toString(),
  resourceUrl: prUrl,
  action: 'create',
  title: prTitle,
  metadata: { /* additional context */ },
  success: true
});
```

## API Endpoints

### List All Agents
```http
GET /api/agents
GET /api/agents?enabled=true
```

### Get Agent Details
```http
GET /api/agents/:id
```

### Create New Agent
```http
POST /api/agents
Content-Type: application/json

{
  "name": "Custom Agent",
  "email": "custom@agentia.dev",
  "displayName": "Custom Agent",
  "agentType": "specialized",
  "permissionLevel": "limited",
  "description": "Custom agent for specific tasks",
  "githubSignature": "🔧 Custom Agent Action",
  "enabled": true
}
```

### Update Agent
```http
PATCH /api/agents/:id
Content-Type: application/json

{
  "enabled": false,
  "description": "Updated description"
}
```

### View Agent Activity
```http
GET /api/agents/:id/activity?limit=50
GET /api/agents/activity/recent?limit=50
```

## Setup Instructions

### 1. Database Migration

Push the updated schema to your database:

```bash
npm run db:push
```

### 2. Seed Default Agents

Initialize the predefined agents:

```bash
npx tsx scripts/seed-agents.ts
```

This creates:
- Agentia Compiler (enabled)
- Guest Agent (enabled)
- Agents 2-9 (disabled, reserved for future use)

### 3. Environment Variables

No additional environment variables are required. The system uses existing GitHub OAuth credentials from Replit's connector system.

### 4. Verify Installation

Check that agents are properly created:

```bash
curl http://localhost:5000/api/agents
```

Expected response:
```json
{
  "agents": [
    {
      "id": "...",
      "name": "Agentia Compiler",
      "email": "compiler@agentia.dev",
      "displayName": "Agentia Compiler",
      "agentType": "compiler",
      "permissionLevel": "full",
      "enabled": true,
      ...
    },
    ...
  ]
}
```

## Usage Examples

### Evolution Engine with Attribution

The Evolution Engine now automatically uses agent attribution:

```typescript
// Create PR with Agentia Compiler attribution
const result = await createEvolutionPR(report, {
  owner: 'jasonbender-c3x',
  repo: 'app'
});
```

The resulting commit and PR will show:
- Commit author: Agentia Compiler
- PR footer: "Created by: **Agentia Compiler** (compiler@agentia.dev)"

### Custom Agent Operations

For specialized operations, get a specific agent:

```typescript
import { storage } from './storage';
import * as github from './integrations/github';

// Get specialized agent
const agent = await storage.getAgentByName('Agent-2');

// Use for GitHub operations
await github.createIssueWithAgent(
  owner, repo, 
  'Automated issue title',
  {
    name: agent.displayName,
    email: agent.email,
    signature: agent.githubSignature
  },
  'Issue body content'
);

// Log the activity
await storage.logAgentActivity({
  agentId: agent.id,
  activityType: 'issue',
  platform: 'github',
  resourceType: 'issue',
  action: 'create',
  title: 'Automated issue title',
  success: true
});
```

## Viewing Attribution

### On GitHub

1. **Commits**: View commit history to see agent as author
2. **Pull Requests**: Check PR description footer for agent signature
3. **Issues**: Look for agent attribution at the bottom of issue body
4. **Comments**: Agent signature appears at the end of automated comments

### In Application

Query the activity log API:

```javascript
// Get recent activity across all agents
const response = await fetch('/api/agents/activity/recent?limit=20');
const { activities } = await response.json();

activities.forEach(activity => {
  console.log(`${activity.agent.displayName} performed ${activity.action} on ${activity.platform}`);
  console.log(`Resource: ${activity.resourceUrl}`);
});
```

## Future Enhancements

### Planned Features

1. **Agent Rotation**: Automatic load balancing across multiple agents
2. **Permission Enforcement**: Runtime checks based on agent permission level
3. **Agent Analytics**: Dashboard showing agent activity metrics
4. **Custom Agent Creation UI**: Web interface for creating/managing agents
5. **Agent-specific Rate Limits**: Per-agent GitHub API quotas
6. **Multi-tenant Support**: Per-user agent configurations

### Google Workspace Extension

Future work will extend attribution to:

1. **Gmail**: From address selection or signature injection
2. **Google Drive**: Document creator/modifier metadata
3. **Calendar**: Event creator attribution
4. **Docs/Sheets**: Comment and edit attribution

## Security Considerations

### Authentication vs Authorization

- **Authentication**: Uses primary user's OAuth tokens (GitHub, Google)
- **Authorization**: API calls are authorized by the authenticated user
- **Attribution**: Actions are credited to the specific agent

This separation ensures:
1. Security: All operations require valid user credentials
2. Accountability: Clear tracking of which agent performed each action
3. Auditability: Complete log of automated actions

### Access Control

Future versions will implement:
- Permission-based operation filtering
- Agent-specific API key rotation
- Action approval workflows for sensitive operations

## Troubleshooting

### Agent Not Found Errors

If Evolution Engine reports "Agent not found", run the seed script:

```bash
npx tsx scripts/seed-agents.ts
```

### Database Connection Issues

Ensure `DATABASE_URL` environment variable is set:

```bash
echo $DATABASE_URL
```

If not set, configure it in your environment or `.env` file.

### GitHub Attribution Not Showing

1. **Commits**: Check that you're using `*WithAgent` functions
2. **PRs/Issues**: Verify agent signature is included in body
3. **Activity Logs**: Ensure logging code is called after operations

## Support

For issues or questions about the Agent Attribution System:

1. Check the activity logs: `GET /api/agents/activity/recent`
2. Verify agent configuration: `GET /api/agents`
3. Review server logs for error messages
4. Consult the Evolution Engine implementation for examples

## References

- **Evolution Engine**: `server/services/evolution-engine.ts`
- **GitHub Integration**: `server/integrations/github.ts`
- **Agent Storage**: `server/storage.ts`
- **API Routes**: `server/routes/agents.ts`
- **Database Schema**: `shared/schema.ts`
- **Seed Script**: `scripts/seed-agents.ts`
