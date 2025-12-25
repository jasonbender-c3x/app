import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  style?: "photorealistic" | "artistic" | "digital-art" | "anime" | "sketch" | "oil-painting" | "watercolor" | "3d-render";
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
  textResponse?: string;
}

export async function generateImage(options: ImageGenerationOptions): Promise<GeneratedImage> {
  const { prompt, negativePrompt, aspectRatio = "1:1", style } = options;

  let fullPrompt = prompt;
  
  if (style && style !== "photorealistic") {
    const stylePrompts: Record<string, string> = {
      "artistic": "in an artistic style",
      "digital-art": "as digital art",
      "anime": "in anime style",
      "sketch": "as a pencil sketch",
      "oil-painting": "as an oil painting",
      "watercolor": "as a watercolor painting",
      "3d-render": "as a 3D render",
    };
    fullPrompt = `${prompt}, ${stylePrompts[style] || ""}`;
  }

  if (negativePrompt) {
    fullPrompt = `${fullPrompt}. Avoid: ${negativePrompt}`;
  }

  const aspectRatioInstruction = aspectRatio !== "1:1" 
    ? `. Create the image with ${aspectRatio} aspect ratio.` 
    : "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [{ role: "user", parts: [{ text: fullPrompt + aspectRatioInstruction }] }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No response from image generation model");
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      throw new Error("Invalid response format");
    }

    let imageData: string | null = null;
    let mimeType: string = "image/png";
    let textResponse: string | undefined;

    for (const part of content.parts) {
      if (part.text) {
        textResponse = part.text;
      } else if (part.inlineData && part.inlineData.data) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
    }

    if (!imageData) {
      throw new Error("No image data in response");
    }

    return {
      base64: imageData,
      mimeType,
      textResponse,
    };
  } catch (error) {
    console.error("Image generation error:", error);
    
    // Log to error buffer
    const { logLLMError } = await import("../services/llm-error-buffer");
    logLLMError("image", "generateImage", error, {
      promptLength: prompt.length,
      style,
      aspectRatio
    }, {
      model: "gemini-2.0-flash-preview-image-generation"
    });
    
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function editImageWithPrompt(
  imageBase64: string,
  mimeType: string,
  editPrompt: string
): Promise<GeneratedImage> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType,
              },
            },
            { text: editPrompt },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No response from image edit model");
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      throw new Error("Invalid response format");
    }

    let imageData: string | null = null;
    let resultMimeType: string = "image/png";
    let textResponse: string | undefined;

    for (const part of content.parts) {
      if (part.text) {
        textResponse = part.text;
      } else if (part.inlineData && part.inlineData.data) {
        imageData = part.inlineData.data;
        resultMimeType = part.inlineData.mimeType || "image/png";
      }
    }

    if (!imageData) {
      throw new Error("No image data in response");
    }

    return {
      base64: imageData,
      mimeType: resultMimeType,
      textResponse,
    };
  } catch (error) {
    console.error("Image edit error:", error);
    
    // Log to error buffer
    const { logLLMError } = await import("../services/llm-error-buffer");
    logLLMError("image", "editImageWithPrompt", error, {
      promptLength: editPrompt.length,
      imageMimeType: mimeType
    }, {
      model: "gemini-2.0-flash-preview-image-generation"
    });
    
    throw new Error(`Failed to edit image: ${error instanceof Error ? error.message : String(error)}`);
  }
}
