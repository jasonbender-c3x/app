# Meowstik Troubleshooting Manual

> **For The Compiler**: A systematic guide to diagnosing and resolving any issue using the full toolset.

---

## Philosophy: The Complete Toolset

You are not limited to three tools. You have an entire arsenal organized into layers of capability:

### Layer 0: Core Primitives (Local Control)

| Tool | Purpose | Power |
|------|---------|-------|
| `file_get` | Read any file | See the truth |
| `file_put` | Write any file | Change reality |
| `terminal_execute` | Run any command | Act on the world |
| `send_chat` | Communicate with user | Share knowledge |
| `say` | Speak with voice | Be heard |

**Everything local is a file. Everything can be executed. Everything can be changed.**

### Layer 1: Communication (Reach Beyond)

| Tool | Purpose | Power |
|------|---------|-------|
| `sms_send` | Send text message | Reach any phone |
| `sms_list` | List SMS history | See conversations |
| `call_make` | Make voice call | Speak to anyone |
| `call_list` | List call history | See call records |
| `gmail_send` | Send email | Reach any inbox |
| `gmail_search` | Search emails | Find any message |
| `gmail_read` | Read email content | Know what was said |
| `gmail_list` | List emails | See the inbox |

**Every person is reachable. Every message is findable.**

### Layer 2: Google Workspace (Organize & Collaborate)

| Tool | Purpose | Power |
|------|---------|-------|
| `drive_list` | List Drive files | See all documents |
| `drive_get` | Get file content | Read any document |
| `drive_create` | Create file | Make new documents |
| `docs_read` | Read Google Doc | Extract doc content |
| `docs_write` | Write Google Doc | Create/edit docs |
| `sheets_read` | Read spreadsheet | Extract tabular data |
| `sheets_write` | Write spreadsheet | Modify tabular data |
| `calendar_list` | List events | See schedule |
| `calendar_create` | Create event | Schedule meetings |
| `calendar_update` | Update event | Modify schedule |
| `tasks_list` | List tasks | See todos |
| `tasks_create` | Create task | Add todos |
| `contacts_search` | Search contacts | Find people |

**Every document is accessible. Every schedule is modifiable. Every contact is findable.**

### Layer 3: GitHub (Code & Collaboration)

| Tool | Purpose | Power |
|------|---------|-------|
| `github_contents` | List repo contents | See repository structure |
| `github_file_read` | Read file from repo | Get remote code |
| `github_file_write` | Write file to repo | Push changes |
| `github_issue_create` | Create issue | Report problems |
| `github_issue_list` | List issues | See all issues |
| `github_issue_update` | Update issue | Modify issues |
| `github_pr_create` | Create pull request | Propose changes |
| `github_pr_list` | List PRs | See pending changes |
| `github_commit_list` | List commits | See history |
| `github_repo_info` | Get repo info | Understand project |

**Every repository is explorable. Every codebase is modifiable. Every issue is trackable.**

### Layer 4: Web & Browser (See the Internet)

| Tool | Purpose | Power |
|------|---------|-------|
| `browser_screenshot` | Capture webpage | See what users see |
| `browser_navigate` | Go to URL | Visit any site |
| `web_search` | Search the web | Find information |
| `web_fetch` | Fetch URL content | Read any webpage |

**Every website is visible. Every page is readable.**

### Layer 5: AI Generation (Create from Nothing)

| Tool | Purpose | Power |
|------|---------|-------|
| `image_generate` | Generate image | Create visuals |
| `image_edit` | Edit image | Modify visuals |
| `music_generate` | Generate music | Create audio |
| `speech_generate` | Generate speech | Create voice |
| `speech_transcribe` | Transcribe audio | Convert speech to text |

**Every image is creatable. Every sound is producible.**

### Layer 6: Knowledge (Memory & Understanding)

| Tool | Purpose | Power |
|------|---------|-------|
| `rag_query` | Query knowledge base | Recall learned info |
| `rag_ingest` | Ingest document | Learn new info |
| `embed_text` | Create embedding | Vectorize knowledge |
| `codebase_analyze` | Analyze repository | Understand any codebase |

**Every document is memorable. Every codebase is understandable.**

---

