/**
 * =============================================================================
 * ORCHESTRATION API ROUTES
 * =============================================================================
 * 
 * API endpoints for the workflow orchestration system:
 * - Executor control (start/stop/pause)
 * - Schedule management (CRUD + cron)
 * - Trigger management (CRUD + webhooks)
 * - Workflow management
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { workflowExecutor } from "../services/workflow-executor";
import { cronScheduler } from "../services/cron-scheduler";
import { triggerService } from "../services/trigger-service";
import { insertScheduleSchema, insertTriggerSchema, insertWorkflowSchema } from "@shared/schema";

const router = Router();

// ============================================================================
// EXECUTOR CONTROL
// ============================================================================

router.get("/executor/status", async (req: Request, res: Response) => {
  try {
    const status = await workflowExecutor.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get executor status" });
  }
});

router.post("/executor/start", async (req: Request, res: Response) => {
  try {
    await workflowExecutor.start();
    await cronScheduler.start();
    await triggerService.start();
    const status = await workflowExecutor.getStatus();
    res.json({ message: "Executor started", status });
  } catch (error) {
    res.status(500).json({ error: "Failed to start executor" });
  }
});

router.post("/executor/stop", async (req: Request, res: Response) => {
  try {
    await workflowExecutor.stop();
    await cronScheduler.stop();
    await triggerService.stop();
    const status = await workflowExecutor.getStatus();
    res.json({ message: "Executor stopped", status });
  } catch (error) {
    res.status(500).json({ error: "Failed to stop executor" });
  }
});

router.post("/executor/pause", async (req: Request, res: Response) => {
  try {
    await workflowExecutor.pause();
    const status = await workflowExecutor.getStatus();
    res.json({ message: "Executor paused", status });
  } catch (error) {
    res.status(500).json({ error: "Failed to pause executor" });
  }
});

router.post("/executor/resume", async (req: Request, res: Response) => {
  try {
    await workflowExecutor.resume();
    const status = await workflowExecutor.getStatus();
    res.json({ message: "Executor resumed", status });
  } catch (error) {
    res.status(500).json({ error: "Failed to resume executor" });
  }
});

// ============================================================================
// TASK CONTROL
// ============================================================================

router.post("/tasks/:id/input", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { input } = req.body;
    
    if (!input) {
      return res.status(400).json({ error: "Input is required" });
    }
    
    await workflowExecutor.provideOperatorInput(id, input);
    res.json({ message: "Input provided" });
  } catch (error) {
    res.status(500).json({ error: "Failed to provide input" });
  }
});

router.post("/tasks/:id/interrupt", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await workflowExecutor.interruptTask(id);
    res.json({ message: "Task interrupted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to interrupt task" });
  }
});

router.post("/tasks/:id/prioritize", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await workflowExecutor.prioritizeTask(id);
    res.json({ message: "Task prioritized" });
  } catch (error) {
    res.status(500).json({ error: "Failed to prioritize task" });
  }
});

router.get("/tasks/waiting", async (req: Request, res: Response) => {
  try {
    const tasks = await storage.getTasksWaitingForInput();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to get waiting tasks" });
  }
});

// ============================================================================
// SCHEDULES
// ============================================================================

router.get("/schedules", async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled === "true" ? true : 
                    req.query.enabled === "false" ? false : undefined;
    const schedules = await storage.getSchedules({ enabled });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: "Failed to get schedules" });
  }
});

router.get("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const schedule = await storage.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to get schedule" });
  }
});

router.post("/schedules", async (req: Request, res: Response) => {
  try {
    const validation = cronScheduler.isValidCronExpression(req.body.cronExpression);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const nextRunAt = cronScheduler.getNextRunTime(req.body.cronExpression);
    const schedule = await storage.createSchedule({
      ...req.body,
      nextRunAt
    });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

router.put("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (req.body.cronExpression) {
      const validation = cronScheduler.isValidCronExpression(req.body.cronExpression);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      req.body.nextRunAt = cronScheduler.getNextRunTime(req.body.cronExpression);
    }
    
    const schedule = await storage.updateSchedule(id, req.body);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

router.delete("/schedules/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteSchedule(req.params.id);
    res.json({ message: "Schedule deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

router.post("/schedules/:id/run", async (req: Request, res: Response) => {
  try {
    const schedule = await storage.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    
    // Manually trigger the schedule by creating its task
    const template = schedule.taskTemplate as {
      title: string;
      description?: string;
      taskType: string;
      priority?: number;
    };
    
    const task = await storage.createQueuedTask({
      title: template.title,
      description: template.description || null,
      taskType: template.taskType || "action",
      priority: template.priority || 5,
      input: { manualRun: true, scheduleName: schedule.name }
    });
    
    res.json({ message: "Schedule run initiated", taskId: task.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to run schedule" });
  }
});

router.get("/schedules/cron/describe", async (req: Request, res: Response) => {
  try {
    const expression = req.query.expression as string;
    if (!expression) {
      return res.status(400).json({ error: "Expression is required" });
    }
    
    const validation = cronScheduler.isValidCronExpression(expression);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const description = cronScheduler.describeCronExpression(expression);
    const nextRun = cronScheduler.getNextRunTime(expression);
    
    res.json({ expression, description, nextRun });
  } catch (error) {
    res.status(500).json({ error: "Failed to describe cron expression" });
  }
});

// ============================================================================
// TRIGGERS
// ============================================================================

router.get("/triggers", async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled === "true" ? true : 
                    req.query.enabled === "false" ? false : undefined;
    const triggerType = req.query.type as string | undefined;
    const triggers = await storage.getTriggers({ enabled, triggerType });
    res.json(triggers);
  } catch (error) {
    res.status(500).json({ error: "Failed to get triggers" });
  }
});

router.get("/triggers/:id", async (req: Request, res: Response) => {
  try {
    const trigger = await storage.getTriggerById(req.params.id);
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    res.json(trigger);
  } catch (error) {
    res.status(500).json({ error: "Failed to get trigger" });
  }
});

router.post("/triggers", async (req: Request, res: Response) => {
  try {
    const trigger = await storage.createTrigger(req.body);
    res.status(201).json(trigger);
  } catch (error) {
    res.status(500).json({ error: "Failed to create trigger" });
  }
});

router.put("/triggers/:id", async (req: Request, res: Response) => {
  try {
    const trigger = await storage.updateTrigger(req.params.id, req.body);
    res.json(trigger);
  } catch (error) {
    res.status(500).json({ error: "Failed to update trigger" });
  }
});

router.delete("/triggers/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteTrigger(req.params.id);
    res.json({ message: "Trigger deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete trigger" });
  }
});

router.post("/triggers/:id/fire", async (req: Request, res: Response) => {
  try {
    const result = await triggerService.manualTrigger(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ message: "Trigger fired", taskId: result.taskId });
  } catch (error) {
    res.status(500).json({ error: "Failed to fire trigger" });
  }
});

// Webhook endpoint for external triggers
router.post("/webhook/:triggerId", async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;
    const secret = req.headers["x-webhook-secret"] as string | undefined;
    
    const result = await triggerService.handleWebhook(triggerId, req.body, secret);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ message: "Webhook processed", taskId: result.taskId });
  } catch (error) {
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// ============================================================================
// WORKFLOWS
// ============================================================================

router.get("/workflows", async (req: Request, res: Response) => {
  try {
    const enabled = req.query.enabled === "true" ? true : 
                    req.query.enabled === "false" ? false : undefined;
    const workflows = await storage.getWorkflows({ enabled });
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: "Failed to get workflows" });
  }
});

router.get("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const workflow = await storage.getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to get workflow" });
  }
});

router.post("/workflows", async (req: Request, res: Response) => {
  try {
    const workflow = await storage.createWorkflow(req.body);
    res.status(201).json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.put("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const workflow = await storage.updateWorkflow(req.params.id, req.body);
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.delete("/workflows/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteWorkflow(req.params.id);
    res.json({ message: "Workflow deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

// Instantiate workflow - create tasks from workflow steps
router.post("/workflows/:id/run", async (req: Request, res: Response) => {
  try {
    const workflow = await storage.getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    const steps = workflow.steps as Array<{
      title: string;
      description?: string;
      taskType: string;
      priority?: number;
    }>;
    
    const tasks = await storage.createQueuedTasks(
      steps.map((step, idx) => ({
        title: step.title,
        description: step.description || null,
        taskType: step.taskType || "action",
        priority: step.priority ?? (steps.length - idx),
        input: req.body.input || null,
        workflowId: workflow.id
      }))
    );
    
    res.json({ message: "Workflow started", taskCount: tasks.length, tasks });
  } catch (error) {
    res.status(500).json({ error: "Failed to run workflow" });
  }
});

export default router;
