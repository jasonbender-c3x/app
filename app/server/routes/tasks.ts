import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import {
  listTaskLists,
  getTaskList,
  createTaskList,
  deleteTaskList,
  listTasks,
  getTask,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  clearCompletedTasks,
} from "../integrations/google-tasks";

const router = Router();

router.get(
  "/lists",
  asyncHandler(async (_req, res) => {
    const lists = await listTaskLists();
    res.json(lists);
  })
);

router.get(
  "/lists/:id",
  asyncHandler(async (req, res) => {
    const list = await getTaskList(req.params.id);
    res.json(list);
  })
);

router.post(
  "/lists",
  asyncHandler(async (req, res) => {
    const { title } = req.body;
    if (!title) {
      throw badRequest("Title is required");
    }
    const list = await createTaskList(title);
    res.json(list);
  })
);

router.delete(
  "/lists/:id",
  asyncHandler(async (req, res) => {
    await deleteTaskList(req.params.id);
    res.json({ success: true });
  })
);

router.get(
  "/lists/:listId/tasks",
  asyncHandler(async (req, res) => {
    const showCompleted = req.query.showCompleted !== "false";
    const tasks = await listTasks(req.params.listId, showCompleted);
    res.json(tasks);
  })
);

router.get(
  "/lists/:listId/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const task = await getTask(req.params.listId, req.params.taskId);
    res.json(task);
  })
);

router.post(
  "/lists/:listId/tasks",
  asyncHandler(async (req, res) => {
    const { title, notes, due } = req.body;
    if (!title) {
      throw badRequest("Title is required");
    }
    const task = await createTask(req.params.listId, title, notes, due);
    res.json(task);
  })
);

router.patch(
  "/lists/:listId/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const { title, notes, due, status } = req.body;
    const task = await updateTask(req.params.listId, req.params.taskId, {
      title,
      notes,
      due,
      status,
    });
    res.json(task);
  })
);

router.post(
  "/lists/:listId/tasks/:taskId/complete",
  asyncHandler(async (req, res) => {
    const task = await completeTask(req.params.listId, req.params.taskId);
    res.json(task);
  })
);

router.delete(
  "/lists/:listId/tasks/:taskId",
  asyncHandler(async (req, res) => {
    await deleteTask(req.params.listId, req.params.taskId);
    res.json({ success: true });
  })
);

router.post(
  "/lists/:listId/clear",
  asyncHandler(async (req, res) => {
    await clearCompletedTasks(req.params.listId);
    res.json({ success: true });
  })
);

export default router;
