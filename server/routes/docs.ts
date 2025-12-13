import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import {
  getDocument,
  getDocumentText,
  createDocument,
  appendText,
  replaceText,
  listDocuments,
} from "../integrations/google-docs";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const docs = await listDocuments();
    res.json(docs);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const doc = await getDocument(req.params.id);
    res.json(doc);
  })
);

router.get(
  "/:id/text",
  asyncHandler(async (req, res) => {
    const doc = await getDocumentText(req.params.id);
    res.json(doc);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title } = req.body;
    if (!title) {
      throw badRequest("Title is required");
    }
    const doc = await createDocument(title);
    res.json(doc);
  })
);

router.post(
  "/:id/append",
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text) {
      throw badRequest("Text is required");
    }
    const result = await appendText(req.params.id, text);
    res.json(result);
  })
);

router.post(
  "/:id/replace",
  asyncHandler(async (req, res) => {
    const { oldText, newText } = req.body;
    if (!oldText || newText === undefined) {
      throw badRequest("oldText and newText are required");
    }
    const result = await replaceText(req.params.id, oldText, newText);
    res.json(result);
  })
);

export default router;
