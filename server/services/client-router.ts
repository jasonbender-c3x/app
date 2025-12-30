/**
 * Client Router Service
 * 
 * Routes commands to connected desktop agents for execution on the client machine.
 * Used by file_get, file_put, terminal_execute, and editor_load tools when
 * paths are prefixed with "client:".
 * 
 * Path Prefixes:
 * - server: (or no prefix) → Execute on Replit workspace
 * - client: → Route to connected desktop agent
 * - editor: → Monaco editor canvas (existing behavior)
 */

import { WebSocket } from "ws";

interface ConnectedAgent {
  ws: WebSocket;
  capabilities: string[];
  connectedAt: Date;
  lastHeartbeat: Date;
}

interface PendingCommand {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

class ClientRouter {
  private connectedAgents: Map<string, ConnectedAgent> = new Map();
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private commandId = 0;
  private commandTimeout = 60000;

  /**
   * Register a connected desktop agent
   */
  registerAgent(agentId: string, ws: WebSocket, capabilities: string[]): void {
    this.connectedAgents.set(agentId, {
      ws,
      capabilities,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    });
    console.log(`[ClientRouter] Agent registered: ${agentId} with capabilities: ${capabilities.join(", ")}`);
  }

  /**
   * Unregister a disconnected agent
   */
  unregisterAgent(agentId: string): void {
    this.connectedAgents.delete(agentId);
    console.log(`[ClientRouter] Agent unregistered: ${agentId}`);
  }

  /**
   * Update agent heartbeat
   */
  heartbeat(agentId: string): void {
    const agent = this.connectedAgents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date();
    }
  }

  /**
   * Handle command result from agent
   */
  handleCommandResult(commandId: string, success: boolean, result: unknown, error?: string): void {
    const pending = this.pendingCommands.get(commandId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(commandId);
      
      if (success) {
        pending.resolve(result);
      } else {
        pending.reject(new Error(error || "Command failed"));
      }
    }
  }

  /**
   * Check if any agent is connected
   */
  hasConnectedAgent(): boolean {
    return this.connectedAgents.size > 0;
  }

  /**
   * Get first available agent
   */
  getFirstAgent(): ConnectedAgent | null {
    const [first] = this.connectedAgents.values();
    return first || null;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): ConnectedAgent | null {
    return this.connectedAgents.get(agentId) || null;
  }

  /**
   * List all connected agents
   */
  listAgents(): Array<{ id: string; capabilities: string[]; connectedAt: Date; lastHeartbeat: Date }> {
    return Array.from(this.connectedAgents.entries()).map(([id, agent]) => ({
      id,
      capabilities: agent.capabilities,
      connectedAt: agent.connectedAt,
      lastHeartbeat: agent.lastHeartbeat,
    }));
  }

  /**
   * Send a command to the client agent and wait for response
   */
  async sendCommand(command: ClientCommand, agentId?: string): Promise<unknown> {
    const agent = agentId ? this.getAgent(agentId) : this.getFirstAgent();
    
    if (!agent) {
      throw new Error("No desktop agent connected. Please start the Meowstik desktop app on your computer.");
    }

    if (agent.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Desktop agent connection is not open");
    }

    const id = `cmd_${++this.commandId}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error("Command timeout - desktop agent did not respond"));
      }, this.commandTimeout);

      this.pendingCommands.set(id, { resolve, reject, timeout });

      const message = JSON.stringify({ ...command, id });
      agent.ws.send(message);
      
      console.log(`[ClientRouter] Sent command ${id}: ${command.type}`);
    });
  }

  /**
   * Read a file from the client machine
   */
  async readFile(filePath: string, encoding: string = "utf8"): Promise<string> {
    const result = await this.sendCommand({
      type: "file_read",
      path: filePath,
      encoding,
    }) as { content: string };
    
    return result.content;
  }

  /**
   * Write a file to the client machine
   */
  async writeFile(filePath: string, content: string, options?: { permissions?: string }): Promise<void> {
    await this.sendCommand({
      type: "file_write",
      path: filePath,
      content,
      permissions: options?.permissions,
    });
  }

  /**
   * List files in a directory on the client machine
   */
  async listFiles(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; size: number }>> {
    const result = await this.sendCommand({
      type: "file_list",
      path: dirPath,
    }) as { files: Array<{ name: string; isDirectory: boolean; size: number }> };
    
    return result.files;
  }

  /**
   * Execute a terminal command on the client machine
   */
  async executeTerminal(command: string, options?: { cwd?: string; timeout?: number }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const result = await this.sendCommand({
      type: "terminal_execute",
      command,
      cwd: options?.cwd,
      timeout: options?.timeout,
    }) as { stdout: string; stderr: string; exitCode: number };
    
    return result;
  }

  /**
   * Open a file in the client's default editor
   */
  async openInEditor(filePath: string): Promise<void> {
    await this.sendCommand({
      type: "editor_open",
      path: filePath,
    });
  }

  /**
   * Take a screenshot of the client's screen
   */
  async screenshot(): Promise<string> {
    const result = await this.sendCommand({
      type: "screenshot",
    }) as { screenshot: string };
    
    return result.screenshot;
  }
}

interface ClientCommand {
  type: string;
  [key: string]: unknown;
}

export const clientRouter = new ClientRouter();
