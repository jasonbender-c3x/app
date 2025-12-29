import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import {
  listCalendars,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../integrations/google-calendar";

const router = Router();

router.get(
  "/calendars",
  asyncHandler(async (_req, res) => {
    const calendars = await listCalendars();
    res.json(calendars);
  })
);

router.get(
  "/events",
  asyncHandler(async (req, res) => {
    const calendarId = (req.query.calendarId as string) || "primary";
    const timeMin = req.query.timeMin as string | undefined;
    const timeMax = req.query.timeMax as string | undefined;
    const maxResults = parseInt(req.query.maxResults as string) || 20;
    const events = await listEvents(calendarId, timeMin, timeMax, maxResults);
    res.json(events);
  })
);

router.get(
  "/events/:id",
  asyncHandler(async (req, res) => {
    const calendarId = (req.query.calendarId as string) || "primary";
    const event = await getEvent(calendarId, req.params.id);
    res.json(event);
  })
);

router.post(
  "/events",
  asyncHandler(async (req, res) => {
    const {
      calendarId = "primary",
      summary,
      start,
      end,
      description,
      location,
    } = req.body;
    if (!summary || !start || !end) {
      throw badRequest("Summary, start, and end are required");
    }
    const event = await createEvent(
      calendarId,
      summary,
      start,
      end,
      description,
      location
    );
    res.json(event);
  })
);

router.patch(
  "/events/:id",
  asyncHandler(async (req, res) => {
    const calendarId = (req.body.calendarId as string) || "primary";
    const { summary, description, location, start, end } = req.body;
    const event = await updateEvent(calendarId, req.params.id, {
      summary,
      description,
      location,
      start,
      end,
    });
    res.json(event);
  })
);

router.delete(
  "/events/:id",
  asyncHandler(async (req, res) => {
    const calendarId = (req.query.calendarId as string) || "primary";
    await deleteEvent(calendarId, req.params.id);
    res.json({ success: true });
  })
);

export default router;
