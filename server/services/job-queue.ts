/**
 * =============================================================================
 * JOB QUEUE SERVICE
 * =============================================================================
 * 
 * PostgreSQL-backed job queue using pg-boss for reliable, durable job processing.
 * Features:
 * - Priority-based job scheduling (0 = highest priority)
 * - Automatic retries with exponential backoff
 * - Job expiration and timeout handling
 * - Concurrent worker processing
 * - DAG-based dependency resolution
 */

import PgBoss from "pg-boss";
import { getDb } from "../db";
import { 
  agentJobs, 
  jobResults,
  agentWorkers,
  type AgentJob, 
  type InsertAgentJob,
  type JobResult,
  type InsertJobResult 
} from "@shared/schema";
import { eq, and, inArray, isNull, or, sql, asc, desc } from "drizzle-orm";

export type JobType = "prompt" | "tool" | "composite" | "workflow";
export type JobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
export type ExecutionMode = "sequential" | "parallel" | "batch";

export interface JobPayload {
  prompt?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  systemPrompt?: string;
  context?: Record<string, unknown>;
  childJobs?: InsertAgentJob[];
}

export interface JobSubmission {
  name: string;
  type: JobType;
  payload: JobPayload;
  priority?: number;
  parentJobId?: string;
  dependencies?: string[];
  executionMode?: ExecutionMode;
  maxRetries?: number;
  timeout?: number;
  scheduledFor?: Date;
  cronExpression?: string;
  userId?: string;
}

export interface JobQueueConfig {
  concurrency: number;
  pollInterval: number;
  retryLimit: number;
  retryDelay: number;
  expireInHours: number;
}

const DEFAULT_CONFIG: JobQueueConfig = {
  concurrency: 3,
  pollInterval: 2000,
  retryLimit: 3,
  retryDelay: 30000,
  expireInHours: 24,
};

// Event types for job lifecycle
export type JobEvent = {
  type: "started" | "completed" | "failed" | "cancelled" | "retry" | "waiting_input" | "resumed";
  jobId: string;
  job?: AgentJob;
  result?: JobResult;
  error?: string;
};

type JobEventCallback = (event: JobEvent) => void;

class JobQueueService {
  private boss: PgBoss | null = null;
  private config: JobQueueConfig;
  private isInitialized = false;
  private processingCallbacks: Map<string, (job: AgentJob) => Promise<{ output: unknown; error?: string }>> = new Map();
  private eventCallbacks: JobEventCallback[] = [];

  constructor(config: Partial<JobQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Subscribe to job lifecycle events
   */
  onJobEvent(callback: JobEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
    };
  }

  private emitEvent(event: JobEvent): void {
    this.eventCallbacks.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.error("[JobQueue] Event callback error:", error);
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL not configured");
    }

    this.boss = new PgBoss({
      connectionString,
      retryLimit: this.config.retryLimit,
      retryDelay: this.config.retryDelay,
      expireInHours: this.config.expireInHours,
    });

    this.boss.on("error", (error) => {
      console.error("[JobQueue] pg-boss error:", error);
    });

