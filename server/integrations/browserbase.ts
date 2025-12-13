/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  BROWSERBASE INTEGRATION                                                      ║
 * ║  Cloud-hosted headless browser infrastructure for AI agents                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This module provides headless browser capabilities using Browserbase's cloud
 * infrastructure. It enables web scraping, screenshot capture, and browser
 * automation with stealth features and anti-bot protection.
 * 
 * FEATURES:
 * - Load web pages and extract HTML/text content
 * - Capture full-page or viewport screenshots
 * - Run custom Playwright scripts
 * - Session management with replay capability
 * 
 * SETUP:
 * Requires BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID environment variables.
 */

import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

let browserbaseClient: Browserbase | null = null;

function getClient(): Browserbase {
  if (!BROWSERBASE_API_KEY) {
    throw new Error("BROWSERBASE_API_KEY environment variable is not set");
  }
  
  if (!browserbaseClient) {
    browserbaseClient = new Browserbase({
      apiKey: BROWSERBASE_API_KEY,
    });
  }
  
  return browserbaseClient;
}

function getProjectId(): string {
  if (!BROWSERBASE_PROJECT_ID) {
    throw new Error("BROWSERBASE_PROJECT_ID environment variable is not set");
  }
  return BROWSERBASE_PROJECT_ID;
}

export interface BrowserbaseSession {
  id: string;
  connectUrl: string;
  debugUrl?: string;
}

export interface LoadPageResult {
  url: string;
  html: string;
  text?: string;
  title?: string;
  sessionId?: string;
}

export interface ScreenshotResult {
  url: string;
  screenshot: Buffer;
  sessionId?: string;
}

/**
 * Create a new browser session
 */
export async function createSession(): Promise<BrowserbaseSession> {
  const client = getClient();
  const projectId = getProjectId();
  
  const session = await client.sessions.create({
    projectId,
  });
  
  return {
    id: session.id,
    connectUrl: session.connectUrl,
  };
}

/**
 * Load a webpage and return its content
 */
export async function loadPage(
  url: string,
  options: {
    textOnly?: boolean;
    waitForSelector?: string;
    timeout?: number;
  } = {}
): Promise<LoadPageResult> {
  const client = getClient();
  const projectId = getProjectId();
  
  const session = await client.sessions.create({
    projectId,
  });
  
  const browser = await chromium.connectOverCDP(session.connectUrl);
  
  try {
    const context = browser.contexts()[0];
    const page = context?.pages()[0] || await context?.newPage();
    
    if (!page) {
      throw new Error("Failed to get page from browser context");
    }
    
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeout || 30000,
    });
    
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.timeout || 30000,
      });
    }
    
    const title = await page.title();
    const html = await page.content();
    
    let text: string | undefined;
    if (options.textOnly) {
      text = await page.evaluate(() => document.body.innerText);
    }
    
    return {
      url,
      html,
      text,
      title,
      sessionId: session.id,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Take a screenshot of a webpage
 */
export async function takeScreenshot(
  url: string,
  options: {
    fullPage?: boolean;
    timeout?: number;
  } = {}
): Promise<ScreenshotResult> {
  const client = getClient();
  const projectId = getProjectId();
  
  const session = await client.sessions.create({
    projectId,
  });
  
  const browser = await chromium.connectOverCDP(session.connectUrl);
  
  try {
    const context = browser.contexts()[0];
    const page = context?.pages()[0] || await context?.newPage();
    
    if (!page) {
      throw new Error("Failed to get page from browser context");
    }
    
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: options.timeout || 30000,
    });
    
    const screenshot = await page.screenshot({
      fullPage: options.fullPage ?? true,
    });
    
    return {
      url,
      screenshot,
      sessionId: session.id,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Execute custom actions on a page
 */
export async function executeBrowserAction(
  url: string,
  actions: Array<{
    type: "click" | "type" | "scroll" | "wait" | "screenshot";
    selector?: string;
    text?: string;
    delay?: number;
  }>
): Promise<{
  success: boolean;
  results: unknown[];
  sessionId: string;
}> {
  const client = getClient();
  const projectId = getProjectId();
  
  const session = await client.sessions.create({
    projectId,
  });
  
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const results: unknown[] = [];
  
  try {
    const context = browser.contexts()[0];
    const page = context?.pages()[0] || await context?.newPage();
    
    if (!page) {
      throw new Error("Failed to get page from browser context");
    }
    
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    
    for (const action of actions) {
      switch (action.type) {
        case "click":
          if (action.selector) {
            await page.click(action.selector);
            results.push({ type: "click", selector: action.selector, success: true });
          }
          break;
          
        case "type":
          if (action.selector && action.text) {
            await page.fill(action.selector, action.text);
            results.push({ type: "type", selector: action.selector, success: true });
          }
          break;
          
        case "scroll":
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          results.push({ type: "scroll", success: true });
          break;
          
        case "wait":
          await page.waitForTimeout(action.delay || 1000);
          results.push({ type: "wait", delay: action.delay || 1000, success: true });
          break;
          
        case "screenshot":
          const screenshot = await page.screenshot();
          results.push({ type: "screenshot", size: screenshot.length, success: true });
          break;
      }
    }
    
    return {
      success: true,
      results,
      sessionId: session.id,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Get session replay URL for debugging
 */
export function getSessionReplayUrl(sessionId: string): string {
  return `https://browserbase.com/sessions/${sessionId}`;
}

/**
 * Check if Browserbase is configured
 */
export function isConfigured(): boolean {
  return !!(BROWSERBASE_API_KEY && BROWSERBASE_PROJECT_ID);
}

export default {
  createSession,
  loadPage,
  takeScreenshot,
  executeBrowserAction,
  getSessionReplayUrl,
  isConfigured,
};
