import { Router } from "express";
import { generateImage, editImageWithPrompt, type ImageGenerationOptions } from "../integrations/image-generation";

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    const { prompt, negativePrompt, aspectRatio, style } = req.body as ImageGenerationOptions;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const result = await generateImage({
      prompt,
      negativePrompt,
      aspectRatio,
      style,
    });

    res.json({
      success: true,
      image: {
        base64: result.base64,
        mimeType: result.mimeType,
        dataUrl: `data:${result.mimeType};base64,${result.base64}`,
      },
      textResponse: result.textResponse,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate image",
    });
  }
});

router.post("/edit", async (req, res) => {
  try {
    const { imageBase64, mimeType, editPrompt } = req.body;

    if (!imageBase64 || !editPrompt) {
      return res.status(400).json({ error: "Image data and edit prompt are required" });
    }

    const result = await editImageWithPrompt(
      imageBase64,
      mimeType || "image/png",
      editPrompt
    );

    res.json({
      success: true,
      image: {
        base64: result.base64,
        mimeType: result.mimeType,
        dataUrl: `data:${result.mimeType};base64,${result.base64}`,
      },
      textResponse: result.textResponse,
    });
  } catch (error) {
    console.error("Image edit error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to edit image",
    });
  }
});

router.get("/styles", (req, res) => {
  res.json([
    { value: "photorealistic", label: "Photorealistic" },
    { value: "artistic", label: "Artistic" },
    { value: "digital-art", label: "Digital Art" },
    { value: "anime", label: "Anime" },
    { value: "sketch", label: "Sketch" },
    { value: "oil-painting", label: "Oil Painting" },
    { value: "watercolor", label: "Watercolor" },
    { value: "3d-render", label: "3D Render" },
  ]);
});

router.get("/aspect-ratios", (req, res) => {
  res.json([
    { value: "1:1", label: "Square (1:1)", width: 1024, height: 1024 },
    { value: "16:9", label: "Landscape (16:9)", width: 1792, height: 1024 },
    { value: "9:16", label: "Portrait (9:16)", width: 1024, height: 1792 },
    { value: "4:3", label: "Standard (4:3)", width: 1365, height: 1024 },
    { value: "3:4", label: "Tall (3:4)", width: 1024, height: 1365 },
  ]);
});

export default router;
