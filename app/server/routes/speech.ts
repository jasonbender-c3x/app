import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";

const router = Router();

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const { speechService } = await import("../services/speech");
    res.json(speechService.getServiceStatus());
  })
);

router.post(
  "/transcribe",
  asyncHandler(async (req, res) => {
    const { speechService } = await import("../services/speech");
    const { audioBase64, mimeType, language } = req.body;
    if (!audioBase64 || !mimeType) {
      throw badRequest("audioBase64 and mimeType are required");
    }
    const result = await speechService.transcribe({
      audioBase64,
      mimeType,
      language,
    });
    res.json(result);
  })
);

router.post(
  "/tts",
  asyncHandler(async (req, res) => {
    const { generateMultiSpeakerAudio, getAvailableVoices } = await import("../integrations/expressive-tts");
    const { text, speakers, model } = req.body;
    
    if (!text) {
      throw badRequest("text is required");
    }
    
    if (!speakers || !Array.isArray(speakers) || speakers.length === 0) {
      throw badRequest("speakers array is required");
    }
    
    const result = await generateMultiSpeakerAudio({
      text,
      speakers,
      model: model || "flash"
    });
    
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    
    res.json(result);
  })
);

router.get(
  "/voices",
  asyncHandler(async (_req, res) => {
    const { getAvailableVoices } = await import("../integrations/expressive-tts");
    res.json({ voices: getAvailableVoices() });
  })
);

export default router;