## The Universal Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   1. UNDERSTAND    →   What is the actual problem?                  │
│         ↓              (file_get, terminal_execute, logs)           │
│                                                                     │
│   2. RESEARCH      →   What information do I need?                  │
│         ↓              (web_search, rag_query, github_contents)     │
│                                                                     │
│   3. COMMUNICATE   →   Do I need to involve others?                 │
│         ↓              (send_chat, sms_send, gmail_send)            │
│                                                                     │
│   4. ACT           →   What changes need to be made?                │
│         ↓              (file_put, terminal_execute, github_*)       │
│                                                                     │
│   5. VERIFY        →   Did the fix work?                            │
│         ↓              (terminal_execute, browser_screenshot)       │
│                                                                     │
│   6. DOCUMENT      →   What did I learn?                            │
│                        (file_put, rag_ingest, send_chat)            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Exploration & Log Discovery

### Getting Directory Structures

```bash
# Tree view (best for understanding structure)
terminal_execute: tree -L 3 -I 'node_modules|.git|dist'

# If tree not available, use find
terminal_execute: find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | head -50

# List with details (size, permissions, dates)
terminal_execute: ls -lahR . | head -100

# Just directories
terminal_execute: find . -type d -maxdepth 3 2>/dev/null | grep -v node_modules | grep -v .git

# Count files by type
terminal_execute: find . -type f -name "*.ts" | wc -l

# Find largest directories
terminal_execute: du -sh */ 2>/dev/null | sort -hr | head -10
```

### Standard Project Structure (Node.js/React)

```
project/
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions
│   │   └── App.tsx         # Main app component
│   └── index.html          # Entry HTML
├── server/                 # Backend Express app
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Database operations
│   ├── services/           # Business logic
│   └── index.ts            # Server entry point
├── shared/                 # Shared types/schemas
│   └── schema.ts           # Drizzle ORM schema
├── docs/                   # Documentation
│   └── ragent/             # AI knowledge docs
├── packages/               # Monorepo packages
│   ├── extension/          # Browser extension
│   └── meowstik-agent/     # Desktop agent
├── /tmp/logs/              # Runtime logs (ephemeral)
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite bundler config
├── drizzle.config.ts       # Database config
└── replit.md               # Project documentation
```

---

## Where to Find Log Files

### Meowstik-Specific Logs

| Log Type | Location | Contains |
|----------|----------|----------|
| **Workflow/Server** | `/tmp/logs/Start_application_*.log` | Express server output, API calls, errors |
| **Browser Console** | `/tmp/logs/browser_console_*.log` | Frontend errors, React warnings, console.log |
| **Database (Drizzle)** | Inline in server logs | SQL queries, connection errors |

### Standard Linux Log Locations

| Log Type | Location | Contains |
|----------|----------|----------|
| System messages | `/var/log/syslog` | General system events |
| Kernel | `/var/log/kern.log` | Kernel-level events |
| Auth | `/var/log/auth.log` | Login attempts, sudo usage |
| Cron | `/var/log/cron.log` | Scheduled job output |
| Nginx | `/var/log/nginx/` | Web server access/error |
| PM2 | `~/.pm2/logs/` | Process manager logs |

### Node.js Application Logs

| Pattern | Location | Notes |
|---------|----------|-------|
| stdout/stderr | Console or redirected file | `node app.js > app.log 2>&1` |
| Winston | Configurable, often `./logs/` | Check winston config |
| Bunyan | Configurable | JSON formatted |
| Pino | Configurable | Fast JSON logger |
| Morgan | stdout | HTTP request logging |
| Debug | stderr | Set `DEBUG=*` env var |

### Finding Logs Dynamically

```bash
# Find all log files
terminal_execute: find / -name "*.log" 2>/dev/null | head -30

# Find recently modified logs
terminal_execute: find /tmp -name "*.log" -mmin -60 2>/dev/null

# Find logs by content
terminal_execute: grep -rl "error" /tmp/logs/ 2>/dev/null

# Check where app writes logs
terminal_execute: lsof -p $(pgrep -f "node") 2>/dev/null | grep -E "\.log|/tmp"

# Environment variables for log paths
terminal_execute: env | grep -i log
```

---

## Logging Libraries & Tools

### Node.js Logging Libraries

