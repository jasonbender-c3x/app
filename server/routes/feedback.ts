/**
 * Feedback API Routes
 * 
 * Handles storage and retrieval of user feedback on AI responses.
 * This is the backbone for the evolution system.
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { insertFeedbackSchema } from "@shared/schema";

const router = Router();

/**
 * POST /api/feedback
 * Submit feedback for an AI response
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = insertFeedbackSchema.parse(req.body);
    const newFeedback = await storage.createFeedback(validatedData);
    res.json({ success: true, feedback: newFeedback });
  } catch (error: any) {
    console.error("Error submitting feedback:", error);
    res.status(400).json({ 
      success: false, 
      error: error.message || "Failed to submit feedback" 
    });
  }
});

/**
 * GET /api/feedback
 * Get feedback entries (for analysis)
 * Query params:
 *   - limit: max entries to return (default 50)
 *   - status: 'all' | 'pending' | 'submitted' (default 'pending')
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const status = (req.query.status as 'all' | 'pending' | 'submitted') || 'pending';
    const feedbackEntries = await storage.getFeedback(limit, status);
    res.json({ success: true, feedback: feedbackEntries });
  } catch (error: any) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch feedback" 
    });
  }
});

/**
 * GET /api/feedback/stats
 * Get aggregated feedback statistics
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await storage.getFeedbackStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error("Error fetching feedback stats:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch stats" 
    });
  }
});

export default router;
