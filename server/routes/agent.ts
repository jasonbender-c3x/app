/**
 * Agent API Routes
 * 
 * WebSocket and HTTP endpoints for the local Meowstik agent.
 * Handles:
 * - Agent connection and heartbeat
 * - Command dispatch to browser automation
 * - Task orchestration for AI-directed browsing
 */

import { Router } from "express";
import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { GoogleGenAI } from "@google/genai";
import { clientRouter } from "../services/client-router";

const router = Router();
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Store connected agents (local reference, clientRouter is the source of truth)
const connectedAgents = new Map<string, {
  ws: WebSocket;
  capabilities: string[];
  connectedAt: Date;
  lastHeartbeat: Date;
}>();

// Pending commands waiting for response
const pendingCommands = new Map<string, {
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
}>();

let commandId = 0;

/**
 * Get list of connected agents
 */
router.get("/agents", (req, res) => {
  const agents = Array.from(connectedAgents.entries()).map(([id, agent]) => ({
    id,
    capabilities: agent.capabilities,
    connectedAt: agent.connectedAt,
    lastHeartbeat: agent.lastHeartbeat
  }));
  
  res.json({ agents });
});

/**
 * Send a command to a specific agent
 */
router.post("/command", async (req, res) => {
  try {
    const { agentId, command } = req.body;

    // Find agent
    let agent;
    if (agentId) {
      agent = connectedAgents.get(agentId);
    } else {
      // Use first available agent
      const [firstAgent] = connectedAgents.values();
      agent = firstAgent;
    }

    if (!agent) {
      return res.status(404).json({ error: "No agent connected" });
    }

    // Send command and wait for response
    const result = await sendCommand(agent.ws, command);
    res.json(result);
  } catch (error) {
    console.error("[Agent] Command error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Command failed"
    });
  }
});

/**
 * Execute an AI-directed browser task
 */
router.post("/task", async (req, res) => {
  try {
    const { task, agentId } = req.body;

    // Find agent
    let agent;
    if (agentId) {
      agent = connectedAgents.get(agentId);
    } else {
      const [firstAgent] = connectedAgents.values();
      agent = firstAgent;
    }

    if (!agent) {
      return res.status(404).json({ error: "No agent connected" });
    }

    // Use AI to plan the task
    const plan = await planTask(task);
    
    // Execute each step
    const results = [];
    for (const step of plan.steps) {
      console.log(`[Agent] Executing step: ${step.type}`);
      const result = await sendCommand(agent.ws, step);
      results.push({ step: step.type, result });

      // Check if we need to adapt based on result
      if (step.checkResult) {
        const shouldContinue = await evaluateResult(task, step, result, plan.steps);
        if (!shouldContinue) {
          break;
        }
      }
    }

    res.json({
      task,
      plan,
      results,
      success: true
    });
  } catch (error) {
    console.error("[Agent] Task error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Task failed"
    });
  }
});

/**
 * Send command to agent and wait for response
 */
function sendCommand(ws: WebSocket, command: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = `cmd_${++commandId}`;
    
    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error("Command timeout"));
    }, 60000);

    pendingCommands.set(id, { resolve, reject, timeout });

    ws.send(JSON.stringify({ ...command, id }));
  });
}

/**
 * Use AI to plan a browser automation task
 */
async function planTask(task: string): Promise<{ steps: any[] }> {
  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a browser automation planner. Given a task, output a JSON array of steps to accomplish it.

Available commands:
- navigate: { type: "navigate", url: "..." }
- click: { type: "click", selector: "..." }
- type: { type: "type", selector: "...", text: "..." }
- screenshot: { type: "screenshot" }
- get_content: { type: "get_content", selector: "..." }
- wait: { type: "wait", selector: "...", timeout: 5000 }
- scroll: { type: "scroll", direction: "down" | "up" | "bottom" }
- fill_form: { type: "fill_form", data: { field: "value" } }
- submit_form: { type: "submit_form" }

Task: ${task}

Respond with ONLY a JSON object like:
{
  "steps": [
    { "type": "navigate", "url": "https://..." },
    { "type": "click", "selector": "#button" }
  ]
}

Be specific with selectors. Prefer data-testid, id, then class names.`
          }
        ]
      }
    ]
  });

  try {
    const text = result.text || "";
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { steps: [] };
  } catch (e) {
    console.error("[Agent] Failed to parse task plan:", e);
    return { steps: [] };
  }
}

/**
 * Evaluate if task should continue after a step
 */
async function evaluateResult(task: string, step: any, result: any, remainingSteps: any[]): Promise<boolean> {
  // Simple evaluation - could be enhanced with AI
  if (result.error) {
    console.warn(`[Agent] Step failed: ${result.error}`);
    return false;
  }
  return true;
}

/**
 * Setup WebSocket server for agent connections
 */
export function setupAgentWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;

    if (pathname === "/api/agent/connect") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    const agentId = `agent_${Date.now()}`;
    console.log(`[Agent] Connected: ${agentId}`);

    connectedAgents.set(agentId, {
      ws,
      capabilities: [],
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleAgentMessage(agentId, message);
      } catch (e) {
        console.error("[Agent] Invalid message:", e);
      }
    });

    ws.on("close", () => {
      console.log(`[Agent] Disconnected: ${agentId}`);
      connectedAgents.delete(agentId);
      clientRouter.unregisterAgent(agentId);
    });

    ws.on("error", (error) => {
      console.error(`[Agent] Error for ${agentId}:`, error);
      connectedAgents.delete(agentId);
      clientRouter.unregisterAgent(agentId);
    });
  });

  console.log("[Agent] WebSocket server initialized");
}

/**
 * Handle incoming message from agent
 */
function handleAgentMessage(agentId: string, message: any) {
  const agent = connectedAgents.get(agentId);
  if (!agent) return;

  switch (message.type) {
    case "agent_connected":
      agent.capabilities = message.capabilities || [];
      console.log(`[Agent] ${agentId} capabilities:`, agent.capabilities);
      
      // Register with clientRouter for file/terminal operations
      clientRouter.registerAgent(agentId, agent.ws, agent.capabilities);
      break;

    case "heartbeat":
      agent.lastHeartbeat = new Date();
      clientRouter.heartbeat(agentId);
      break;

    case "command_result":
      // First check if this is a clientRouter command
      clientRouter.handleCommandResult(message.id, message.success, message.result, message.error);
      
      // Also check local pending commands (for direct agent API calls)
      const pending = pendingCommands.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingCommands.delete(message.id);
        
        if (message.success) {
          pending.resolve(message.result);
        } else {
          pending.reject(new Error(message.error));
        }
      }
      break;

    case "console_log":
    case "page_error":
      console.log(`[Agent] ${message.type}:`, message.text || message.message);
      break;

    default:
      console.log(`[Agent] Unhandled message type: ${message.type}`);
  }
}

export default router;
