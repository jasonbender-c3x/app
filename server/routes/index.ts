import { Router } from "express";
import driveRouter from "./drive";
import gmailRouter from "./gmail";
import calendarRouter from "./calendar";
import docsRouter from "./docs";
import sheetsRouter from "./sheets";
import tasksRouter from "./tasks";
import speechRouter from "./speech";
import draftsRouter, { attachmentsRouter } from "./drafts";
import authRouter from "./auth";
import terminalRouter from "./terminal";
import musicRouter from "./music";
import imageRouter from "./image";
import pythonRouter from "./python";
import playwrightRouter from "./playwright";
import webScraperRouter from "./web-scraper";
import knowledgeIngestionRouter from "./knowledge-ingestion";
import statusRouter from "./status";
import feedbackRouter from "./feedback";
import { errorHandler } from "./middleware";

export function createApiRouter(): Router {
  const router = Router();

  router.use("/auth", authRouter);
  router.use("/drive", driveRouter);
  router.use("/gmail", gmailRouter);
  router.use("/calendar", calendarRouter);
  router.use("/docs", docsRouter);
  router.use("/sheets", sheetsRouter);
  router.use("/tasks", tasksRouter);
  router.use("/speech", speechRouter);
  router.use("/drafts", draftsRouter);
  router.use("/attachments", attachmentsRouter);
  router.use("/terminal", terminalRouter);
  router.use("/music", musicRouter);
  router.use("/image", imageRouter);
  router.use("/python", pythonRouter);
  router.use("/playwright", playwrightRouter);
  router.use("/web", webScraperRouter);
  router.use("/knowledge", knowledgeIngestionRouter);
  router.use("/status", statusRouter);
  router.use("/feedback", feedbackRouter);

  router.use(errorHandler);

  return router;
}

export { errorHandler };
