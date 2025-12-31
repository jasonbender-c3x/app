# Scheduler & Cron Jobs

> Automated task scheduling with cron expressions

---

## Overview

The Meowstik Scheduler runs tasks automatically based on cron expressions. Perfect for:

- Daily summaries and reports
- Periodic email checks
- Automated data syncs
- Reminder systems
- Any recurring AI tasks

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    CRON SCHEDULER                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Parse cron expression                                    │
│  2. Calculate next run time                                  │
│  3. Sleep until due                                          │
│  4. Create task from template                                │
│  5. Submit to job queue                                      │
│  6. Update schedule stats                                    │
│  7. Calculate next run time                                  │
│  8. Repeat                                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Cron Expression Syntax

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6, Sunday = 0)
│ │ │ │ │
* * * * *
```

### Special Characters

| Character | Meaning | Example |
|-----------|---------|---------|
| `*` | Any value | `* * * * *` = every minute |
| `,` | List | `1,15 * * * *` = minute 1 and 15 |
| `-` | Range | `1-5 * * * *` = minutes 1 through 5 |
| `/` | Step | `*/15 * * * *` = every 15 minutes |

### Common Patterns

| Pattern | Expression | Description |
|---------|------------|-------------|
| Every minute | `* * * * *` | Runs every minute |
| Every hour | `0 * * * *` | Top of every hour |
| Every day at 9am | `0 9 * * *` | 9:00 AM daily |
| Every Monday | `0 9 * * 1` | 9:00 AM on Mondays |
| Every weekday | `0 9 * * 1-5` | 9:00 AM Mon-Fri |
| First of month | `0 9 1 * *` | 9:00 AM on 1st |
| Every 15 minutes | `*/15 * * * *` | :00, :15, :30, :45 |

---

## Creating Schedules

### Via UI

1. Go to [/schedules](/schedules)
2. Click "New Schedule"
3. Fill in the form:
   - **Name:** Descriptive name
   - **Cron Expression:** When to run
   - **Task Template:** What to do
   - **Priority:** 0 (highest) to 10 (lowest)
4. Click "Create"

### Via API

```typescript
POST /api/schedules

{
  "name": "Daily Email Summary",
  "cronExpression": "0 9 * * *",
  "taskTemplate": {
    "title": "Email Summary",
    "taskType": "analysis",
    "input": {
      "prompt": "Summarize my unread emails from the last 24 hours"
    }
  },
  "priority": 5,
  "enabled": true
}
```

---

## Schedule Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Human-readable name |
| `cronExpression` | string | When to run |
| `taskTemplate` | object | Task to create when triggered |
| `priority` | number | 0-10, lower = higher priority |
| `enabled` | boolean | Is schedule active? |
| `nextRunAt` | Date | When it will run next |
| `lastRunAt` | Date | When it last ran |
| `runCount` | number | Total successful runs |
| `consecutiveFailures` | number | Failures in a row |
| `maxConsecutiveFailures` | number | Auto-disable threshold |
| `lastError` | string | Most recent error message |

---

## Task Templates

When a schedule triggers, it creates a task from its template:

```typescript
{
  "title": "Check Emails",
  "taskType": "tool",        // "prompt" | "tool" | "workflow"
  "input": {
    "tool": "gmail_search",
    "params": { "query": "is:unread" }
  },
  "priority": 5,
  "maxRetries": 3
}
```

### Task Types

| Type | Description | Example Use |
|------|-------------|-------------|
| `prompt` | Send prompt to LLM | Summaries, analysis |
| `tool` | Execute a specific tool | Email, calendar, files |
| `workflow` | Run multi-step workflow | Complex automations |

---

## Error Handling

### Auto-Disable

Schedules automatically disable after too many consecutive failures:

```
Schedule "Daily Report" disabled after 3 consecutive failures
Last error: "Gmail API quota exceeded"
```

To re-enable:
1. Fix the underlying issue
2. Go to [/schedules](/schedules)
3. Toggle the schedule back on

### Retry Logic

Individual tasks have their own retry logic:

```typescript
{
  "maxRetries": 3,
  "retryDelay": 60000  // 1 minute between retries
}
```

---

## Integration with Job Queue

Scheduled tasks flow through the [Job Orchestration](./job-orchestration.md) system:

```
Schedule Triggers
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Create Job │────►│  Job Queue  │────►│   Worker    │
│  from Tmpl  │     │  (pg-boss)  │     │   Pool      │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Example Schedules

### Morning Briefing

```json
{
  "name": "Morning Briefing",
  "cronExpression": "0 8 * * 1-5",
  "taskTemplate": {
    "title": "Morning Briefing",
    "taskType": "prompt",
    "input": {
      "prompt": "Give me a briefing: unread emails, today's calendar, and any urgent tasks"
    }
  }
}
```

### Weekly Report

```json
{
  "name": "Weekly Report",
  "cronExpression": "0 17 * * 5",
  "taskTemplate": {
    "title": "Weekly Report",
    "taskType": "workflow",
    "input": {
      "steps": [
        { "action": "gmail_search", "query": "after:7d" },
        { "action": "calendar_events", "range": "last_week" },
        { "action": "summarize", "format": "report" }
      ]
    }
  }
}
```

### Hourly Email Check

```json
{
  "name": "Hourly Email Check",
  "cronExpression": "0 * * * *",
  "taskTemplate": {
    "title": "Check Emails",
    "taskType": "tool",
    "input": {
      "tool": "gmail_search",
      "params": { "query": "is:unread label:important" }
    }
  }
}
```

---

## API Reference

### List Schedules

```
GET /api/schedules

Response: Schedule[]
```

### Create Schedule

```
POST /api/schedules

Body: { name, cronExpression, taskTemplate, priority?, enabled? }
Response: Schedule
```

### Update Schedule

```
PATCH /api/schedules/:id

Body: { name?, cronExpression?, taskTemplate?, priority?, enabled? }
Response: Schedule
```

### Delete Schedule

```
DELETE /api/schedules/:id

Response: { success: true }
```

### Trigger Immediately

```
POST /api/schedules/:id/trigger

Response: { jobId: string }
```

---

## Related Documentation

- [Job Orchestration](./job-orchestration.md) - How tasks are executed
- [Agent Configuration](./agent-configuration.md) - Behavior settings
- [Collaborative Editing](./collaborative-editing.md) - Real-time sessions
- [Ragent Index](./INDEX.md) - All agent documentation
