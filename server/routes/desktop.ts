/**
 * Desktop Collaboration API Routes
 * 
 * Manages desktop collaboration sessions for AI Desktop Collaboration feature.
 * Sessions enable real-time screen sharing and input control between:
 * - Desktop Agent (running on user's computer)
 * - Browser Viewer (user monitoring)
 * - AI Vision (Gemini analyzing screen)
 */

import { Router } from "express";
import { desktopRelayService } from "../services/desktop-relay-service";
import crypto from "crypto";

const router = Router();

router.post("/sessions", async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString("hex");
    const sessionId = desktopRelayService.createSession(token);
    
    res.json({
      sessionId,
      token,
      agentUrl: `/ws/desktop/agent/${sessionId}`,
      browserUrl: `/ws/desktop/browser/${sessionId}`,
      agentCommand: `npx meowstik-agent --token ${token}`,
    });
  } catch (error) {
    console.error("[Desktop API] Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const sessions = desktopRelayService.getActiveSessions();
    res.json({ sessions });
  } catch (error) {
    console.error("[Desktop API] Error listing sessions:", error);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.get("/sessions/:sessionId", async (req, res) => {
  try {
    const session = desktopRelayService.getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    res.json({
      id: session.id,
      agentConnected: session.agentWs !== null,
      browserCount: session.browserWs.size,
      systemInfo: session.systemInfo,
      controlling: session.controlling,
      aiVisionEnabled: session.aiVisionEnabled,
      audioEnabled: session.audioEnabled,
      createdAt: session.createdAt,
    });
  } catch (error) {
    console.error("[Desktop API] Error getting session:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    desktopRelayService.destroySession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("[Desktop API] Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

router.post("/sessions/:sessionId/control", async (req, res) => {
  try {
    const { mode } = req.body;
    
    if (!["user", "ai", "shared"].includes(mode)) {
      return res.status(400).json({ error: "Invalid control mode" });
    }
    
    desktopRelayService.setControlMode(req.params.sessionId, mode);
    res.json({ success: true, mode });
  } catch (error) {
    console.error("[Desktop API] Error setting control mode:", error);
    res.status(500).json({ error: "Failed to set control mode" });
  }
});

router.post("/sessions/:sessionId/input", async (req, res) => {
  try {
    const { type, action, x, y, button, key, text, delta } = req.body;
    
    desktopRelayService.sendInputToAgent(req.params.sessionId, {
      type,
      action,
      x,
      y,
      button,
      key,
      text,
      delta,
      source: "ai",
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Desktop API] Error sending input:", error);
    res.status(500).json({ error: "Failed to send input" });
  }
});

export default router;
