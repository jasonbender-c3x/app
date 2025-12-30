/**
 * =============================================================================
 * WORKFLOW EXECUTOR SERVICE (v2 - Job System Bridge)
 * =============================================================================
 * 
 * Bridge layer that connects the legacy workflow API to the new job orchestration
 * system. Maintains backward compatibility while leveraging:
 * - pg-boss for reliable, PostgreSQL-backed job queuing
 * - DAG-based dependency resolution
 * - Multi-worker parallel execution
 * - Priority scheduling
 */

import { jobDispatcher } from "./job-dispatcher";
import { jobQueue, type JobSubmission, type JobEvent } from "./job-queue";
import { workerPool } from "./worker-pool";
import { dependencyResolver } from "./dependency-resolver";
import { getDb } from "../db";
import { agentJobs, type AgentJob } from "@shared/schema";
import { eq } from "drizzle-orm";

// Legacy task types mapped to new job types
const TASK_TYPE_TO_JOB_TYPE: Record<string, "prompt" | "tool" | "composite" | "workflow"> = {
  research: "prompt",
  analysis: "prompt", 
  synthesis: "prompt",
  action: "tool",
  fetch: "tool",
  transform: "tool",
  validate: "tool",
  notify: "tool",
};

// Event callback type for backward compatibility
type TaskEventCallback = (event: TaskEvent) => void;

interface TaskEvent {
  type: "started" | "completed" | "failed" | "cancelled" | "waiting_input" | "resumed" | "spawned_subtasks";
  taskId: string;
  data?: unknown;
}

// Legacy task interface for backward compatibility
interface LegacyTask {
  id?: string;
  title: string;
  description?: string | null;
  taskType: string;
  input?: Record<string, unknown>;
  priority?: number;
  dependencies?: string[];
  parentId?: string;
  maxRetries?: number;
  condition?: string;
  workflowId?: string;
  scheduledBy?: string;
  scheduleName?: string;
}

class WorkflowExecutor {
  private isRunning = false;
  private isPaused = false;
  private eventCallbacks: TaskEventCallback[] = [];
  private unsubscribeFromJobEvents: (() => void) | null = null;

  constructor() {
    // Subscribe to job events to translate them to legacy task events
    this.subscribeToJobEvents();
  }

  /**
   * Subscribe to job queue events and translate them to legacy task events
   */
  private subscribeToJobEvents(): void {
    this.unsubscribeFromJobEvents = jobQueue.onJobEvent((event: JobEvent) => {
      // Translate job events to legacy task events
      switch (event.type) {
        case "started":
          this.emit({ type: "started", taskId: event.jobId });
          break;
        case "completed":
          this.emit({ type: "completed", taskId: event.jobId, data: event.result?.output });
          break;
        case "failed":
          this.emit({ type: "failed", taskId: event.jobId, data: event.error });
          break;
        case "cancelled":
          this.emit({ type: "cancelled", taskId: event.jobId, data: "Cancelled" });
          break;
        case "waiting_input":
          // Emit waiting_input for operator prompts
          this.emit({ type: "waiting_input", taskId: event.jobId });
          break;
        case "resumed":
          // Emit resumed when job continues after operator input
          this.emit({ type: "resumed", taskId: event.jobId });
          break;
        case "retry":
          // Could add a retry event type if needed
          break;
      }
    });
  }

