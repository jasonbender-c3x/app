# Meowstik Troubleshooting Manual

> **For The Compiler**: A systematic guide to diagnosing and resolving any issue using core primitives.

---

## Philosophy

You have three fundamental tools that, combined correctly, can solve any problem:

| Tool | Purpose | Power |
|------|---------|-------|
| `file_get` | Read any file | See the truth |
| `file_put` | Write any file | Change reality |
| `terminal_execute` | Run any command | Act on the world |

**Everything is a file. Everything can be executed. Everything can be changed.**

---

## The Troubleshooting Loop

```
┌─────────────────────────────────────────────────────────────┐
│  1. OBSERVE  →  2. HYPOTHESIZE  →  3. TEST  →  4. FIX      │
│       ↑                                            │        │
│       └────────────────────────────────────────────┘        │
│                    (repeat until solved)                    │
└─────────────────────────────────────────────────────────────┘
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

### 2.5 "Module Not Found"

**Strategy**: Check imports → packages → paths.

```bash
# Check if package is installed
terminal_execute: grep "packageName" package.json

# Install if missing
terminal_execute: npm install packageName

# Check import path is correct
terminal_execute: ls -la path/to/module

# Check tsconfig paths
file_get: tsconfig.json
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

---

## Chapter 5: Prevention

### 5.1 Before Making Changes

```bash
# Understand the current state
file_get: relevant/file.ts
terminal_execute: git status
terminal_execute: git diff

# Verify tests pass
terminal_execute: npm test 2>&1 | tail -20
```

### 5.2 After Making Changes

```bash
# Check for TypeScript errors
terminal_execute: npx tsc --noEmit 2>&1

# Verify the app still runs
terminal_execute: curl -s localhost:5000/api/status

# Check logs for new errors
terminal_execute: grep -i error /tmp/logs/*.log | tail -10
```

---

## Quick Reference Card

| Problem | First Command |
|---------|---------------|
| Server down | `curl localhost:5000/api/status` |
| Any error | `grep -i error /tmp/logs/*.log \| tail -20` |
| Can't find code | `grep -rn "searchterm" --include="*.ts" .` |
| DB issue | `psql $DATABASE_URL -c "\dt"` |
| Build fails | `npm run build 2>&1 \| tail -50` |
| Package missing | `grep "name" package.json` |
| Process stuck | `ps aux \| grep node` |
| File contents | `file_get: path/to/file` |
| Change file | `file_put: path/to/file` |

---

## The Golden Rules

1. **Logs don't lie** — Always check them first
2. **Read before write** — Understand the code before changing it
3. **One change at a time** — Makes it easy to identify what fixed/broke things
4. **Verify after fixing** — Confirm the fix worked before moving on
5. **Document what you learned** — Update this manual when you discover new patterns

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
*Compiler revision: For internal diagnostic use*
