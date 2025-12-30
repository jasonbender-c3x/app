# Job Orchestration System

Meowstik's job orchestration system enables multi-worker parallel processing with DAG-based dependency resolution, priority scheduling, and comprehensive lifecycle management.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Job Lifecycle](#job-lifecycle)
5. [Dependency Resolution](#dependency-resolution)
6. [Priority Scheduling](#priority-scheduling)
7. [API Reference](#api-reference)
8. [Configuration](#configuration)
9. [Examples](#examples)
10. [Monitoring](#monitoring)

---

## Overview

The job orchestration system transforms Meowstik from a single-threaded chat assistant into a powerful agentic platform capable of:

- **Parallel Execution** - Multiple workers process independent tasks simultaneously
- **Dependency Chains** - Tasks wait for prerequisites before starting
- **Priority Scheduling** - Critical tasks jump the queue
- **Fault Tolerance** - Failed jobs retry automatically
- **Result Aggregation** - Outputs from multiple jobs combine intelligently

**Key Files:**
- [`server/services/job-queue.ts`](../../server/services/job-queue.ts) - pg-boss backed queue
- [`server/services/job-dispatcher.ts`](../../server/services/job-dispatcher.ts) - Coordination layer
- [`server/services/worker-pool.ts`](../../server/services/worker-pool.ts) - Worker management
- [`server/services/dependency-resolver.ts`](../../server/services/dependency-resolver.ts) - DAG resolution
- [`server/services/workflow-executor.ts`](../../server/services/workflow-executor.ts) - Legacy bridge

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Job Submission                              │
│  (API Routes, Cron Scheduler, Trigger Service, Workflow Tasks)  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Job Dispatcher                               │
│  - Receives job requests                                         │
│  - Validates parameters                                          │
│  - Assigns priority and dependencies                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Job Queue                                   │
│  - pg-boss PostgreSQL-backed queue                               │
│  - Priority ordering (0 = highest)                               │
│  - Expiration and retry handling                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Dependency Resolver                             │
│  - DAG construction and validation                               │
│  - Topological sort for execution order                          │
│  - Cycle detection                                               │
│  - Result aggregation from dependencies                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Worker Pool                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                            │
│  │ Worker 1│ │ Worker 2│ │ Worker N│  - Min/max worker scaling  │
│  │ (Gemini)│ │ (Gemini)│ │ (Gemini)│  - Health checks           │
│  └─────────┘ └─────────┘ └─────────┘  - Auto-restart            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Job Results                                   │
│  - Output storage                                                │
│  - Token usage tracking                                          │
│  - Error capture                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### Job Queue (`job-queue.ts`)

PostgreSQL-backed queue using pg-boss for reliable job processing.

```typescript
interface JobQueueConfig {
  schema: string;           // PostgreSQL schema name
  application_name: string; // Connection identifier
  retryLimit: number;       // Max retry attempts
  retryDelay: number;       // Seconds between retries
  expireInSeconds: number;  // Job expiration time
}
```

**Features:**
- Persistent storage survives restarts
- Atomic job claiming prevents duplicates
- Built-in retry with exponential backoff
- Job expiration for stuck tasks

### Job Dispatcher (`job-dispatcher.ts`)

Coordinates between queue, workers, and resolver.

```typescript
interface JobSubmission {
  type: string;           // Job type identifier
  prompt: string;         // Task description for LLM
  priority?: number;      // 0 = highest, default = 5
  dependencies?: string[];// Job IDs this depends on
  metadata?: object;      // Additional context
}
```

**Responsibilities:**
- Validate incoming job requests
- Assign unique job IDs
- Track job status transitions
- Emit lifecycle events

### Worker Pool (`worker-pool.ts`)

Manages a pool of Gemini-powered workers.

```typescript
interface WorkerPoolConfig {
  minWorkers: number;     // Minimum active workers
  maxWorkers: number;     // Maximum concurrent workers
  idleTimeout: number;    // Seconds before idle worker shutdown
  healthCheckInterval: number; // Seconds between health checks
}
```

**Features:**
- Dynamic scaling based on queue depth
- Worker health monitoring
- Automatic restart on failure
- Token usage tracking per worker

### Dependency Resolver (`dependency-resolver.ts`)

Builds and validates job dependency graphs.

```typescript
interface DependencyGraph {
  nodes: Map<string, JobNode>;
  edges: Map<string, string[]>; // jobId -> dependsOn[]
}
```

**Capabilities:**
- DAG construction from job submissions
- Cycle detection (prevents deadlocks)
- Topological sort for execution order
- Result aggregation from completed dependencies

---

## Job Lifecycle

```
┌──────────┐     ┌─────────┐     ┌──────────┐     ┌───────────┐
│ PENDING  │────▶│ QUEUED  │────▶│ RUNNING  │────▶│ COMPLETED │
└──────────┘     └─────────┘     └──────────┘     └───────────┘
                      │               │
                      │               ▼
                      │          ┌─────────┐
                      └─────────▶│ FAILED  │
                                 └─────────┘
                                      │
                                      ▼ (if retries remain)
                                 ┌─────────┐
                                 │ QUEUED  │
                                 └─────────┘
```

### States

| State | Description |
|-------|-------------|
| `PENDING` | Job submitted, dependencies not satisfied |
| `QUEUED` | Ready for execution, waiting for worker |
| `RUNNING` | Worker actively processing |
| `COMPLETED` | Successfully finished |
| `FAILED` | Error occurred, may retry |
| `CANCELLED` | Manually cancelled |
| `EXPIRED` | Exceeded time limit |

### Events

Jobs emit events throughout their lifecycle:

```typescript
type JobEvent = 
  | { type: 'job:created', jobId: string, payload: JobSubmission }
  | { type: 'job:queued', jobId: string }
  | { type: 'job:started', jobId: string, workerId: string }
  | { type: 'job:progress', jobId: string, progress: number }
  | { type: 'job:completed', jobId: string, result: any }
  | { type: 'job:failed', jobId: string, error: string }
  | { type: 'job:cancelled', jobId: string };
```

---

## Dependency Resolution

### DAG Structure

Jobs form a Directed Acyclic Graph (DAG):

```
     ┌─────┐
     │ Job │ (no dependencies)
     │  A  │
     └──┬──┘
        │
   ┌────┴────┐
   ▼         ▼
┌─────┐   ┌─────┐
│ Job │   │ Job │ (depend on A)
│  B  │   │  C  │
└──┬──┘   └──┬──┘
   │         │
   └────┬────┘
        ▼
     ┌─────┐
     │ Job │ (depends on B and C)
     │  D  │
     └─────┘
```

### Execution Order

The resolver uses topological sort to determine execution order:

1. Jobs with no dependencies execute first (in parallel)
2. When a job completes, dependents are checked
3. Dependents with all dependencies satisfied become queued
4. Process continues until all jobs complete

### Cycle Detection

Cycles cause deadlocks. The resolver detects and rejects cyclic dependencies:

```typescript
// This would be rejected:
Job A depends on Job C
Job B depends on Job A
Job C depends on Job B  // Creates cycle: A -> C -> B -> A
```

### Result Aggregation

Dependent jobs receive aggregated results from their dependencies:

```typescript
// Job D receives:
{
  dependencyResults: {
    'jobB': { output: '...', status: 'completed' },
    'jobC': { output: '...', status: 'completed' }
  }
}
```

---

## Priority Scheduling

### Priority Levels

| Priority | Name | Use Case |
|----------|------|----------|
| 0 | Critical | System health, urgent alerts |
| 1 | High | User-initiated actions |
| 2 | Normal | Standard tasks |
| 3 | Low | Background processing |
| 5 | Default | Unspecified priority |
| 10 | Bulk | Batch operations |

### Priority Behavior

- Lower numbers = higher priority
- Equal priority: FIFO ordering
- Priority affects queue position, not worker allocation
- High-priority jobs can preempt queued low-priority jobs

---

## API Reference

### Submit Single Job

```http
POST /api/jobs
Content-Type: application/json

{
  "type": "analyze",
  "prompt": "Analyze the performance of the login page",
  "priority": 2,
  "metadata": {
    "targetUrl": "/login"
  }
}
```

**Response:**
```json
{
  "jobId": "abc123",
  "status": "queued",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### Submit Workflow (Multiple Jobs)

```http
POST /api/jobs/workflow
Content-Type: application/json

{
  "name": "Full Analysis",
  "mode": "sequential",
  "jobs": [
    { "type": "fetch", "prompt": "Fetch page content" },
    { "type": "analyze", "prompt": "Analyze for issues" },
    { "type": "report", "prompt": "Generate report" }
  ]
}
```

### Get Job Status

```http
GET /api/jobs/:jobId
```

**Response:**
```json
{
  "jobId": "abc123",
  "type": "analyze",
  "status": "completed",
  "result": { ... },
  "tokenUsage": { "input": 1500, "output": 500 },
  "duration": 3400,
  "createdAt": "...",
  "completedAt": "..."
}
```

### Cancel Job

```http
DELETE /api/jobs/:jobId
```

### List Jobs

```http
GET /api/jobs?status=running&limit=20
```

---

## Configuration

### Environment Variables

```bash
# Worker pool sizing
JOB_WORKERS_MIN=2
JOB_WORKERS_MAX=10

# Queue settings
JOB_RETRY_LIMIT=3
JOB_RETRY_DELAY=60
JOB_EXPIRE_SECONDS=3600

# Health checks
JOB_HEALTH_CHECK_INTERVAL=30
```

### Runtime Configuration

```typescript
// In server initialization
const dispatcher = new JobDispatcher({
  queue: jobQueue,
  pool: workerPool,
  resolver: dependencyResolver,
  defaultPriority: 5,
  maxConcurrentJobs: 50
});
```

---

## Examples

### Example 1: Simple Parallel Jobs

```typescript
// Submit 3 independent jobs that run in parallel
const jobs = await Promise.all([
  dispatcher.submit({ type: 'fetch', prompt: 'Get page A' }),
  dispatcher.submit({ type: 'fetch', prompt: 'Get page B' }),
  dispatcher.submit({ type: 'fetch', prompt: 'Get page C' })
]);
```

### Example 2: Sequential Pipeline

```typescript
// Submit a workflow with sequential execution
const workflow = await dispatcher.submitWorkflow({
  name: 'Data Pipeline',
  mode: 'sequential',
  jobs: [
    { type: 'extract', prompt: 'Extract data from source' },
    { type: 'transform', prompt: 'Transform to target format' },
    { type: 'load', prompt: 'Load into database' }
  ]
});
```

### Example 3: Diamond Dependency

```typescript
// A -> (B, C parallel) -> D
const jobA = await dispatcher.submit({ type: 'start', prompt: 'Initialize' });

const [jobB, jobC] = await Promise.all([
  dispatcher.submit({ 
    type: 'process', 
    prompt: 'Process path 1',
    dependencies: [jobA.jobId]
  }),
  dispatcher.submit({ 
    type: 'process', 
    prompt: 'Process path 2',
    dependencies: [jobA.jobId]
  })
]);

const jobD = await dispatcher.submit({
  type: 'finalize',
  prompt: 'Combine results',
  dependencies: [jobB.jobId, jobC.jobId]
});
```

### Example 4: Priority Override

```typescript
// Urgent job jumps the queue
await dispatcher.submit({
  type: 'alert',
  prompt: 'Critical system notification',
  priority: 0  // Highest priority
});
```

---

## Monitoring

### Database Tables

| Table | Purpose |
|-------|---------|
| `agent_jobs` | Job metadata, status, dependencies |
| `job_results` | Outputs, token usage, timing |
| `agent_workers` | Worker health, heartbeats |

### Health Endpoints

```http
GET /api/jobs/health

{
  "queue": {
    "pending": 5,
    "running": 3,
    "completed24h": 150
  },
  "workers": {
    "active": 4,
    "idle": 1,
    "unhealthy": 0
  },
  "throughput": {
    "jobsPerMinute": 12.5,
    "avgDurationMs": 2300
  }
}
```

### Logging

Jobs emit structured logs:

```
[JobDispatcher] Job abc123 submitted (type=analyze, priority=2)
[WorkerPool] Worker w-001 claimed job abc123
[AgentWorker] Job abc123 started (tokens: 1500 in)
[AgentWorker] Job abc123 completed (tokens: 500 out, duration: 3400ms)
[DependencyResolver] Job def456 unblocked (all dependencies satisfied)
```

---

## Related Documentation

- [Agent Configuration](./agent-configuration.md)
- [Tool Protocol Reference](./tool-protocol.md)
- [Workflow Protocol](../v2-roadmap/WORKFLOW-PROTOCOL.md)
- [Database Schemas](../01-database-schemas.md)

---

## Troubleshooting

### Jobs stuck in PENDING
- Check dependency jobs are completed
- Verify no circular dependencies
- Inspect dependency resolver logs

### Workers not picking up jobs
- Check worker pool health endpoint
- Verify database connection
- Check for queue errors in logs

### High latency
- Increase worker pool max size
- Check Gemini API rate limits
- Review job complexity (token usage)

### Job failures
- Check job result for error details
- Review retry count and limits
- Verify required context is available
