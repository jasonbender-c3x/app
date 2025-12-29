import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import {
  getSpreadsheet,
  getSheetValues,
  updateSheetValues,
  appendSheetValues,
  createSpreadsheet,
  listSpreadsheets,
  clearSheetRange,
} from "../integrations/google-sheets";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const sheets = await listSpreadsheets();
    res.json(sheets);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sheet = await getSpreadsheet(req.params.id);
    res.json(sheet);
  })
);

router.get(
  "/:id/values",
  asyncHandler(async (req, res) => {
    const range = (req.query.range as string) || "Sheet1";
    const values = await getSheetValues(req.params.id, range);
    res.json(values);
  })
);

router.put(
  "/:id/values",
  asyncHandler(async (req, res) => {
    const { range, values } = req.body;
    if (!range || !values) {
      throw badRequest("Range and values are required");
    }
    const result = await updateSheetValues(req.params.id, range, values);
    res.json(result);
  })
);

router.post(
  "/:id/values",
  asyncHandler(async (req, res) => {
    const { range, values } = req.body;
    if (!range || !values) {
      throw badRequest("Range and values are required");
    }
    const result = await appendSheetValues(req.params.id, range, values);
    res.json(result);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, sheetTitles } = req.body;
    if (!title) {
      throw badRequest("Title is required");
    }
    const sheet = await createSpreadsheet(title, sheetTitles);
    res.json(sheet);
  })
);

router.delete(
  "/:id/values",
  asyncHandler(async (req, res) => {
    const range = req.query.range as string;
    if (!range) {
      throw badRequest("Range is required");
    }
    const result = await clearSheetRange(req.params.id, range);
    res.json(result);
  })
);

export default router;
