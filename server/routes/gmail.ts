import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import {
  listEmails,
  getEmail,
  sendEmail,
  getLabels,
  searchEmails,
} from "../integrations/gmail";

const router = Router();

router.get(
  "/messages",
  asyncHandler(async (req, res) => {
    const maxResults = parseInt(req.query.maxResults as string) || 20;
    const emails = await listEmails(maxResults);
    res.json(emails);
  })
);

router.get(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const email = await getEmail(req.params.id);
    res.json(email);
  })
);

router.post(
  "/messages",
  asyncHandler(async (req, res) => {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
      throw badRequest("To, subject, and body are required");
    }
    const result = await sendEmail(to, subject, body);
    res.json(result);
  })
);

router.get(
  "/labels",
  asyncHandler(async (_req, res) => {
    const labels = await getLabels();
    res.json(labels);
  })
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      throw badRequest("Search query is required");
    }
    const emails = await searchEmails(query);
    res.json(emails);
  })
);

export default router;
