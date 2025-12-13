import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import {
  listDriveFiles,
  getDriveFile,
  getDriveFileContent,
  createDriveFile,
  updateDriveFile,
  deleteDriveFile,
  searchDriveFiles,
} from "../integrations/google-drive";

const router = Router();

router.get(
  "/files",
  asyncHandler(async (req, res) => {
    const query = req.query.q as string | undefined;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const files = await listDriveFiles(query, pageSize);
    res.json(files);
  })
);

router.get(
  "/files/:id",
  asyncHandler(async (req, res) => {
    const file = await getDriveFile(req.params.id);
    res.json(file);
  })
);

router.get(
  "/files/:id/content",
  asyncHandler(async (req, res) => {
    const content = await getDriveFileContent(req.params.id);
    res.json({ content });
  })
);

router.post(
  "/files",
  asyncHandler(async (req, res) => {
    const { name, content, mimeType } = req.body;
    if (!name || !content) {
      throw badRequest("Name and content are required");
    }
    const file = await createDriveFile(name, content, mimeType);
    res.json(file);
  })
);

router.put(
  "/files/:id",
  asyncHandler(async (req, res) => {
    const { content, mimeType } = req.body;
    if (!content) {
      throw badRequest("Content is required");
    }
    const file = await updateDriveFile(req.params.id, content, mimeType);
    res.json(file);
  })
);

router.delete(
  "/files/:id",
  asyncHandler(async (req, res) => {
    await deleteDriveFile(req.params.id);
    res.json({ success: true });
  })
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const searchTerm = req.query.q as string;
    if (!searchTerm) {
      throw badRequest("Search term is required");
    }
    const files = await searchDriveFiles(searchTerm);
    res.json(files);
  })
);

export default router;