    await this.boss.start();
    this.isInitialized = true;
    console.log("[JobQueue] Initialized with pg-boss");
  }

  async stop(): Promise<void> {
    if (this.boss) {
      await this.boss.stop();
      this.isInitialized = false;
      console.log("[JobQueue] Stopped");
    }
  }

  async submitJob(submission: JobSubmission): Promise<AgentJob> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const jobData: InsertAgentJob = {
      name: submission.name,
      type: submission.type,
      priority: submission.priority ?? 5,
      parentJobId: submission.parentJobId,
      dependencies: submission.dependencies ?? [],
      executionMode: submission.executionMode ?? "sequential",
      payload: submission.payload as any,
      status: "pending",
      maxRetries: submission.maxRetries ?? this.config.retryLimit,
      timeout: submission.timeout ?? 300000,
      scheduledFor: submission.scheduledFor,
      cronExpression: submission.cronExpression,
      userId: submission.userId,
    };

    const [job] = await getDb().insert(agentJobs).values(jobData).returning();

    // Check if dependencies are met before enqueuing
    const depsReady = await this.areDependenciesMet(job.dependencies ?? []);
    if (depsReady) {
      await this.enqueueJob(job);
    }

    console.log(`[JobQueue] Submitted job ${job.id}: ${job.name} (type: ${job.type}, priority: ${job.priority})`);
    return job;
  }

  async submitBatch(submissions: JobSubmission[]): Promise<AgentJob[]> {
    const jobs: AgentJob[] = [];
    for (const submission of submissions) {
      const job = await this.submitJob(submission);
      jobs.push(job);
    }
    return jobs;
  }

  private async enqueueJob(job: AgentJob): Promise<void> {
    if (!this.boss) return;

    const queueName = this.getQueueName(job.type, job.priority);
    
    await getDb().update(agentJobs)
      .set({ status: "queued" })
      .where(eq(agentJobs.id, job.id));

    await this.boss.send(queueName, { jobId: job.id }, {
      priority: 10 - (job.priority ?? 5),
      retryLimit: job.maxRetries ?? this.config.retryLimit,
      expireInSeconds: Math.floor((job.timeout ?? 300000) / 1000),
    });
  }

  private getQueueName(type: string, priority?: number | null): string {
    const pri = priority ?? 5;
    if (pri <= 2) return `agent-jobs-high`;
    if (pri <= 5) return `agent-jobs-normal`;
    return `agent-jobs-low`;
  }

  async registerProcessor(
    type: JobType,
    callback: (job: AgentJob) => Promise<{ output: unknown; error?: string }>
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.processingCallbacks.set(type, callback);
    
    for (const queueName of ["agent-jobs-high", "agent-jobs-normal", "agent-jobs-low"]) {
      await this.boss?.work(queueName, { batchSize: this.config.concurrency }, async (pgJobs) => {
        for (const pgJob of pgJobs) {
          const { jobId } = pgJob.data as { jobId: string };
          await this.processJob(jobId);
        }
      });
    }
  }

  private async processJob(jobId: string): Promise<void> {
    const startTime = Date.now();

    const [job] = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));

    if (!job) {
      console.error(`[JobQueue] Job ${jobId} not found`);
      return;
    }

    await getDb().update(agentJobs)
      .set({ 
        status: "running", 
        startedAt: new Date() 
      })
      .where(eq(agentJobs.id, jobId));

    console.log(`[JobQueue] Processing job ${jobId}: ${job.name}`);
    
    // Emit started event
    this.emitEvent({ type: "started", jobId, job });

    try {
      const callback = this.processingCallbacks.get(job.type);
      if (!callback) {
        throw new Error(`No processor registered for job type: ${job.type}`);
      }

      const result = await callback(job);
      const durationMs = Date.now() - startTime;

      const resultData: InsertJobResult = {
        jobId: job.id,
        success: !result.error,
        output: result.output as any,
        error: result.error,
        durationMs,
      };

      await getDb().insert(jobResults).values(resultData);

      await getDb().update(agentJobs)
        .set({ 
          status: result.error ? "failed" : "completed",
          completedAt: new Date(),
        })
        .where(eq(agentJobs.id, jobId));

      console.log(`[JobQueue] Job ${jobId} ${result.error ? "failed" : "completed"} in ${durationMs}ms`);

      // Emit completion or failure event
      if (result.error) {
        this.emitEvent({ type: "failed", jobId, job, error: result.error });
      } else {
        const savedResult = await this.getJobResult(jobId);
        this.emitEvent({ type: "completed", jobId, job, result: savedResult ?? undefined });
      }

      await this.checkDependentJobs(jobId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[JobQueue] Job ${jobId} error:`, errorMessage);

      const currentRetryCount = (job.retryCount ?? 0) + 1;
      if (currentRetryCount < (job.maxRetries ?? 3)) {
        await getDb().update(agentJobs)
          .set({ 
            status: "pending",
            retryCount: currentRetryCount,
          })
          .where(eq(agentJobs.id, jobId));
        
        // Emit retry event
        this.emitEvent({ type: "retry", jobId, job, error: errorMessage });
      } else {
        await getDb().insert(jobResults).values({
          jobId: job.id,
          success: false,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });

        await getDb().update(agentJobs)
          .set({ 
            status: "failed",
            completedAt: new Date(),
          })
          .where(eq(agentJobs.id, jobId));
        
        // Emit failure event
        this.emitEvent({ type: "failed", jobId, job, error: errorMessage });
      }
    }
  }

  private async areDependenciesMet(dependencies: string[]): Promise<boolean> {
    if (!dependencies || dependencies.length === 0) return true;

    const [depJobs] = await getDb().select()
      .from(agentJobs)
      .where(inArray(agentJobs.id, dependencies));

    if (!depJobs) return dependencies.length === 0;

    const deps = await getDb().select()
      .from(agentJobs)
      .where(inArray(agentJobs.id, dependencies));

    return deps.every(d => d.status === "completed");
  }

  private async checkDependentJobs(completedJobId: string): Promise<void> {
    const pendingJobs = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.status, "pending"));

    for (const job of pendingJobs) {
      const deps = job.dependencies ?? [];
      if (deps.includes(completedJobId)) {
        if (await this.areDependenciesMet(deps)) {
          await this.enqueueJob(job);
        }
      }
    }
  }

  async getJob(jobId: string): Promise<AgentJob | null> {
    const [job] = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));
    return job ?? null;
  }

  async getJobResult(jobId: string): Promise<JobResult | null> {
    const [result] = await getDb().select()
      .from(jobResults)
      .where(eq(jobResults.jobId, jobId));
    return result ?? null;
  }

  async getJobsByStatus(status: JobStatus): Promise<AgentJob[]> {
    return getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.status, status))
      .orderBy(asc(agentJobs.priority), asc(agentJobs.createdAt));
  }

  async getJobsByParent(parentJobId: string): Promise<AgentJob[]> {
    return getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.parentJobId, parentJobId))
      .orderBy(asc(agentJobs.createdAt));
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const [job] = await getDb().update(agentJobs)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(and(
        eq(agentJobs.id, jobId),
        or(eq(agentJobs.status, "pending"), eq(agentJobs.status, "queued"))
      ))
      .returning();

    if (job) {
      // Emit cancelled event
      this.emitEvent({ type: "cancelled", jobId, job });
    }

    return !!job;
  }

  /**
   * Resume a paused/waiting job with new input
   */
  async resumeJob(jobId: string, operatorInput?: string): Promise<boolean> {
    const [job] = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));

    if (!job) return false;

    // Update job payload with new input - merge operator input directly into context
    const currentPayload = (job.payload as Record<string, unknown>) || {};
    const currentContext = (currentPayload.context as Record<string, unknown>) || {};
    const newPayload = operatorInput !== undefined
      ? { 
          ...currentPayload, 
          context: {
            ...currentContext,
            operatorInput,
          }
        }
      : currentPayload;

    await getDb().update(agentJobs)
      .set({ 
        payload: newPayload as any,
        status: "pending",
      })
      .where(eq(agentJobs.id, jobId));

    // Get updated job and re-enqueue it
    const [updatedJob] = await getDb().select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));

    if (updatedJob) {
      await this.enqueueJob(updatedJob);
      // Emit resumed event
      this.emitEvent({ type: "resumed", jobId, job: updatedJob });
    }

    return true;
  }

  /**
   * Mark a job as waiting for operator input
   */
  async markWaitingForInput(jobId: string): Promise<boolean> {
    const [job] = await getDb().update(agentJobs)
      .set({ status: "pending" }) // Keep as pending but not queued
      .where(eq(agentJobs.id, jobId))
      .returning();

    if (job) {
      // Emit waiting_input event
      this.emitEvent({ type: "waiting_input", jobId, job });
    }

    return !!job;
  }

  async getQueueStats(): Promise<{
    pending: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const stats = await getDb().select({
      status: agentJobs.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentJobs)
    .groupBy(agentJobs.status);

    const result = {
      pending: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const stat of stats) {
      if (stat.status in result) {
        result[stat.status as keyof typeof result] = stat.count;
      }
    }

    return result;
  }

  async purgeCompletedJobs(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const deleted = await getDb().delete(agentJobs)
      .where(and(
        or(eq(agentJobs.status, "completed"), eq(agentJobs.status, "failed"), eq(agentJobs.status, "cancelled")),
        sql`${agentJobs.completedAt} < ${cutoff}`
      ))
      .returning();

    return deleted.length;
  }
}

export const jobQueue = new JobQueueService();
export default jobQueue;
