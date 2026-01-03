# Scripts

Utility scripts for managing the Meowstik application.

## Agent Attribution Scripts

### Seed Agents
Initialize the database with default agent identities:

```bash
npm run seed:agents
```

This creates:
- **Agentia Compiler** - Main AI agent (enabled)
- **Guest Agent** - Limited access agent (enabled)
- **Agents 2-9** - Reserved for future use (disabled)

### Demonstrate Agent Attribution
Show how the agent attribution system works:

```bash
# Dry run (shows what would happen)
npx tsx scripts/demo-agent-attribution.ts

# Create actual demo PR
CREATE_DEMO_PR=true npx tsx scripts/demo-agent-attribution.ts
```

The demonstration:
1. Lists all available agents
2. Shows agent configuration
3. Displays attribution examples
4. Shows recent activity logs
5. Optionally creates a test PR with agent attribution

### Check Agent Activity
View recent agent activities:

```bash
curl http://localhost:5000/api/agents/activity/recent?limit=20
```

## Other Scripts

### Build
Build the production bundle:

```bash
npm run build
```

### Database Push
Apply database schema changes:

```bash
npm run db:push
```

### Type Check
Run TypeScript type checking:

```bash
npm run check
```

## Development

All scripts use TypeScript and can be run with `tsx`:

```bash
npx tsx scripts/<script-name>.ts
```

## Environment Variables

Some scripts may require:
- `DATABASE_URL` - PostgreSQL connection string
- `GITHUB_TOKEN` - GitHub OAuth token (managed by Replit connector)
- `TARGET_REPO` - Target repository for demos (default: jasonbender-c3x/app)
