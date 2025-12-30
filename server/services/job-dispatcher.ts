/**
 * =============================================================================
 * JOB DISPATCHER SERVICE
 * =============================================================================
 * 
 * Routes jobs to workers based on priority, dependencies, and execution mode.
 * Coordinates between JobQueue, WorkerPool, and DependencyResolver.
 */

import { jobQueue, type JobSubmission } from "./job-queue";
import { workerPool } from "./worker-pool";
import { dependencyResolver } from "./dependency-resolver";
import { getDb } from "../db";
import { agentJobs, jobResults, type AgentJob } from "@shared/schema";
import { eq, and, inArray, asc } from "drizzle-orm";

export interface DispatchResult {
  jobId: string;
  status: "dispatched" | "queued" | "blocked" | "failed";
  workerId?: string;
  error?: string;
}

class JobDispatcherService {
  private isRunning = false;
  private dispatchInterval: NodeJS.Timeout | null = null;
  private dispatchIntervalMs = 2000;

  async start(): Promise<void> {
    if (this.isRunning) return;

    await jobQueue.initialize();
    await workerPool.initialize();

    this.isRunning = true;
    this.startDispatchLoop();

    console.log("[JobDispatcher] Started");
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.dispatchInterval) {
      clearInterval(this.dispatchInterval);
      this.dispatchInterval = null;
    }

    await workerPool.shutdown();
    await jobQueue.stop();

    console.log("[JobDispatcher] Stopped");
  }

  private startDispatchLoop(): void {
    this.dispatchInterval = setInterval(async () => {
      try {
        await this.dispatchReadyJobs();
      } catch (error) {
        console.error("[JobDispatcher] Dispatch loop error:", error);
      }
    }, this.dispatchIntervalMs);
  }

  private async dispatchReadyJobs(): Promise<void> {
    const resolution = await dependencyResolver.resolve();

    for (const failedDep of resolution.failedDeps) {
      await getDb().update(agentJobs)
        .set({ 
          status: "failed",
          completedAt: new Date(),
        })
        .where(eq(agentJobs.id, failedDep.jobId));
      
      console.warn(`[JobDispatcher] Job ${failedDep.jobId} failed due to failed dependencies: ${failedDep.failedDependencies.join(", ")}`);
    }

    const sortedJobs = resolution.readyJobs.sort((a, b) => {
      const priA = a.priority ?? 5;
      const priB = b.priority ?? 5;
      if (priA !== priB) return priA - priB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    for (const job of sortedJobs) {
      const worker = await workerPool.getIdleWorker();
      
      if (!worker) {
        const canScale = await workerPool.scaleUp();
        if (!canScale) {
          break;
        }
        continue;
      }

      try {
        await getDb().update(agentJobs)
          .set({ status: "running", startedAt: new Date() })
          .where(eq(agentJobs.id, job.id));

        const startTime = Date.now();
        worker.executeJob(job).then(async (result) => {
          const { output, error, inputTokens, outputTokens } = result;
          const durationMs = Date.now() - startTime;
          
          await getDb().insert(jobResults).values({
            jobId: job.id,
            success: !error,
            output: output as any,
            error,
            inputTokens,
            outputTokens,
            durationMs,
          });

          await getDb().update(agentJobs)
            .set({
              status: error ? "failed" : "completed",
              completedAt: new Date(),
            })
            .where(eq(agentJobs.id, job.id));

          console.log(`[JobDispatcher] Job ${job.id} ${error ? "failed" : "completed"}`);
        }).catch(async (err) => {
          console.error(`[JobDispatcher] Job ${job.id} execution error:`, err);
          
          await getDb().update(agentJobs)
            .set({ status: "failed", completedAt: new Date() })
            .where(eq(agentJobs.id, job.id));
        });

      } catch (error) {
        console.error(`[JobDispatcher] Failed to dispatch job ${job.id}:`, error);
      }
    }
  }

  async submitJob(submission: JobSubmission): Promise<AgentJob> {
    if (!this.isRunning) {
      await this.start();
    }
    return jobQueue.submitJob(submission);
  }

  async submitWorkflow(
    name: string,
    steps: JobSubmission[],
    mode: "sequential" | "parallel" = "sequential"
  ): Promise<AgentJob> {
    const parentJob = await jobQueue.submitJob({
      name,
      type: "composite",
      payload: { childJobs: steps as any },
      executionMode: mode,
    });

    let previousJobId: string | undefined;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      const childSubmission: JobSubmission = {
        ...step,
        parentJobId: parentJob.id,
        dependencies: mode === "sequential" && previousJobId 
          ? [previousJobId] 
          : [],
      };

      const childJob = await jobQueue.submitJob(childSubmission);
      previousJobId = childJob.id;
    }

    return parentJob;
  }

  async getJobStatus(jobId: string): Promise<{
    job: AgentJob | null;
    result: any;
    children: AgentJob[];
  }> {
    const job = await jobQueue.getJob(jobId);
    const result = await jobQueue.getJobResult(jobId);
    
    let children: AgentJob[] = [];
    if (job) {
      children = await getDb().select()
        .from(agentJobs)
        .where(eq(agentJobs.parentJobId, jobId))
        .orderBy(asc(agentJobs.createdAt));
    }

    return { job, result, children };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return jobQueue.cancelJob(jobId);
  }

  async getDispatcherStats(): Promise<{
    queueStats: Awaited<ReturnType<typeof jobQueue.getQueueStats>>;
    poolStats: Awaited<ReturnType<typeof workerPool.getPoolStats>>;
    isRunning: boolean;
  }> {
    return {
      queueStats: await jobQueue.getQueueStats(),
      poolStats: await workerPool.getPoolStats(),
      isRunning: this.isRunning,
    };
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const jobDispatcher = new JobDispatcherService();
export default jobDispatcher;
