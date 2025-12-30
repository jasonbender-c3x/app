/**
 * Collaborative Editing API Routes
 * 
 * Manages collaborative editing sessions for real-time code editing.
 */

import { Router } from "express";
import { db } from "../db";
import { collaborativeSessions, sessionParticipants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getActiveSessions } from "../websocket-collab";

const router = Router();

/**
 * POST /api/collab/sessions
 * Create a new collaborative editing session
 */
router.post("/sessions", async (req, res) => {
  try {
    const { filePath, title } = req.body;

    const [session] = await db.insert(collaborativeSessions).values({
      id: randomUUID(),
      creatorUserId: null,
      title: title || "Untitled Session",
      currentFilePath: filePath || null,
      isActive: true,
    }).returning();

    res.json({
      sessionId: session.id,
      title: session.title,
      filePath: session.currentFilePath,
    });
  } catch (error) {
    console.error("Error creating collaborative session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

/**
 * GET /api/collab/sessions
 * List active collaborative sessions
 */
router.get("/sessions", async (_req, res) => {
  try {
    const sessions = await db.select().from(collaborativeSessions).where(eq(collaborativeSessions.isActive, true));
    const activeSessions = getActiveSessions();

    const result = sessions.map(session => {
      const activeInfo = activeSessions.find(s => s.id === session.id);
      return {
        id: session.id,
        title: session.title,
        filePath: session.currentFilePath,
        participantCount: activeInfo?.participantCount || 0,
        createdAt: session.createdAt,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error listing sessions:", error);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

/**
 * GET /api/collab/sessions/:sessionId
 * Get details about a specific session
 */
router.get("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [session] = await db.select().from(collaborativeSessions).where(eq(collaborativeSessions.id, sessionId));
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const participants = await db.select().from(sessionParticipants).where(eq(sessionParticipants.sessionId, sessionId));

    res.json({
      id: session.id,
      title: session.title,
      filePath: session.currentFilePath,
      isActive: session.isActive,
      createdAt: session.createdAt,
      participants: participants.map(p => ({
        id: p.id,
        displayName: p.displayName,
        avatarColor: p.avatarColor,
        participantType: p.participantType,
        isActive: p.isActive,
        joinedAt: p.joinedAt,
      })),
    });
  } catch (error) {
    console.error("Error getting session:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

/**
 * POST /api/collab/sessions/:sessionId/join
 * Join an existing session (pre-check before WebSocket connection)
 */
router.post("/sessions/:sessionId/join", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [session] = await db.select().from(collaborativeSessions).where(eq(collaborativeSessions.id, sessionId));
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!session.isActive) {
      return res.status(400).json({ error: "Session is no longer active" });
    }

    res.json({
      canJoin: true,
      sessionId: session.id,
      title: session.title,
    });
  } catch (error) {
    console.error("Error joining session:", error);
    res.status(500).json({ error: "Failed to join session" });
  }
});

/**
 * DELETE /api/collab/sessions/:sessionId
 * End a collaborative session
 */
router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    await db.update(collaborativeSessions)
      .set({ isActive: false, endedAt: new Date() })
      .where(eq(collaborativeSessions.id, sessionId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error ending session:", error);
    res.status(500).json({ error: "Failed to end session" });
  }
});

export default router;
