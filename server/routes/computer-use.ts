/**
 * Computer Use API Routes
 * 
 * Endpoints for AI-directed computer control:
 * - Vision analysis of screenshots
 * - Action planning and execution
 * - Element finding and interaction
 * - Progress assessment
 */

import { Router, Request, Response } from "express";
import { computerUseService, ComputerAction } from "../services/computer-use";
import { sendToExtension, getConnectedExtensions } from "./extension";

const router = Router();

/**
 * Analyze a screenshot using vision AI
 */
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { screenshot, context } = req.body;

    if (!screenshot) {
      return res.status(400).json({ error: "Screenshot required" });
    }

    const analysis = await computerUseService.analyzeScreen(screenshot, context);
    res.json(analysis);
  } catch (error: any) {
    console.error("[ComputerUse] Analyze error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Plan actions to achieve a goal
 */
router.post("/plan", async (req: Request, res: Response) => {
  try {
    const { goal, screenshot, url, title, elements } = req.body;

    if (!goal || !screenshot) {
      return res.status(400).json({ error: "Goal and screenshot required" });
    }

    const actions = await computerUseService.planActions(goal, {
      screenshot,
      url,
      title,
      elements
    });

    res.json({ actions });
  } catch (error: any) {
    console.error("[ComputerUse] Plan error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute an action via connected extension
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { action, connectionId } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action required" });
    }

    const connections = getConnectedExtensions();
    
    if (connections.length === 0) {
      return res.status(503).json({ 
        error: "No extension connected",
        hint: "Open the Meowstik browser extension and connect to the server"
      });
    }

    const targetConnection = connectionId || connections[0].id;
    
    const sent = sendToExtension(targetConnection, {
      type: "execute_command",
      command: action.type,
      params: action
    });

    if (!sent) {
      return res.status(503).json({ error: "Failed to send to extension" });
    }

    res.json({ 
      success: true, 
      message: "Action sent to extension",
      action 
    });
  } catch (error: any) {
    console.error("[ComputerUse] Execute error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find an element on screen by description
 */
router.post("/find-element", async (req: Request, res: Response) => {
  try {
    const { screenshot, description } = req.body;

    if (!screenshot || !description) {
      return res.status(400).json({ error: "Screenshot and description required" });
    }

    const result = await computerUseService.findElement(screenshot, description);
    res.json(result);
  } catch (error: any) {
    console.error("[ComputerUse] Find element error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Assess progress toward a goal
 */
router.post("/assess", async (req: Request, res: Response) => {
  try {
    const { goal, screenshot, actions } = req.body;

    if (!goal || !screenshot) {
      return res.status(400).json({ error: "Goal and screenshot required" });
    }

    const assessment = await computerUseService.assessProgress(
      goal,
      screenshot,
      actions || []
    );

    res.json(assessment);
  } catch (error: any) {
    console.error("[ComputerUse] Assess error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get action history
 */
router.get("/history", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const actions = computerUseService.getRecentActions(limit);
  res.json({ actions });
});

/**
 * Clear action history
 */
router.delete("/history", (req: Request, res: Response) => {
  computerUseService.clearHistory();
  res.json({ success: true });
});

/**
 * Run a complete task with visual feedback loop
 */
router.post("/run-task", async (req: Request, res: Response) => {
  try {
    const { goal, maxSteps = 10 } = req.body;

    if (!goal) {
      return res.status(400).json({ error: "Goal required" });
    }

    const connections = getConnectedExtensions();
    if (connections.length === 0) {
      return res.status(503).json({ 
        error: "No extension connected",
        hint: "Open the Meowstik browser extension and connect to the server"
      });
    }

    res.json({
      started: true,
      goal,
      maxSteps,
      message: "Task started - use WebSocket for real-time updates",
      connectionId: connections[0].id
    });
  } catch (error: any) {
    console.error("[ComputerUse] Run task error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
