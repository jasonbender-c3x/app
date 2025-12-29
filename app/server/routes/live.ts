import { Router } from "express";
import * as geminiLive from "../integrations/gemini-live";

const router = Router();

router.post("/session", async (req, res) => {
  try {
    const { sessionId, voiceName, systemInstruction } = req.body;

    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "sessionId is required" });
    }

    const result = await geminiLive.createLiveSession(sessionId, {
      voiceName,
      systemInstruction,
    });

    res.json(result);
  } catch (error) {
    console.error("[Live] Error creating session:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create live session",
    });
  }
});

router.delete("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await geminiLive.closeLiveSession(sessionId);

    res.json(result);
  } catch (error) {
    console.error("[Live] Error closing session:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to close live session",
    });
  }
});

router.get("/voices", async (_req, res) => {
  try {
    res.json({ voices: geminiLive.AVAILABLE_VOICES });
  } catch (error) {
    console.error("[Live] Error getting voices:", error);
    res.status(500).json({ error: "Failed to get available voices" });
  }
});

export default router;