| Library | Best For | Install | Features |
|---------|----------|---------|----------|
| **Winston** | Full-featured | `npm i winston` | Transports, levels, formatting |
| **Pino** | Performance | `npm i pino` | Fast, JSON, low overhead |
| **Bunyan** | Structured | `npm i bunyan` | JSON, child loggers |
| **Morgan** | HTTP only | `npm i morgan` | Express middleware |
| **Debug** | Development | `npm i debug` | Namespace filtering |
| **loglevel** | Minimal | `npm i loglevel` | Lightweight, browser+node |
| **consola** | Beautiful | `npm i consola` | Pretty output, types |

### Quick Setup Examples

#### Winston (Recommended for Production)

```typescript
// server/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: '/tmp/logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: '/tmp/logs/combined.log' 
    })
  ]
});
```

#### Pino (Fastest)

```typescript
// server/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Usage
logger.info({ userId: 123 }, 'User logged in');
logger.error({ err }, 'Database connection failed');
```

#### Debug (Development)

```typescript
// Enable with: DEBUG=app:* node server.js
import debug from 'debug';

const log = debug('app:server');
const dbLog = debug('app:database');

log('Server starting on port %d', 5000);
dbLog('Connected to database');
```

### Log Analysis Tools

```bash
# Real-time log watching
terminal_execute: tail -f /tmp/logs/*.log

# Filter by level
terminal_execute: grep -E "ERROR|WARN" /tmp/logs/combined.log

# JSON log parsing with jq
terminal_execute: cat /tmp/logs/app.log | jq 'select(.level == "error")'

# Count errors by type
terminal_execute: grep -oP '"message":"[^"]*"' /tmp/logs/*.log | sort | uniq -c | sort -rn

# Time-based filtering
terminal_execute: awk '/2026-01-03T21:/ {print}' /tmp/logs/combined.log

# Log rotation (logrotate config)
terminal_execute: cat /etc/logrotate.d/app
```

### Log Aggregation Services

| Service | Use Case | Integration |
|---------|----------|-------------|
| **Datadog** | Full observability | Agent + library |
| **Logtail** | Simple log management | HTTP transport |
| **Papertrail** | Real-time search | Syslog/HTTP |
| **LogDNA** | IBM Cloud | Agent/API |
| **Elastic Stack** | Self-hosted | Filebeat/Logstash |

### Frontend Logging

```typescript
// client/src/lib/logger.ts
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export const clientLogger = {
  debug: (...args: any[]) => {
    if (import.meta.env.DEV) console.debug('[DEBUG]', ...args);
  },
  info: (...args: any[]) => console.info('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
    // Optionally send to server
    fetch('/api/log', {
      method: 'POST',
      body: JSON.stringify({ level: 'error', args, timestamp: Date.now() })
    }).catch(() => {});
  }
};
```

---

## Chapter 1: Observation — Finding the Problem

### 1.1 Check Logs First

Logs are truth. Always start here.

```bash
# Server/workflow logs
terminal_execute: cat /tmp/logs/Start_application_*.log | tail -100

# Browser console logs  
terminal_execute: cat /tmp/logs/browser_console_*.log

# Search for errors across all logs
terminal_execute: grep -i "error\|fail\|exception\|crash" /tmp/logs/*.log

# Search for a specific term
terminal_execute: grep -r "TypeError" /tmp/logs/
```

### 1.2 Check Process Status

```bash
# Is the server running?
terminal_execute: ps aux | grep node

# What's listening on port 5000?
terminal_execute: lsof -i :5000

# Check workflow status
terminal_execute: curl -s localhost:5000/api/status | jq
```

### 1.3 Read the Code

```bash
# Read a file
file_get: server/routes.ts

# Find where something is defined
terminal_execute: grep -rn "functionName" --include="*.ts" .

# Find all files that import something
terminal_execute: grep -rln "import.*ComponentName" --include="*.tsx" client/
```

### 1.4 Check the Database

```bash
# List tables
terminal_execute: psql $DATABASE_URL -c "\dt"

# Check table structure
terminal_execute: psql $DATABASE_URL -c "\d tablename"

# Query data
terminal_execute: psql $DATABASE_URL -c "SELECT * FROM messages LIMIT 5;"
```

### 1.5 Check External Services

```bash
# Check Gmail for related errors/alerts
gmail_search: "error OR alert OR failed" newer_than:1d

# Check GitHub for recent commits that might have caused issues
github_commit_list: repo="owner/repo" count=10

# Check calendar for scheduled maintenance
calendar_list: time_min="today" time_max="tomorrow"
```

### 1.6 Visual Verification

