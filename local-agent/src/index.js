#!/usr/bin/env node

/**
 * Meowstik Local Agent
 * 
 * A local software package that:
 * 1. Spawns and controls browser instances via Playwright
 * 2. Communicates with the Meowstik backend via WebSocket
 * 3. Interfaces with the browser extension for enhanced capabilities
 * 4. Executes AI-directed browser automation tasks
 */

import { chromium } from 'playwright';
import WebSocket from 'ws';
import { program } from 'commander';
import chalk from 'chalk';
import { AgentController } from './agent-controller.js';
import { ExtensionBridge } from './extension-bridge.js';

const DEFAULT_BACKEND_URL = 'wss://meowstik.replit.app';
const DEFAULT_EXTENSION_PORT = 9222;

class MeowstikAgent {
  constructor(options) {
    this.backendUrl = options.backend || DEFAULT_BACKEND_URL;
    this.extensionPort = options.extensionPort || DEFAULT_EXTENSION_PORT;
    this.headless = options.headless || false;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.backendWs = null;
    this.extensionBridge = null;
    this.controller = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  async start() {
    console.log(chalk.cyan('🐱 Meowstik Local Agent starting...'));
    console.log(chalk.gray(`Backend: ${this.backendUrl}`));
    console.log(chalk.gray(`Extension port: ${this.extensionPort}`));

    try {
      // Start extension bridge (WebSocket server for extension)
      this.extensionBridge = new ExtensionBridge(this.extensionPort);
      await this.extensionBridge.start();

      // Launch browser
      await this.launchBrowser();

      // Connect to backend
      await this.connectToBackend();

      // Initialize controller
      this.controller = new AgentController(this);

      console.log(chalk.green('✅ Agent ready and connected!'));
      console.log(chalk.yellow('\nPress Ctrl+C to stop.\n'));

      // Keep running
      await this.keepAlive();
    } catch (error) {
      console.error(chalk.red('Failed to start agent:'), error);
      process.exit(1);
    }
  }

  async launchBrowser() {
    console.log(chalk.gray('Launching browser...'));

    // Path to extension (relative to where agent runs)
    const extensionPath = process.env.EXTENSION_PATH || '../extension';

    this.browser = await chromium.launch({
      headless: this.headless,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await this.context.newPage();
    
    // Set up page event listeners
    this.page.on('console', msg => {
      this.sendToBackend({
        type: 'console_log',
        level: msg.type(),
        text: msg.text(),
        url: this.page.url()
      });
    });

    this.page.on('pageerror', error => {
      this.sendToBackend({
        type: 'page_error',
        message: error.message,
        url: this.page.url()
      });
    });

    console.log(chalk.green('Browser launched'));
  }

  async connectToBackend() {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.backendUrl}/api/agent/connect`;
      console.log(chalk.gray(`Connecting to backend: ${wsUrl}`));

      this.backendWs = new WebSocket(wsUrl);

      this.backendWs.on('open', () => {
        console.log(chalk.green('Connected to Meowstik backend'));
        this.reconnectAttempts = 0;
        
        // Announce agent capabilities
        this.sendToBackend({
          type: 'agent_connected',
          capabilities: [
            // Browser automation
            'navigate',
            'click',
            'type',
            'screenshot',
            'get_content',
            'execute_script',
            'wait',
            'scroll',
            'select',
            'hover',
            // File system operations (for client: prefix routing)
            'file_read',
            'file_write',
            'file_list',
            'file_delete',
            'file_exists',
            // Terminal operations
            'terminal_execute',
            // Editor operations
            'editor_open'
          ]
        });

        resolve();
      });

      this.backendWs.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleBackendMessage(message);
        } catch (e) {
          console.error('Invalid message from backend:', e);
        }
      });

      this.backendWs.on('close', () => {
        console.log(chalk.yellow('Backend connection closed'));
        this.scheduleReconnect();
      });

      this.backendWs.on('error', (error) => {
        console.error(chalk.red('Backend WebSocket error:'), error.message);
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(chalk.red('Max reconnection attempts reached. Exiting.'));
      process.exit(1);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(chalk.yellow(`Reconnecting in ${delay/1000}s (attempt ${this.reconnectAttempts})...`));
    
    setTimeout(() => {
      this.connectToBackend().catch(() => {
        // Will retry via scheduleReconnect
      });
    }, delay);
  }

  async handleBackendMessage(message) {
    console.log(chalk.blue(`← ${message.type}`));

    try {
      const result = await this.controller.execute(message);
      
      this.sendToBackend({
        type: 'command_result',
        id: message.id,
        success: true,
        result
      });
    } catch (error) {
      this.sendToBackend({
        type: 'command_result',
        id: message.id,
        success: false,
        error: error.message
      });
    }
  }

  sendToBackend(message) {
    if (this.backendWs && this.backendWs.readyState === WebSocket.OPEN) {
      console.log(chalk.magenta(`→ ${message.type}`));
      this.backendWs.send(JSON.stringify(message));
    }
  }

  async keepAlive() {
    // Send heartbeat every 30 seconds
    setInterval(() => {
      this.sendToBackend({ type: 'heartbeat' });
    }, 30000);

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\nShutting down...'));
      await this.shutdown();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
  }

  async shutdown() {
    if (this.backendWs) {
      this.backendWs.close();
    }
    if (this.extensionBridge) {
      await this.extensionBridge.stop();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// CLI
program
  .name('meowstik-agent')
  .description('Meowstik Local Browser Agent')
  .version('1.0.0')
  .option('-b, --backend <url>', 'Backend WebSocket URL', DEFAULT_BACKEND_URL)
  .option('-p, --extension-port <port>', 'Extension bridge port', DEFAULT_EXTENSION_PORT)
  .option('--headless', 'Run browser in headless mode', false)
  .action(async (options) => {
    const agent = new MeowstikAgent(options);
    await agent.start();
  });

program.parse();
