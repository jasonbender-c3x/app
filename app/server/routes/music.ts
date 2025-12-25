/**
 * Music Generation API Routes
 * 
 * Provides endpoints for AI music generation using Google's Lyria model.
 */

import { Router } from "express";
import { generateMusic, checkLyriaAvailability } from "../integrations/lyria";

const router = Router();

/**
 * POST /api/music/generate
 * Generate music from a text prompt
 */
router.post("/generate", async (req, res) => {
  try {
    const { prompt, negativePrompt, bpm, density, brightness, scale, mode } = req.body;
    
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const result = await generateMusic({
      prompt,
      negativePrompt,
      bpm: bpm ?? 120,
      density: density ?? 0.5,
      brightness: brightness ?? 0.5,
      scale: scale ?? "C_MAJOR",
      mode: mode ?? "QUALITY"
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      duration: result.duration,
      description: result.description,
      setupInstructions: result.error
    });
  } catch (error) {
    console.error("[Music API] Generation error:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to generate music" 
    });
  }
});

/**
 * GET /api/music/status
 * Check Lyria API availability
 */
router.get("/status", async (_req, res) => {
  try {
    const status = await checkLyriaAvailability();
    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      available: false, 
      message: error instanceof Error ? error.message : "Status check failed" 
    });
  }
});

export default router;
