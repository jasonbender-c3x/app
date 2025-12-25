import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import { storage } from "../storage";
import { insertQueuedTaskSchema, TaskStatuses } from "@shared/schema";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, chatId, limit } = req.query;
    const tasks = await storage.getQueuedTasks({
      status: status as string | undefined,
      chatId: chatId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(tasks);
  })
);

router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const stats = await storage.getQueueStats();
    res.json(stats);
  })
);

router.get(
  "/next",
  asyncHandler(async (_req, res) => {
    const task = await storage.getNextPendingTask();
    res.json(task || null);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await storage.getQueuedTaskById(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(task);
  })
);

router.get(
  "/:id/children",
  asyncHandler(async (req, res) => {
    const children = await storage.getQueuedTasksByParentId(req.params.id);
    res.json(children);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parseResult = insertQueuedTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw badRequest(`Invalid task data: ${parseResult.error.message}`);
    }
    const task = await storage.createQueuedTask(parseResult.data);
    res.status(201).json(task);
  })
);

router.post(
  "/batch",
  asyncHandler(async (req, res) => {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      throw badRequest("Tasks must be an array");
    }
    
    const validatedTasks = tasks.map((t: unknown, i: number) => {
      const parseResult = insertQueuedTaskSchema.safeParse(t);
      if (!parseResult.success) {
        throw badRequest(`Invalid task at index ${i}: ${parseResult.error.message}`);
      }
      return parseResult.data;
    });
    
    const createdTasks = await storage.createQueuedTasks(validatedTasks);
    res.status(201).json(createdTasks);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await storage.getQueuedTaskById(id);
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    
    const updatedTask = await storage.updateQueuedTask(id, req.body);
    res.json(updatedTask);
  })
);

router.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const task = await storage.getQueuedTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    
    const updatedTask = await storage.updateQueuedTask(id, {
      status: TaskStatuses.RUNNING,
      startedAt: new Date(),
    });
    res.json(updatedTask);
  })
);

router.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { output } = req.body;
    const task = await storage.getQueuedTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    
    const startedAt = task.startedAt ? new Date(task.startedAt).getTime() : Date.now();
    const actualDuration = Math.round((Date.now() - startedAt) / 1000);
    
    const updatedTask = await storage.updateQueuedTask(id, {
      status: TaskStatuses.COMPLETED,
      output,
      completedAt: new Date(),
      actualDuration,
    });
    res.json(updatedTask);
  })
);

router.post(
  "/:id/fail",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { error } = req.body;
    const task = await storage.getQueuedTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    
    const retryCount = (task.retryCount || 0) + 1;
    const maxRetries = task.maxRetries || 3;
    
    const updatedTask = await storage.updateQueuedTask(id, {
      status: retryCount >= maxRetries ? TaskStatuses.FAILED : TaskStatuses.PENDING,
      error: error || "Unknown error",
      retryCount,
      completedAt: retryCount >= maxRetries ? new Date() : undefined,
    });
    res.json(updatedTask);
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const task = await storage.getQueuedTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    
    const updatedTask = await storage.updateQueuedTask(id, {
      status: TaskStatuses.CANCELLED,
      completedAt: new Date(),
    });
    res.json(updatedTask);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const task = await storage.getQueuedTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    
    await storage.deleteQueuedTask(id);
    res.json({ success: true });
  })
);

export default router;
