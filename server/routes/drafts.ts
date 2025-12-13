import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import { storage } from "../storage";
import { ragService } from "../services/rag-service";

const router = Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { chatId, textContent, voiceTranscript } = req.body;
    if (!chatId) {
      throw badRequest("chatId is required");
    }
    const draft = await storage.createDraft({
      chatId,
      textContent,
      voiceTranscript,
      status: "active",
    });
    res.json(draft);
  })
);

router.get(
  "/:chatId/active",
  asyncHandler(async (req, res) => {
    const draft = await storage.getActiveDraftByChat(req.params.chatId);
    res.json(draft || null);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const draft = await storage.updateDraft(req.params.id, req.body);
    res.json(draft);
  })
);

export const attachmentsRouter = Router();

attachmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const attachment = await storage.createAttachment(req.body);
    if (attachment.type === "file" && attachment.content) {
      ragService.processAttachment(attachment).catch((error) => {
        console.error(
          `[RAG] Failed to process attachment ${attachment.id}:`,
          error
        );
      });
    }
    res.json(attachment);
  })
);

attachmentsRouter.get(
  "/draft/:draftId",
  asyncHandler(async (req, res) => {
    const attachments = await storage.getAttachmentsByDraftId(
      req.params.draftId
    );
    res.json(attachments);
  })
);

attachmentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await storage.deleteAttachment(req.params.id);
    res.json({ success: true });
  })
);

export default router;