```bash
# Take screenshot of the current state
browser_screenshot: url="http://localhost:5000"

# See what the user sees
browser_navigate: url="http://localhost:5000/problematic-page"
```

---

## Chapter 2: Common Problem Patterns

### 2.1 "It's Not Working" (Vague)

**Strategy**: Narrow down systematically.

```bash
# Step 1: Is the server up?
terminal_execute: curl -s localhost:5000/api/status

# Step 2: Are there recent errors?
terminal_execute: grep -i error /tmp/logs/*.log | tail -20

# Step 3: Check browser console
terminal_execute: cat /tmp/logs/browser_console_*.log | tail -50

# Step 4: Try the specific endpoint
terminal_execute: curl -s localhost:5000/api/chats | head -20

# Step 5: Visual check
browser_screenshot: url="http://localhost:5000"
```

### 2.2 "API Returns 500"

**Strategy**: Trace the request path.

```bash
# Find the route handler
terminal_execute: grep -rn "app.get\|app.post\|router" server/routes*.ts | head -30

# Read the handler
file_get: server/routes.ts

# Check for unhandled errors
terminal_execute: grep -B5 -A10 "throw\|catch" server/routes.ts

# Check if similar issues exist on GitHub
github_issue_list: repo="owner/repo" state="open" labels="bug"
```

### 2.3 "Page Won't Load"

**Strategy**: Check frontend → backend → network.

```bash
# Check if client builds
terminal_execute: npm run build 2>&1 | tail -30

# Check for TypeScript errors
terminal_execute: npx tsc --noEmit 2>&1 | head -50

# Check the page component exists
terminal_execute: ls -la client/src/pages/

# Read the router
file_get: client/src/App.tsx

# Visual verification
browser_screenshot: url="http://localhost:5000/broken-page"
```

### 2.4 "Database Error"

**Strategy**: Verify connection → schema → query.

```bash
# Test connection
terminal_execute: psql $DATABASE_URL -c "SELECT 1;"

# Check if tables exist
terminal_execute: psql $DATABASE_URL -c "\dt"

# Check schema matches code
file_get: shared/schema.ts

# Run pending migrations
terminal_execute: npm run db:push
```

### 2.5 "External Service Not Responding"

**Strategy**: Check credentials → connectivity → service status.

```bash
# Test Gmail connection
gmail_list: max_results=1

# Test GitHub connection
github_repo_info: repo="owner/repo"

# Test Twilio
sms_list: limit=1

# Web search for service outages
web_search: "Gmail API outage today"
```

### 2.6 "User Reported Issue via Email"

**Strategy**: Find the report → understand → investigate → respond.

```bash
# Find the user's email
gmail_search: "from:user@example.com bug OR error OR broken"

# Read the details
gmail_read: message_id="abc123"

# Investigate the reported issue
terminal_execute: grep -i "reported_error_text" /tmp/logs/*.log

# Respond to user
gmail_send: to="user@example.com" subject="Re: Bug Report" body="..."
```

---

## Chapter 3: Fixing Things

### 3.1 Edit a File

```bash
# Read current content
file_get: path/to/file.ts

# Write new content (full file replacement)
file_put: path/to/file.ts
content: |
  // Your new file content here
  export function fixed() {
    return "it works now";
  }
```

### 3.2 Quick Patches

```bash
# Append to a file
terminal_execute: echo "new line" >> path/to/file.txt

# Replace text in place
terminal_execute: sed -i 's/oldtext/newtext/g' path/to/file.ts

# Comment out a line
terminal_execute: sed -i 's/^problematicLine/\/\/ problematicLine/' file.ts
```

### 3.3 Restart Services

```bash
# Restart the app workflow
# (Use the restart_workflow tool)

# Kill a stuck process
terminal_execute: pkill -f "node.*server"

# Clear node modules and reinstall
terminal_execute: rm -rf node_modules && npm install
```

### 3.4 Database Fixes

```bash
# Insert data
terminal_execute: psql $DATABASE_URL -c "INSERT INTO table (col) VALUES ('val');"

# Update data  
terminal_execute: psql $DATABASE_URL -c "UPDATE table SET col='val' WHERE id=1;"

# Reset a sequence
terminal_execute: psql $DATABASE_URL -c "ALTER SEQUENCE table_id_seq RESTART WITH 1;"

# Drop and recreate (DANGEROUS)
terminal_execute: npm run db:push --force
```

