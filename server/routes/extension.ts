/**
 * Extension API Routes
 * 
 * Endpoints for the Meowstik browser extension to communicate with the backend.
 * Handles:
 * - Screen capture analysis
 * - Console log analysis
 * - Network request analysis
 * - Page content analysis
 * - Quick actions (calendar, drive, tasks, email)
 * - Chat from extension popup
 */

import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// CORS headers for extension
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

/**
 * Main action endpoint for all extension requests
 */
router.post("/action", async (req, res) => {
  try {
    const { action, ...data } = req.body;
    console.log(`[Extension] Action: ${action}`);

    let result;

    switch (action) {
      case "ping":
        result = { message: "pong", status: "ok" };
        break;

      case "analyze_screenshot":
        result = await analyzeScreenshot(data);
        break;

      case "analyze_console":
        result = await analyzeConsoleLogs(data);
        break;

      case "analyze_network":
        result = await analyzeNetworkRequests(data);
        break;

      case "analyze_page":
        result = await analyzePageContent(data);
        break;

      case "analyze_selection":
        result = await analyzeSelection(data);
        break;

      case "explain":
        result = await explainText(data);
        break;

      case "summarize":
        result = await summarizePage(data);
        break;

      case "analyze_har":
        result = await analyzeHAR(data);
        break;

      case "devtools_question":
        result = await answerDevToolsQuestion(data);
        break;

      case "quick_action":
        result = await handleQuickAction(data);
        break;

      case "chat":
        result = await handleChat(data);
        break;

      default:
        result = { message: `Unknown action: ${action}` };
    }

    res.json(result);
  } catch (error) {
    console.error("[Extension] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Analyze a screenshot using Gemini vision
 */
async function analyzeScreenshot(data: { screenshot: string; url: string; title: string }) {
  const { screenshot, url, title } = data;

  // Extract base64 data from data URL
  const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Data
            }
          },
          {
            text: `You are analyzing a screenshot of a web page.
URL: ${url}
Title: ${title}

Please describe what you see on this page. Identify:
1. The type of page/website
2. Main content and purpose
3. Any notable UI elements or issues
4. Suggestions if applicable

Be concise but informative.`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

/**
 * Analyze console logs for errors and issues
 */
async function analyzeConsoleLogs(data: { logs: any[]; url: string }) {
  const { logs, url } = data;

  if (!logs || logs.length === 0) {
    return { message: "No console logs to analyze." };
  }

  const errorLogs = logs.filter(l => l.type === "error" || l.type === "warn");
  const logSummary = logs.slice(-50).map(l => `[${l.type}] ${l.message}`).join("\n");

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze these browser console logs from ${url}:

${logSummary}

Summary:
- Total logs: ${logs.length}
- Errors: ${errorLogs.filter(l => l.type === "error").length}
- Warnings: ${errorLogs.filter(l => l.type === "warn").length}

Please:
1. Identify any critical errors
2. Explain what the errors mean
3. Suggest fixes if possible
4. Note any patterns or recurring issues

Be concise and actionable.`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

/**
 * Analyze network requests for issues
 */
async function analyzeNetworkRequests(data: { requests: any[]; url: string }) {
  const { requests, url } = data;

  if (!requests || requests.length === 0) {
    return { message: "No network requests to analyze." };
  }

  const failed = requests.filter(r => r.statusCode >= 400 || r.error);
  const summary = requests.slice(-30).map(r => 
    `${r.method} ${r.url?.substring(0, 80)} - ${r.statusCode || r.error || "pending"}`
  ).join("\n");

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze these network requests from ${url}:

${summary}

Summary:
- Total requests: ${requests.length}
- Failed: ${failed.length}

Please:
1. Identify any failed or problematic requests
2. Explain potential causes
3. Suggest solutions
4. Note any performance concerns

Be concise and actionable.`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

/**
 * Analyze page content
 */
async function analyzePageContent(data: { content: any; url: string; title: string }) {
  const { content, url, title } = data;

  const pageText = typeof content === "string" 
    ? content 
    : content?.text?.substring(0, 10000) || "No content";

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this web page:

URL: ${url}
Title: ${title}

Content:
${pageText}

Please provide:
1. Summary of what this page is about
2. Key information or data on the page
3. Any notable elements (forms, links, etc.)
4. Suggestions for actions I might want to take

Be concise but helpful.`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

/**
 * Analyze selected text
 */
async function analyzeSelection(data: { text: string; url: string }) {
  const { text, url } = data;

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this selected text from ${url}:

"${text}"

Please:
1. Explain what this text means
2. Provide relevant context or background
3. Suggest related information or actions

Be concise but informative.`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

/**
 * Explain selected text
 */
async function explainText(data: { text: string; url: string }) {
  const { text, url } = data;

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Explain this in simple terms:

"${text}"

Context: Found on ${url}

Provide a clear, easy-to-understand explanation.`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

/**
 * Summarize a page
 */
async function summarizePage(data: { url: string; title: string }) {
  const { url, title } = data;

  return { 
    message: `To summarize this page, please use the "Analyze Page" button which captures the full content.` 
  };
}

/**
 * Analyze HAR data from DevTools
 */
async function analyzeHAR(data: { har: any }) {
  const { har } = data;

  if (!har || !har.entries) {
    return { message: "No HAR data to analyze." };
  }

  const summary = har.entries.slice(0, 30).map((e: any) => 
    `${e.method} ${e.url?.substring(0, 60)} - ${e.status} (${e.time}ms)`
  ).join("\n");

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this HAR (HTTP Archive) data:

Total requests: ${har.totalRequests}

Requests:
${summary}

Please provide:
1. Overall performance assessment
2. Any slow or failed requests
3. Optimization suggestions
4. Notable patterns`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

/**
 * Answer a DevTools-related question
 */
async function answerDevToolsQuestion(data: { question: string; context: any }) {
  const { question, context } = data;

  const contextSummary = context?.recentRequests?.map((r: any) => 
    `${r.method} ${r.url?.substring(0, 50)} - ${r.status}`
  ).join("\n") || "No context";

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Developer question: ${question}

Context (recent network requests):
${contextSummary}

Please answer the question based on the context provided. Be technical but clear.`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

/**
 * Handle quick actions (calendar, drive, tasks, email)
 */
async function handleQuickAction(data: { type: string; pageContent: any; url: string; title: string }) {
  const { type, pageContent, url, title } = data;

  // For now, return instructions - actual integration would use Google APIs
  switch (type) {
    case "calendar":
      return { 
        message: `To add an event from this page, open the full Meowstik app and say "Add this to my calendar: ${title}"`
      };
    
    case "drive":
      return { 
        message: `To save to Drive, open the full Meowstik app and say "Save this page to Drive: ${url}"`
      };
    
    case "task":
      return { 
        message: `To create a task, open the full Meowstik app and say "Create a task for: ${title}"`
      };
    
    case "email":
      return { 
        message: `To draft an email about this page, open the full Meowstik app and share the content.`
      };
    
    default:
      return { message: `Unknown quick action: ${type}` };
  }
}

/**
 * Handle chat from extension popup
 */
async function handleChat(data: { message: string; context?: any; url: string; title: string }) {
  const { message, context, url, title } = data;

  let contextText = "";
  if (context) {
    contextText = `\nPage context:
URL: ${url}
Title: ${title}
Content: ${typeof context === "string" ? context.substring(0, 5000) : context?.text?.substring(0, 5000) || ""}`;
  }

  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `User message: ${message}${contextText}

Respond helpfully and concisely. If the context is relevant, use it in your answer.`
          }
        ]
      }
    ]
  });

  return { message: result.text };
}

// =============================================================================
// WEBSOCKET SUPPORT FOR REAL-TIME EXTENSION COMMUNICATION
// =============================================================================

interface ExtensionConnection {
  id: string;
  ws: WebSocket;
  capabilities: string[];
  connectedAt: Date;
  lastHeartbeat: Date;
  source: 'popup' | 'background';
}

const extensionConnections = new Map<string, ExtensionConnection>();

let wss: WebSocketServer | null = null;

export function initExtensionWebSocket(server: any) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    
    if (pathname === '/api/extension/connect') {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, request: any) => {
    const connectionId = uuidv4();
    console.log(`[Extension WS] New connection: ${connectionId}`);

    const connection: ExtensionConnection = {
      id: connectionId,
      ws,
      capabilities: [],
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      source: 'popup'
    };

    extensionConnections.set(connectionId, connection);

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await handleExtensionWSMessage(connectionId, message);
      } catch (error) {
        console.error('[Extension WS] Invalid message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      console.log(`[Extension WS] Connection closed: ${connectionId}`);
      extensionConnections.delete(connectionId);
    });

    ws.on('error', (error) => {
      console.error(`[Extension WS] Connection error: ${connectionId}`, error);
      extensionConnections.delete(connectionId);
    });

    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
      serverTime: new Date().toISOString()
    }));
  });

  // Heartbeat check
  setInterval(() => {
    const now = Date.now();
    extensionConnections.forEach((conn, id) => {
      if (now - conn.lastHeartbeat.getTime() > 60000) {
        console.log(`[Extension WS] Connection timeout: ${id}`);
        conn.ws.close();
        extensionConnections.delete(id);
      }
    });
  }, 30000);

  console.log('[Extension WS] WebSocket server initialized');
}

async function handleExtensionWSMessage(connectionId: string, message: any) {
  const connection = extensionConnections.get(connectionId);
  if (!connection) return;

  connection.lastHeartbeat = new Date();

  switch (message.type) {
    case 'extension_connected':
      connection.capabilities = message.capabilities || [];
      connection.source = message.source || 'popup';
      console.log(`[Extension WS] Extension registered:`, connection.capabilities);
      break;

    case 'heartbeat':
      connection.ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
      break;

    case 'chat_message':
      const chatResult = await handleChat({ 
        message: message.content, 
        url: message.url || '', 
        title: message.title || '' 
      });
      connection.ws.send(JSON.stringify({ type: 'chat_response', content: chatResult.message }));
      break;

    case 'analyze_image':
      const imgResult = await analyzeScreenshot({ 
        screenshot: `data:image/png;base64,${message.image}`, 
        url: message.url || '', 
        title: message.context || '' 
      });
      connection.ws.send(JSON.stringify({ type: 'chat_response', content: imgResult.message }));
      break;

    case 'voice_audio':
      console.log('[Extension WS] Received voice audio chunk');
      break;

    case 'element_selected':
      console.log('[Extension WS] Element selected:', message.element?.tag);
      const selResult = await analyzeSelection({ text: message.element?.text || '', url: '' });
      connection.ws.send(JSON.stringify({ type: 'chat_response', content: selResult.message }));
      break;

    case 'console_log':
      console.log(`[Extension Console] [${message.level}]`, message.args?.join(' '));
      break;

    default:
      console.log(`[Extension WS] Unknown message type: ${message.type}`);
  }
}

export function sendToExtension(connectionId: string, message: any): boolean {
  const connection = extensionConnections.get(connectionId);
  if (connection && connection.ws.readyState === WebSocket.OPEN) {
    connection.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

export function broadcastToExtensions(message: any) {
  extensionConnections.forEach((connection) => {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  });
}

export function getConnectedExtensions() {
  return Array.from(extensionConnections.values()).map(conn => ({
    id: conn.id,
    capabilities: conn.capabilities,
    connectedAt: conn.connectedAt,
    source: conn.source
  }));
}

router.get('/ws-status', (req, res) => {
  res.json({
    connected: extensionConnections.size,
    connections: getConnectedExtensions()
  });
});

export default router;
