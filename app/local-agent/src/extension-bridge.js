/**
 * Extension Bridge
 * 
 * WebSocket server that the browser extension connects to.
 * Allows bi-directional communication between the agent and extension.
 */

import { WebSocketServer } from 'ws';
import chalk from 'chalk';

export class ExtensionBridge {
  constructor(port) {
    this.port = port;
    this.server = null;
    this.clients = new Set();
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = new WebSocketServer({ port: this.port });

      this.server.on('listening', () => {
        console.log(chalk.green(`Extension bridge listening on port ${this.port}`));
        resolve();
      });

      this.server.on('connection', (ws) => {
        console.log(chalk.cyan('Browser extension connected'));
        this.clients.add(ws);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(ws, message);
          } catch (e) {
            console.error('Invalid message from extension:', e);
          }
        });

        ws.on('close', () => {
          console.log(chalk.yellow('Browser extension disconnected'));
          this.clients.delete(ws);
        });

        ws.on('error', (error) => {
          console.error('Extension WebSocket error:', error);
          this.clients.delete(ws);
        });
      });

      this.server.on('error', (error) => {
        console.error(chalk.red('Extension bridge error:'), error);
        reject(error);
      });
    });
  }

  handleMessage(ws, message) {
    // Handle response to pending request
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      resolve(message.data);
      return;
    }

    // Handle extension-initiated messages
    switch (message.type) {
      case 'extension_connected':
        console.log(chalk.green('Extension handshake complete'));
        break;

      case 'console_log':
        console.log(chalk.gray(`[Console] ${message.data}`));
        break;

      case 'page_error':
        console.log(chalk.red(`[Error] ${message.data}`));
        break;

      default:
        console.log(chalk.gray(`Extension message: ${message.type}`));
    }
  }

  /**
   * Send request to extension and wait for response
   */
  async request(type, data = {}, timeout = 10000) {
    if (this.clients.size === 0) {
      throw new Error('No extension connected');
    }

    const id = ++this.requestId;
    const message = { type, id, ...data };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Extension request timeout'));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: (data) => {
          clearTimeout(timer);
          resolve(data);
        },
        reject
      });

      // Send to first connected client
      const [client] = this.clients;
      client.send(JSON.stringify(message));
    });
  }

  /**
   * Broadcast message to all connected extensions
   */
  broadcast(type, data = {}) {
    const message = JSON.stringify({ type, ...data });
    for (const client of this.clients) {
      client.send(message);
    }
  }

  /**
   * Get screenshot from extension
   */
  async captureScreen() {
    return this.request('capture_screen');
  }

  /**
   * Get console logs from extension
   */
  async getConsoleLogs() {
    return this.request('get_console_logs');
  }

  /**
   * Get network requests from extension
   */
  async getNetworkRequests() {
    return this.request('get_network');
  }

  /**
   * Get page content from extension
   */
  async getPageContent() {
    return this.request('get_page_content');
  }

  async stop() {
    if (this.server) {
      // Close all connections
      for (const client of this.clients) {
        client.close();
      }
      
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log(chalk.yellow('Extension bridge stopped'));
          resolve();
        });
      });
    }
  }
}