  /**
   * Subscribe to task events (legacy compatibility)
   */
  onTaskEvent(callback: TaskEventCallback) {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
    };
  }

  private emit(event: TaskEvent) {
    this.eventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Start the executor - delegates to job dispatcher
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    await jobDispatcher.start();
    this.isRunning = true;
    this.isPaused = false;
    
    console.log("[WorkflowExecutor] Started (using job dispatcher)");
  }

  /**
   * Stop the executor
   */
  async stop(): Promise<void> {
    await jobDispatcher.stop();
    this.isRunning = false;
    
    console.log("[WorkflowExecutor] Stopped");
  }

  /**
   * Pause the executor
   */
  async pause(): Promise<void> {
    this.isPaused = true;
    console.log("[WorkflowExecutor] Paused");
  }

  /**
   * Resume the executor
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    console.log("[WorkflowExecutor] Resumed");
  }

  /**
   * Get current executor status
   */
  async getStatus(): Promise<{ 
    isRunning: boolean; 
    isPaused: boolean; 
    runningTaskCount: number;
    stats: {
      queueStats: {
        pending: number;
        queued: number;
        running: number;
        completed: number;
        failed: number;
      };
      poolStats: {
        activeWorkers: number;
        idleWorkers: number;
        busyWorkers: number;
        totalJobsProcessed: number;
        totalTokensUsed: number;
      };
      isRunning: boolean;
    };
  }> {
    const stats = await jobDispatcher.getDispatcherStats();
    
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      runningTaskCount: stats.queueStats.running,
      stats
    };
  }

  /**
   * Submit a legacy task - converts to new job format
   */
  async submitTask(task: LegacyTask): Promise<AgentJob> {
    const jobType = TASK_TYPE_TO_JOB_TYPE[task.taskType] || "prompt";
    
    const submission: JobSubmission = {
      name: task.title,
      type: jobType,
      payload: {
        prompt: task.description || task.title,
        context: {
          ...task.input,
          // Preserve legacy metadata
          legacyTaskType: task.taskType,
          workflowId: task.workflowId,
          scheduledBy: task.scheduledBy,
          scheduleName: task.scheduleName,
          condition: task.condition,
        },
        systemPrompt: this.getSystemPromptForType(task.taskType),
      },
      priority: task.priority ?? 5,
      dependencies: task.dependencies,
      parentJobId: task.parentId,
      maxRetries: task.maxRetries ?? 3,
    };

    const job = await jobDispatcher.submitJob(submission);
    
    return job;
  }

  /**
   * Submit multiple tasks as a workflow
   */
  async submitWorkflow(
    name: string, 
    tasks: LegacyTask[], 
    mode: "sequential" | "parallel" = "sequential"
  ): Promise<AgentJob> {
    const steps: JobSubmission[] = tasks.map(task => ({
      name: task.title,
      type: TASK_TYPE_TO_JOB_TYPE[task.taskType] || "prompt",
      payload: {
        prompt: task.description || task.title,
        context: {
          ...task.input,
          legacyTaskType: task.taskType,
          workflowId: task.workflowId,
          scheduledBy: task.scheduledBy,
          scheduleName: task.scheduleName,
        },
        systemPrompt: this.getSystemPromptForType(task.taskType),
      },
      priority: task.priority ?? 5,
      maxRetries: task.maxRetries ?? 3,
      executionMode: mode,
    }));

    return jobDispatcher.submitWorkflow(name, steps, mode);
  }

  /**
   * Get job status (legacy compatibility)
   */
  async getTaskStatus(taskId: string): Promise<{
    job: AgentJob | null;
    result: any;
    children: AgentJob[];
  }> {
    return jobDispatcher.getJobStatus(taskId);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const cancelled = await jobDispatcher.cancelJob(taskId);
    if (cancelled) {
      this.emit({ type: "failed", taskId, data: "Cancelled" });
    }
    return cancelled;
  }

  /**
   * Get task result
   */
  async getTaskResult(taskId: string): Promise<any> {
    return jobQueue.getJobResult(taskId);
  }

  /**
   * Interrupt/cancel a running task (legacy compatibility)
   */
  async interruptTask(taskId: string): Promise<void> {
    await this.cancelTask(taskId);
  }

  /**
   * Provide operator input for a waiting task (legacy compatibility)
   * Uses the jobQueue.resumeJob method to properly re-queue the job
   */
  async provideOperatorInput(taskId: string, input: string): Promise<void> {
    const resumed = await jobQueue.resumeJob(taskId, input);
    
    if (!resumed) {
      throw new Error("Task not found or could not be resumed");
    }
  }

  /**
   * Prioritize a task (bump to highest priority)
   */
  async prioritizeTask(taskId: string): Promise<void> {
    await getDb().update(agentJobs)
      .set({ priority: 0 }) // 0 = highest priority
      .where(eq(agentJobs.id, taskId));
  }

  /**
   * Get dependency chain for a task
   */
  async getDependencyChain(taskId: string): Promise<AgentJob[]> {
    return dependencyResolver.getDependencyChain(taskId);
  }

  /**
   * Get tasks that depend on a given task
   */
  async getDependents(taskId: string): Promise<AgentJob[]> {
    return dependencyResolver.getDependents(taskId);
  }

  /**
   * Register a custom task handler (legacy compatibility)
   * Maps to job queue processor registration
   */
  registerHandler(
    taskType: string, 
    handler: (job: AgentJob) => Promise<{ output: unknown; error?: string }>
  ): void {
    const jobType = TASK_TYPE_TO_JOB_TYPE[taskType] || "prompt";
    jobQueue.registerProcessor(jobType, handler);
  }

  /**
   * Get worker pool stats
   */
  async getWorkerStats(): Promise<{
    activeWorkers: number;
    idleWorkers: number;
    busyWorkers: number;
    totalJobsProcessed: number;
    totalTokensUsed: number;
  }> {
    return workerPool.getPoolStats();
  }

  /**
   * Scale up workers
   */
  async scaleUp(): Promise<string | null> {
    return workerPool.scaleUp();
  }

  /**
   * Scale down workers
   */
  async scaleDown(): Promise<boolean> {
    return workerPool.scaleDown();
  }

  private getSystemPromptForType(taskType: string): string {
    switch (taskType) {
      case "research":
        return "You are a research assistant. Provide comprehensive, well-researched information on the given topic.";
      case "analysis":
        return "You are an analyst. Analyze the given information and provide insights, patterns, and recommendations.";
      case "synthesis":
        return "You are a synthesizer. Combine multiple pieces of information into a cohesive, well-organized summary.";
      case "action":
        return "You are an action executor. Perform the requested action and report the results.";
      case "fetch":
        return "You are a data fetcher. Retrieve and structure the requested information.";
      case "transform":
        return "You are a data transformer. Process and transform the given data as requested.";
      case "validate":
        return "You are a validator. Check and verify the given information for accuracy and completeness.";
      case "notify":
        return "You are a notification handler. Format and prepare notification messages.";
      default:
        return "You are a helpful AI assistant. Complete the requested task.";
    }
  }
}

// Export singleton instance
export const workflowExecutor = new WorkflowExecutor();
