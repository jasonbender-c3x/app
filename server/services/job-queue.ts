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
import { db } from "../db";
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

class JobQueueService {
  private boss: PgBoss | null = null;
  private config: JobQueueConfig;
  private isInitialized = false;
  private processingCallbacks: Map<string, (job: AgentJob) => Promise<{ output: unknown; error?: string }>> = new Map();

  constructor(config: Partial<JobQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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

    const [job] = await db.insert(agentJobs).values(jobData).returning();

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
    
    await db.update(agentJobs)
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
      await this.boss?.work(queueName, { teamConcurrency: this.config.concurrency }, async (pgJob) => {
        const { jobId } = pgJob.data as { jobId: string };
        await this.processJob(jobId);
      });
    }
  }

  private async processJob(jobId: string): Promise<void> {
    const startTime = Date.now();

    const [job] = await db.select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));

    if (!job) {
      console.error(`[JobQueue] Job ${jobId} not found`);
      return;
    }

    await db.update(agentJobs)
      .set({ 
        status: "running", 
        startedAt: new Date() 
      })
      .where(eq(agentJobs.id, jobId));

    console.log(`[JobQueue] Processing job ${jobId}: ${job.name}`);

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

      await db.insert(jobResults).values(resultData);

      await db.update(agentJobs)
        .set({ 
          status: result.error ? "failed" : "completed",
          completedAt: new Date(),
        })
        .where(eq(agentJobs.id, jobId));

      console.log(`[JobQueue] Job ${jobId} ${result.error ? "failed" : "completed"} in ${durationMs}ms`);

      await this.checkDependentJobs(jobId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[JobQueue] Job ${jobId} error:`, errorMessage);

      const currentRetryCount = (job.retryCount ?? 0) + 1;
      if (currentRetryCount < (job.maxRetries ?? 3)) {
        await db.update(agentJobs)
          .set({ 
            status: "pending",
            retryCount: currentRetryCount,
          })
          .where(eq(agentJobs.id, jobId));
      } else {
        await db.insert(jobResults).values({
          jobId: job.id,
          success: false,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });

        await db.update(agentJobs)
          .set({ 
            status: "failed",
            completedAt: new Date(),
          })
          .where(eq(agentJobs.id, jobId));
      }
    }
  }

  private async areDependenciesMet(dependencies: string[]): Promise<boolean> {
    if (!dependencies || dependencies.length === 0) return true;

    const [depJobs] = await db.select()
      .from(agentJobs)
      .where(inArray(agentJobs.id, dependencies));

    if (!depJobs) return dependencies.length === 0;

    const deps = await db.select()
      .from(agentJobs)
      .where(inArray(agentJobs.id, dependencies));

    return deps.every(d => d.status === "completed");
  }

  private async checkDependentJobs(completedJobId: string): Promise<void> {
    const pendingJobs = await db.select()
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
    const [job] = await db.select()
      .from(agentJobs)
      .where(eq(agentJobs.id, jobId));
    return job ?? null;
  }

  async getJobResult(jobId: string): Promise<JobResult | null> {
    const [result] = await db.select()
      .from(jobResults)
      .where(eq(jobResults.jobId, jobId));
    return result ?? null;
  }

  async getJobsByStatus(status: JobStatus): Promise<AgentJob[]> {
    return db.select()
      .from(agentJobs)
      .where(eq(agentJobs.status, status))
      .orderBy(asc(agentJobs.priority), asc(agentJobs.createdAt));
  }

  async getJobsByParent(parentJobId: string): Promise<AgentJob[]> {
    return db.select()
      .from(agentJobs)
      .where(eq(agentJobs.parentJobId, parentJobId))
      .orderBy(asc(agentJobs.createdAt));
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const [job] = await db.update(agentJobs)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(and(
        eq(agentJobs.id, jobId),
        or(eq(agentJobs.status, "pending"), eq(agentJobs.status, "queued"))
      ))
      .returning();

    return !!job;
  }

  async getQueueStats(): Promise<{
    pending: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const stats = await db.select({
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
    
    const deleted = await db.delete(agentJobs)
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
