/**
 * =============================================================================
 * AGENT WORKER SERVICE
 * =============================================================================
 * 
 * Individual worker that connects to Gemini and executes jobs.
 * Features:
 * - Connects to Gemini 2.5 Flash/Pro for job execution
 * - Tool calling support
 * - Structured output handling
 * - Token usage tracking
 * - Health monitoring with heartbeat
 */

import { GoogleGenAI, Type } from "@google/genai";
import { db } from "../db";
import { agentWorkers, agentJobs, type AgentWorker, type AgentJob } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { JobPayload } from "./job-queue";

export interface WorkerConfig {
  name: string;
  model: "gemini-2.5-flash" | "gemini-2.5-pro";
  maxConcurrency: number;
  heartbeatIntervalMs: number;
}

export interface JobExecutionResult {
  output: unknown;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  name: "agent-worker",
  model: "gemini-2.5-flash",
  maxConcurrency: 1,
  heartbeatIntervalMs: 30000,
};

class AgentWorkerService {
  private workerId: string | null = null;
  private ai: GoogleGenAI | null = null;
  private config: WorkerConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    this.ai = new GoogleGenAI({ apiKey });

    const [worker] = await db.insert(agentWorkers).values({
      name: this.config.name,
      type: "gemini",
      status: "idle",
      maxConcurrency: this.config.maxConcurrency,
      activeJobs: 0,
    }).returning();

    this.workerId = worker.id;
    this.isRunning = true;
    this.startHeartbeat();

    console.log(`[AgentWorker] Initialized worker ${this.workerId} (${this.config.name})`);
    return this.workerId;
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.workerId) {
      await db.update(agentWorkers)
        .set({ status: "offline" })
        .where(eq(agentWorkers.id, this.workerId));
    }

    console.log(`[AgentWorker] Shutdown worker ${this.workerId}`);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (!this.workerId) return;
      
      try {
        await db.update(agentWorkers)
          .set({ lastHeartbeat: new Date() })
          .where(eq(agentWorkers.id, this.workerId));
      } catch (error) {
        console.error("[AgentWorker] Heartbeat failed:", error);
      }
    }, this.config.heartbeatIntervalMs);
  }

  async executeJob(job: AgentJob): Promise<JobExecutionResult> {
    if (!this.ai || !this.workerId) {
      return { output: null, error: "Worker not initialized" };
    }

    await db.update(agentWorkers)
      .set({ 
        status: "busy",
        currentJobId: job.id,
        activeJobs: sql`${agentWorkers.activeJobs} + 1`,
      })
      .where(eq(agentWorkers.id, this.workerId));

    await db.update(agentJobs)
      .set({ workerId: this.workerId })
      .where(eq(agentJobs.id, job.id));

    try {
      const payload = job.payload as JobPayload;
      let result: JobExecutionResult;

      switch (job.type) {
        case "prompt":
          result = await this.executePromptJob(payload);
          break;
        case "tool":
          result = await this.executeToolJob(payload);
          break;
        case "composite":
          result = await this.executeCompositeJob(job, payload);
          break;
        default:
          result = { output: null, error: `Unknown job type: ${job.type}` };
      }

      await db.update(agentWorkers)
        .set({
          status: "idle",
          currentJobId: null,
          activeJobs: sql`GREATEST(${agentWorkers.activeJobs} - 1, 0)`,
          totalJobsProcessed: sql`${agentWorkers.totalJobsProcessed} + 1`,
          totalTokensUsed: sql`${agentWorkers.totalTokensUsed} + ${(result.inputTokens ?? 0) + (result.outputTokens ?? 0)}`,
          consecutiveFailures: result.error ? sql`${agentWorkers.consecutiveFailures} + 1` : 0,
        })
        .where(eq(agentWorkers.id, this.workerId));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await db.update(agentWorkers)
        .set({
          status: "error",
          currentJobId: null,
          activeJobs: sql`GREATEST(${agentWorkers.activeJobs} - 1, 0)`,
          consecutiveFailures: sql`${agentWorkers.consecutiveFailures} + 1`,
        })
        .where(eq(agentWorkers.id, this.workerId));

      return { output: null, error: errorMessage };
    }
  }

  private async executePromptJob(payload: JobPayload): Promise<JobExecutionResult> {
    if (!payload.prompt) {
      return { output: null, error: "No prompt provided" };
    }

    const contents = [];
    if (payload.systemPrompt) {
      contents.push({ role: "user", parts: [{ text: `System: ${payload.systemPrompt}` }] });
    }
    contents.push({ role: "user", parts: [{ text: payload.prompt }] });

    const response = await this.ai!.models.generateContent({
      model: this.config.model,
      contents,
    });

    return {
      output: response.text,
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    };
  }

  private async executeToolJob(payload: JobPayload): Promise<JobExecutionResult> {
    if (!payload.toolName) {
      return { output: null, error: "No tool name provided" };
    }

    const toolPrompt = `Execute the following tool call and return the result as JSON:
Tool: ${payload.toolName}
Arguments: ${JSON.stringify(payload.toolArgs ?? {})}

Return a JSON object with the result.`;

    const response = await this.ai!.models.generateContent({
      model: this.config.model,
      contents: toolPrompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    let output: unknown;
    try {
      output = JSON.parse(response.text ?? "{}");
    } catch {
      output = response.text;
    }

    return {
      output,
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    };
  }

  private async executeCompositeJob(job: AgentJob, payload: JobPayload): Promise<JobExecutionResult> {
    const childJobs = await db.select()
      .from(agentJobs)
      .where(eq(agentJobs.parentJobId, job.id));

    const completedChildren = childJobs.filter(c => c.status === "completed");
    const failedChildren = childJobs.filter(c => c.status === "failed");

    if (failedChildren.length > 0) {
      return {
        output: null,
        error: `${failedChildren.length} child job(s) failed`,
      };
    }

    if (completedChildren.length < childJobs.length) {
      return {
        output: null,
        error: `Waiting for ${childJobs.length - completedChildren.length} child job(s)`,
      };
    }

    return {
      output: {
        message: "Composite job completed",
        childCount: childJobs.length,
        completedCount: completedChildren.length,
      },
    };
  }

  async getWorkerStatus(): Promise<AgentWorker | null> {
    if (!this.workerId) return null;
    
    const [worker] = await db.select()
      .from(agentWorkers)
      .where(eq(agentWorkers.id, this.workerId));
    
    return worker ?? null;
  }

  getWorkerId(): string | null {
    return this.workerId;
  }

  isActive(): boolean {
    return this.isRunning && this.workerId !== null;
  }
}

export function createAgentWorker(config?: Partial<WorkerConfig>): AgentWorkerService {
  return new AgentWorkerService(config);
}

export default AgentWorkerService;