### 3.5 Push Fixes to GitHub

```bash
# Create a branch and commit
terminal_execute: git checkout -b fix/issue-description
terminal_execute: git add -A
terminal_execute: git commit -m "fix: description of fix"

# Create PR
github_pr_create: repo="owner/repo" title="Fix: issue" body="..." head="fix/issue" base="main"

# Or update file directly
github_file_write: repo="owner/repo" path="file.ts" content="..." message="fix: description"
```

### 3.6 Notify Stakeholders

```bash
# Notify via chat
send_chat: "Fixed the issue. The problem was X, solution was Y."

# Notify via email
gmail_send: to="team@company.com" subject="Issue Resolved" body="..."

# Notify via SMS (urgent)
sms_send: to="+1234567890" body="Critical fix deployed. Please verify."

# Update GitHub issue
github_issue_update: repo="owner/repo" issue_number=123 state="closed" comment="Fixed in PR #456"
```

---

## Chapter 4: Advanced Techniques

### 4.1 Trace Execution Flow

```bash
# Add debug logging
file_get: server/routes.ts
# Then add: console.log('[DEBUG] reached here', variable);
file_put: server/routes.ts

# Watch logs in real-time concept
terminal_execute: tail -f /tmp/logs/Start_application_*.log
```

### 4.2 Network Debugging

```bash
# Test an endpoint with full output
terminal_execute: curl -v localhost:5000/api/endpoint

# Test with POST data
terminal_execute: curl -X POST localhost:5000/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Check what's being returned
terminal_execute: curl -s localhost:5000/api/endpoint | jq
```

### 4.3 Find Root Cause

```bash
# Git blame - who changed this?
terminal_execute: git blame path/to/file.ts | head -20

# Git log - recent changes
terminal_execute: git log --oneline -20

# Git diff - what changed?
terminal_execute: git diff HEAD~5 path/to/file.ts

# Check GitHub for related issues/PRs
github_issue_list: repo="owner/repo" search="related term"
github_pr_list: repo="owner/repo" state="merged"
```

### 4.4 Memory/Performance Issues

```bash
# Check memory usage
terminal_execute: free -h

# Check disk space
terminal_execute: df -h

# Find large files
terminal_execute: find . -type f -size +10M 2>/dev/null

# Check node process memory
terminal_execute: ps aux | grep node | awk '{print $4, $11}'
```

### 4.5 Cross-Reference Information

```bash
# Search knowledge base for similar issues
rag_query: "error handling authentication timeout"

# Search web for solutions
web_search: "node.js ECONNRESET error handling"

# Check if documented in Drive
drive_list: query="troubleshooting OR debugging"

# Analyze related codebase
codebase_analyze: repo="owner/related-repo" focus="error handling"
```

### 4.6 Generate Documentation

```bash
# Create visual documentation
image_generate: prompt="flowchart showing error handling process"

# Speak the summary for accessibility
say: "The issue was caused by a race condition in the authentication flow..."

# Document in knowledge base
rag_ingest: content="Lesson learned: Always check..." source="incident-2026-01-03"
```

---

## Chapter 5: Proactive Operations

### 5.1 Morning Health Check

```bash
# Check all services
terminal_execute: curl -s localhost:5000/api/status | jq

# Check for overnight errors
terminal_execute: grep -i error /tmp/logs/*.log | wc -l

# Check email for alerts
gmail_search: "alert OR error OR urgent" newer_than:12h

# Check calendar for scheduled tasks
calendar_list: time_min="today" time_max="tomorrow"

# Check GitHub for new issues
github_issue_list: repo="owner/repo" state="open" since="yesterday"
```

### 5.2 Before Deployment

```bash
# Run tests
terminal_execute: npm test 2>&1

# Check TypeScript
terminal_execute: npx tsc --noEmit

# Visual regression check
browser_screenshot: url="http://localhost:5000"

# Verify database migrations
terminal_execute: npm run db:push --dry-run

# Notify team
gmail_send: to="team@company.com" subject="Deployment Starting" body="..."
```

### 5.3 After Incident

```bash
# Document what happened
file_put: docs/incidents/2026-01-03.md

# Ingest into knowledge base for future reference
rag_ingest: file="docs/incidents/2026-01-03.md"

# Create follow-up tasks
tasks_create: title="Post-mortem review" due="tomorrow"

# Update calendar with review meeting
calendar_create: summary="Incident Review" start="..." attendees="..."

# Create GitHub issue for prevention
github_issue_create: repo="owner/repo" title="Prevent recurrence of..." labels="improvement"
```

