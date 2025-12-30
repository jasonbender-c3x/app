/**
 * =============================================================================
 * JOB ORCHESTRATION API ROUTES
 * =============================================================================
 * 
 * REST API for job submission, status tracking, and worker management.
 */

import { Router } from "express";
import { jobDispatcher } from "../services/job-dispatcher";
import { jobQueue } from "../services/job-queue";
import { dependencyResolver } from "../services/dependency-resolver";
import { getDb } from "../db";
import { agentJobs, jobResults, agentWorkers } from "@shared/schema";
import { eq, desc, asc, inArray, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const jobSubmissionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["prompt", "tool", "composite", "workflow"]),
  payload: z.object({
    prompt: z.string().optional(),
    toolName: z.string().optional(),
    toolArgs: z.record(z.unknown()).optional(),
    systemPrompt: z.string().optional(),
    context: z.record(z.unknown()).optional(),
  }),
  priority: z.number().min(0).max(10).optional(),
  parentJobId: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  executionMode: z.enum(["sequential", "parallel", "batch"]).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  timeout: z.number().min(1000).max(3600000).optional(),
  scheduledFor: z.string().datetime().optional(),
  cronExpression: z.string().optional(),
});

const workflowSubmissionSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(["sequential", "parallel"]).optional(),
  steps: z.array(jobSubmissionSchema),
});

router.post("/", async (req, res) => {
  try {
    const parsed = jobSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Invalid job submission", 
        details: parsed.error.errors 
      });
    }

    const submission = {
      ...parsed.data,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : undefined,
      userId: (req.user as any)?.id,
    };

    const job = await jobDispatcher.submitJob(submission);
    res.status(201).json(job);
  } catch (error) {
    console.error("[Jobs API] Submit error:", error);
    res.status(500).json({ error: "Failed to submit job" });
  }
});

router.post("/workflow", async (req, res) => {
  try {
    const parsed = workflowSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Invalid workflow submission", 
        details: parsed.error.errors 
      });
    }

    const { name, mode, steps } = parsed.data;
    const workflow = await jobDispatcher.submitWorkflow(
      name, 
      steps.map(s => ({
        ...s,
        scheduledFor: s.scheduledFor ? new Date(s.scheduledFor) : undefined,
        userId: (req.user as any)?.id,
      })), 
      mode
    );
    
    res.status(201).json(workflow);
  } catch (error) {
    console.error("[Jobs API] Workflow submit error:", error);
    res.status(500).json({ error: "Failed to submit workflow" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    
    let query = getDb().select().from(agentJobs);
    
    if (status && typeof status === "string") {
      query = query.where(eq(agentJobs.status, status)) as any;
    }

    const jobs = await query
      .orderBy(desc(agentJobs.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json(jobs);
  } catch (error) {
    console.error("[Jobs API] List error:", error);
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const stats = await jobDispatcher.getDispatcherStats();
    res.json(stats);
  } catch (error) {
    console.error("[Jobs API] Stats error:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { job, result, children } = await jobDispatcher.getJobStatus(id);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({ job, result, children });
  } catch (error) {
    console.error("[Jobs API] Get job error:", error);
    res.status(500).json({ error: "Failed to get job" });
  }
});

router.get("/:id/result", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await jobQueue.getJobResult(id);
    
    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("[Jobs API] Get result error:", error);
    res.status(500).json({ error: "Failed to get result" });
  }
});

router.get("/:id/dependencies", async (req, res) => {
  try {
    const { id } = req.params;
    const chain = await dependencyResolver.getDependencyChain(id);
    const dependents = await dependencyResolver.getDependents(id);
    
    res.json({ chain, dependents });
  } catch (error) {
    console.error("[Jobs API] Get dependencies error:", error);
    res.status(500).json({ error: "Failed to get dependencies" });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const cancelled = await jobDispatcher.cancelJob(id);
    
    if (!cancelled) {
      return res.status(400).json({ error: "Cannot cancel job (may be already running or completed)" });
    }

    res.json({ success: true, jobId: id });
  } catch (error) {
    console.error("[Jobs API] Cancel error:", error);
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

router.get("/workers/list", async (req, res) => {
  try {
    const workers = await getDb().select()
      .from(agentWorkers)
      .orderBy(desc(agentWorkers.lastHeartbeat));

    res.json(workers);
  } catch (error) {
    console.error("[Jobs API] List workers error:", error);
    res.status(500).json({ error: "Failed to list workers" });
  }
});

router.post("/dispatcher/start", async (req, res) => {
  try {
    await jobDispatcher.start();
    res.json({ success: true, message: "Dispatcher started" });
  } catch (error) {
    console.error("[Jobs API] Start dispatcher error:", error);
    res.status(500).json({ error: "Failed to start dispatcher" });
  }
});

router.post("/dispatcher/stop", async (req, res) => {
  try {
    await jobDispatcher.stop();
    res.json({ success: true, message: "Dispatcher stopped" });
  } catch (error) {
    console.error("[Jobs API] Stop dispatcher error:", error);
    res.status(500).json({ error: "Failed to stop dispatcher" });
  }
});

export default router;
