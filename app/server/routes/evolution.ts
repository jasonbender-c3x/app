/**
 * Evolution Engine API Routes
 * 
 * Provides endpoints for analyzing feedback and generating evolution PRs.
 */

import { Router, Request, Response } from "express";
import {
  analyzeFeedbackPatterns,
  generateEvolutionReport,
  createEvolutionPR,
  EvolutionReport,
  scanMessagesForFeedback
} from "../services/evolution-engine";
import * as github from "../integrations/github";
import { storage } from "../storage";

const router = Router();

let cachedReport: EvolutionReport | null = null;

/**
 * GET /api/evolution/analyze
 * Analyze feedback patterns and generate improvement suggestions
 */
router.get("/analyze", async (req: Request, res: Response) => {
  try {
    const report = await generateEvolutionReport();
    cachedReport = report;
    res.json({ success: true, report });
  } catch (error: any) {
    console.error("Error analyzing feedback:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze feedback"
    });
  }
});

/**
 * GET /api/evolution/patterns
 * Get just the feedback patterns without full suggestions
 */
router.get("/patterns", async (req: Request, res: Response) => {
  try {
    const patterns = await analyzeFeedbackPatterns();
    res.json({ success: true, patterns });
  } catch (error: any) {
    console.error("Error getting patterns:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get patterns"
    });
  }
});

/**
 * GET /api/evolution/repos
 * List user's GitHub repositories for PR target selection
 */
router.get("/repos", async (req: Request, res: Response) => {
  try {
    const repos = await github.listUserRepos(30, 1, "updated");
    res.json({ success: true, repos });
  } catch (error: any) {
    console.error("Error listing repos:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to list repositories"
    });
  }
});

/**
 * POST /api/evolution/create-pr
 * Create a GitHub PR with evolution suggestions
 */
router.post("/create-pr", async (req: Request, res: Response) => {
  try {
    const { owner, repo, reportId } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        success: false,
        error: "Missing owner or repo"
      });
    }

    let report = cachedReport;
    if (!report || (reportId && report.id !== reportId)) {
      report = await generateEvolutionReport();
      cachedReport = report;
    }

    if (report.suggestions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No improvement suggestions to create PR from. Collect more feedback first."
      });
    }

    const result = await createEvolutionPR(report, { owner, repo });
    
    if (result.success) {
      res.json({
        success: true,
        prUrl: result.prUrl,
        prNumber: result.prNumber
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error("Error creating PR:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create PR"
    });
  }
});

/**
 * GET /api/evolution/report
 * Get the cached evolution report if available
 */
router.get("/report", async (req: Request, res: Response) => {
  if (cachedReport) {
    res.json({ success: true, report: cachedReport });
  } else {
    res.json({ success: true, report: null, message: "No report cached. Run /analyze first." });
  }
});

/**
 * POST /api/evolution/scan-messages
 * Scan the last 10 messages for embedded feedback and create PRs
 */
router.post("/scan-messages", async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        success: false,
        error: "Missing owner or repo"
      });
    }

    // Get the last 10 user messages from the database
    const messages = await storage.getRecentUserMessages(10);
    
    if (messages.length === 0) {
      return res.json({
        success: true,
        messagesScanned: 0,
        feedbackFound: [],
        message: "No messages found to scan"
      });
    }

    // Use AI to analyze messages for feedback
    const result = await scanMessagesForFeedback(messages, { owner, repo });
    
    res.json(result);
  } catch (error: any) {
    console.error("Error scanning messages:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to scan messages"
    });
  }
});

/**
 * POST /api/evolution/create-feedback-pr
 * Create a GitHub PR from selected feedback IDs
 */
router.post("/create-feedback-pr", async (req: Request, res: Response) => {
  try {
    const { owner, repo, feedbackIds } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        success: false,
        error: "Missing owner or repo"
      });
    }

    if (!feedbackIds || !Array.isArray(feedbackIds) || feedbackIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No feedback items selected"
      });
    }

    // Fetch the selected feedback items
    const allFeedback = await storage.getFeedback(100);
    const selectedFeedback = allFeedback.filter(f => feedbackIds.includes(f.id));

    if (selectedFeedback.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid feedback items found"
      });
    }

    // Create markdown content for the PR
    const branchName = `feedback-${Date.now()}`;
    const timestamp = new Date().toISOString().split('T')[0];
    
    let prBody = `# User Feedback Report\n\n`;
    prBody += `**Date:** ${timestamp}\n`;
    prBody += `**Feedback Items:** ${selectedFeedback.length}\n\n`;
    prBody += `---\n\n`;

    for (const item of selectedFeedback) {
      const rating = item.rating || "neutral";
      const emoji = rating === "positive" ? "👍" : "👎";
      prBody += `## ${emoji} ${rating.charAt(0).toUpperCase() + rating.slice(1)} Feedback\n\n`;
      if (item.freeformText) {
        prBody += `> ${item.freeformText}\n\n`;
      }
      prBody += `*Submitted: ${new Date(item.createdAt).toLocaleDateString()}*\n\n`;
      prBody += `---\n\n`;
    }

    // Create the PR using GitHub integration
    try {
      // Get default branch
      const defaultBranch = await github.getDefaultBranch(owner, repo);

      // Create a new branch (this internally gets the base SHA)
      await github.createBranch(owner, repo, branchName, defaultBranch);

      // Create or update the feedback file
      const filePath = `docs/feedback/${timestamp}-feedback.md`;
      await github.createOrUpdateFile(
        owner,
        repo,
        filePath,
        prBody,
        `Add user feedback report - ${timestamp}`,
        branchName
      );

      // Create the pull request
      // Signature: createPullRequest(owner, repo, title, body, head, base?, draft?)
      const pr = await github.createPullRequest(
        owner,
        repo,
        `User Feedback Report - ${timestamp}`,
        prBody,
        branchName,
        defaultBranch
      );

      // Mark feedback as submitted so it doesn't show up in pending list
      const feedbackIdsToMark = selectedFeedback.map(f => f.id);
      await storage.markFeedbackSubmitted(feedbackIdsToMark);

      res.json({
        success: true,
        prUrl: pr.htmlUrl,
        prNumber: pr.number
      });
    } catch (gitError: any) {
      console.error("GitHub error:", gitError);
      res.status(500).json({
        success: false,
        error: gitError.message || "Failed to create GitHub PR"
      });
    }
  } catch (error: any) {
    console.error("Error creating feedback PR:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create feedback PR"
    });
  }
});

export default router;