---

## Chapter 6: Prevention

### 6.1 Before Making Changes

```bash
# Understand the current state
file_get: relevant/file.ts
terminal_execute: git status
terminal_execute: git diff

# Verify tests pass
terminal_execute: npm test 2>&1 | tail -20

# Check for related issues
github_issue_list: repo="owner/repo" search="feature being modified"
```

### 6.2 After Making Changes

```bash
# Check for TypeScript errors
terminal_execute: npx tsc --noEmit 2>&1

# Verify the app still runs
terminal_execute: curl -s localhost:5000/api/status

# Check logs for new errors
terminal_execute: grep -i error /tmp/logs/*.log | tail -10

# Visual verification
browser_screenshot: url="http://localhost:5000"

# Notify of completion
send_chat: "Changes complete. Verified working."
```

---

## Quick Reference Card

### Diagnosis

| Problem | First Tool |
|---------|------------|
| Server down | `terminal_execute: curl localhost:5000/api/status` |
| Any error | `terminal_execute: grep -i error /tmp/logs/*.log` |
| Can't find code | `terminal_execute: grep -rn "term" --include="*.ts" .` |
| DB issue | `terminal_execute: psql $DATABASE_URL -c "\dt"` |
| Build fails | `terminal_execute: npm run build 2>&1` |
| Visual bug | `browser_screenshot: url="..."` |
| External service | `gmail_list`, `github_repo_info`, `sms_list` |

### Information Gathering

| Need | Tool |
|------|------|
| Web info | `web_search: "query"` |
| Prior knowledge | `rag_query: "topic"` |
| Email history | `gmail_search: "terms"` |
| Repo structure | `github_contents: repo="..." path="/"` |
| Schedule | `calendar_list: time_min="today"` |
| Contacts | `contacts_search: query="name"` |

### Communication

| Channel | Tool |
|---------|------|
| Chat | `send_chat: "message"` |
| Voice | `say: "message"` |
| Email | `gmail_send: to="..." subject="..." body="..."` |
| SMS | `sms_send: to="..." body="..."` |
| Phone | `call_make: to="..."` |
| GitHub | `github_issue_create`, `github_pr_create` |

### Creation

| Output | Tool |
|--------|------|
| File | `file_put: path="..." content="..."` |
| Image | `image_generate: prompt="..."` |
| Audio | `music_generate`, `speech_generate` |
| Document | `docs_write`, `sheets_write` |
| Event | `calendar_create` |
| Task | `tasks_create` |

---

## The Golden Rules

1. **Logs don't lie** — Always check them first
2. **Read before write** — Understand the code before changing it
3. **One change at a time** — Makes it easy to identify what fixed/broke things
4. **Verify after fixing** — Confirm the fix worked before moving on
5. **Document what you learned** — Update knowledge base with new patterns
6. **Communicate proactively** — Keep stakeholders informed
7. **Use the right tool** — Don't force a hammer when you need a screwdriver
8. **Chain tools intelligently** — Combine capabilities for complex problems

---

## Tool Capability Matrix

| Capability | Tools |
|------------|-------|
| **Read** | file_get, gmail_read, drive_get, docs_read, sheets_read, github_file_read, rag_query |
| **Write** | file_put, gmail_send, drive_create, docs_write, sheets_write, github_file_write, rag_ingest |
| **Execute** | terminal_execute, call_make |
| **Search** | gmail_search, drive_list, web_search, contacts_search, github_issue_list, rag_query |
| **Create** | file_put, gmail_send, calendar_create, tasks_create, github_issue_create, github_pr_create, image_generate |
| **Communicate** | send_chat, say, sms_send, gmail_send, call_make |
| **Visualize** | browser_screenshot, image_generate |
| **Learn** | rag_ingest, codebase_analyze, embed_text |

---

## Log Locations Summary

| Log Type | Path |
|----------|------|
| Server/Workflow | `/tmp/logs/Start_application_*.log` |
| Browser Console | `/tmp/logs/browser_console_*.log` |
| Drizzle/DB | Inline in server logs |
| Build errors | Output of `npm run build` |

---

*Last updated: 2026-01-03*
*Compiler revision: Extended toolset documentation*
