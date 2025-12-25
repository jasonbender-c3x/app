import { Router } from "express";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const router = Router();

const SCREENSHOTS_DIR = path.join(process.cwd(), ".local", "playwright-screenshots");

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

interface TestSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: Date;
}

const sessions = new Map<string, TestSession>();
const MAX_SESSIONS = 3;
const SESSION_TIMEOUT = 5 * 60 * 1000;

async function cleanupOldSessions() {
  const now = Date.now();
  const entries = Array.from(sessions.entries());
  for (const [id, session] of entries) {
    if (now - session.createdAt.getTime() > SESSION_TIMEOUT) {
      try {
        await session.browser.close();
      } catch (e) {}
      sessions.delete(id);
    }
  }
}

async function getValidSession(sessionId: string): Promise<TestSession | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  if (Date.now() - session.createdAt.getTime() > SESSION_TIMEOUT) {
    try {
      await session.browser.close();
    } catch (e) {}
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

async function getOrCreateSession(sessionId: string, headless: boolean = true): Promise<TestSession> {
  await cleanupOldSessions();
  
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }
  
  if (sessions.size >= MAX_SESSIONS) {
    const oldestId = sessions.keys().next().value;
    if (oldestId) {
      const oldSession = sessions.get(oldestId);
      if (oldSession) {
        await oldSession.browser.close();
        sessions.delete(oldestId);
      }
    }
  }
  
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  });
  const page = await context.newPage();
  
  const session: TestSession = {
    browser,
    context,
    page,
    createdAt: new Date()
  };
  
  sessions.set(sessionId, session);
  return session;
}

const navigateSchema = z.object({
  sessionId: z.string().default(() => `session_${Date.now()}`),
  url: z.string().url("Valid URL required"),
  headless: z.boolean().default(true),
  timeout: z.number().min(1000).max(60000).default(30000)
});

router.post("/navigate", async (req, res) => {
  try {
    const parsed = navigateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, url, headless, timeout } = parsed.data;
    const session = await getOrCreateSession(sessionId, headless);
    
    await session.page.goto(url, { timeout, waitUntil: "domcontentloaded" });
    const title = await session.page.title();
    const currentUrl = session.page.url();
    
    res.json({
      success: true,
      sessionId,
      result: { title, url: currentUrl },
      message: `Navigated to ${currentUrl}`
    });
  } catch (error) {
    console.error("[Playwright] Navigate error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Navigation failed" });
  }
});

const clickSchema = z.object({
  sessionId: z.string(),
  selector: z.string().min(1, "Selector required"),
  timeout: z.number().min(1000).max(30000).default(10000)
});

router.post("/click", async (req, res) => {
  try {
    const parsed = clickSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, selector, timeout } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    await session.page.click(selector, { timeout });
    
    res.json({
      success: true,
      sessionId,
      message: `Clicked element: ${selector}`
    });
  } catch (error) {
    console.error("[Playwright] Click error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Click failed" });
  }
});

const typeSchema = z.object({
  sessionId: z.string(),
  selector: z.string().min(1, "Selector required"),
  text: z.string(),
  timeout: z.number().min(1000).max(30000).default(10000)
});

router.post("/type", async (req, res) => {
  try {
    const parsed = typeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, selector, text, timeout } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    await session.page.fill(selector, text, { timeout });
    
    res.json({
      success: true,
      sessionId,
      message: `Typed "${text}" into ${selector}`
    });
  } catch (error) {
    console.error("[Playwright] Type error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Type failed" });
  }
});

const screenshotSchema = z.object({
  sessionId: z.string(),
  fullPage: z.boolean().default(false)
});

router.post("/screenshot", async (req, res) => {
  try {
    const parsed = screenshotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, fullPage } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    ensureScreenshotsDir();
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    
    await session.page.screenshot({ path: filepath, fullPage });
    
    const base64 = fs.readFileSync(filepath).toString("base64");
    
    res.json({
      success: true,
      sessionId,
      result: {
        filename,
        path: filepath,
        base64: `data:image/png;base64,${base64}`
      },
      message: "Screenshot captured"
    });
  } catch (error) {
    console.error("[Playwright] Screenshot error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Screenshot failed" });
  }
});

const evalSchema = z.object({
  sessionId: z.string(),
  script: z.string().min(1, "Script required")
});

router.post("/evaluate", async (req, res) => {
  try {
    const parsed = evalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, script } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    const result = await session.page.evaluate(script);
    
    res.json({
      success: true,
      sessionId,
      result,
      message: "Script executed"
    });
  } catch (error) {
    console.error("[Playwright] Evaluate error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Evaluate failed" });
  }
});

const waitSchema = z.object({
  sessionId: z.string(),
  selector: z.string().min(1, "Selector required"),
  state: z.enum(["visible", "hidden", "attached", "detached"]).default("visible"),
  timeout: z.number().min(1000).max(60000).default(30000)
});

router.post("/wait", async (req, res) => {
  try {
    const parsed = waitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, selector, state, timeout } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    await session.page.waitForSelector(selector, { state, timeout });
    
    res.json({
      success: true,
      sessionId,
      message: `Element ${selector} is ${state}`
    });
  } catch (error) {
    console.error("[Playwright] Wait error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Wait failed" });
  }
});

const getTextSchema = z.object({
  sessionId: z.string(),
  selector: z.string().min(1, "Selector required"),
  timeout: z.number().min(1000).max(30000).default(10000)
});

router.post("/getText", async (req, res) => {
  try {
    const parsed = getTextSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    }
    
    const { sessionId, selector, timeout } = parsed.data;
    const session = await getValidSession(sessionId);
    if (!session) {
      return res.status(400).json({ success: false, error: "Session not found or expired. Navigate first." });
    }
    
    const element = await session.page.waitForSelector(selector, { timeout });
    const text = await element?.textContent();
    
    res.json({
      success: true,
      sessionId,
      result: { text: text || "" },
      message: `Got text from ${selector}`
    });
  } catch (error) {
    console.error("[Playwright] GetText error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "GetText failed" });
  }
});

router.post("/close", async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = sessions.get(sessionId);
    
    if (session) {
      await session.browser.close();
      sessions.delete(sessionId);
    }
    
    res.json({ success: true, message: "Session closed" });
  } catch (error) {
    console.error("[Playwright] Close error:", error);
    res.json({ success: false, error: error instanceof Error ? error.message : "Close failed" });
  }
});

router.get("/sessions", (_req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    createdAt: session.createdAt,
    url: session.page.url()
  }));
  
  res.json({ sessions: sessionList, maxSessions: MAX_SESSIONS });
});

router.delete("/sessions", async (_req, res) => {
  try {
    const entries = Array.from(sessions.entries());
    for (const [id, session] of entries) {
      await session.browser.close();
      sessions.delete(id);
    }
    res.json({ success: true, message: "All sessions closed" });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : "Failed to close sessions" });
  }
});

export default router;
