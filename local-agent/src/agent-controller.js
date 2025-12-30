/**
 * Agent Controller
 * 
 * Handles execution of commands from the backend.
 * Maps AI-directed actions to Playwright operations and local file access.
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class AgentController {
  constructor(agent) {
    this.agent = agent;
  }

  get page() {
    return this.agent.page;
  }

  get context() {
    return this.agent.context;
  }

  async execute(command) {
    const { type, ...params } = command;

    switch (type) {
      case 'navigate':
        return this.navigate(params);

      case 'click':
        return this.click(params);

      case 'type':
        return this.typeText(params);

      case 'screenshot':
        return this.screenshot(params);

      case 'get_content':
        return this.getContent(params);

      case 'execute_script':
        return this.executeScript(params);

      case 'wait':
        return this.wait(params);

      case 'scroll':
        return this.scroll(params);

      case 'select':
        return this.select(params);

      case 'hover':
        return this.hover(params);

      case 'get_element':
        return this.getElement(params);

      case 'get_elements':
        return this.getElements(params);

      case 'fill_form':
        return this.fillForm(params);

      case 'submit_form':
        return this.submitForm(params);

      case 'go_back':
        await this.page.goBack();
        return { url: this.page.url() };

      case 'go_forward':
        await this.page.goForward();
        return { url: this.page.url() };

      case 'refresh':
        await this.page.reload();
        return { url: this.page.url() };

      case 'new_tab':
        const newPage = await this.context.newPage();
        if (params.url) {
          await newPage.goto(params.url);
        }
        return { url: newPage.url() };

      case 'close_tab':
        await this.page.close();
        const pages = this.context.pages();
        if (pages.length > 0) {
          this.agent.page = pages[pages.length - 1];
        }
        return { tabsClosed: 1 };

      case 'get_tabs':
        const allPages = this.context.pages();
        return {
          tabs: allPages.map((p, i) => ({
            index: i,
            url: p.url(),
            title: p.title ? p.title() : ''
          }))
        };

      case 'switch_tab':
        const targetPages = this.context.pages();
        if (params.index >= 0 && params.index < targetPages.length) {
          this.agent.page = targetPages[params.index];
          await this.agent.page.bringToFront();
          return { url: this.agent.page.url() };
        }
        throw new Error(`Invalid tab index: ${params.index}`);

      case 'keyboard':
        await this.page.keyboard.press(params.key);
        return { pressed: params.key };

      case 'set_viewport':
        await this.page.setViewportSize({
          width: params.width || 1920,
          height: params.height || 1080
        });
        return { width: params.width, height: params.height };

      // ═══════════════════════════════════════════════════════════════════════
      // FILE SYSTEM OPERATIONS (for client: prefix routing)
      // ═══════════════════════════════════════════════════════════════════════

      case 'file_read':
        return this.fileRead(params);

      case 'file_write':
        return this.fileWrite(params);

      case 'file_list':
        return this.fileList(params);

      case 'file_delete':
        return this.fileDelete(params);

      case 'file_exists':
        return this.fileExists(params);

      case 'terminal_execute':
        return this.terminalExecute(params);

      case 'editor_open':
        return this.editorOpen(params);

      default:
        throw new Error(`Unknown command type: ${type}`);
    }
  }

  async navigate({ url, waitUntil = 'networkidle' }) {
    await this.page.goto(url, { waitUntil });
    return {
      url: this.page.url(),
      title: await this.page.title()
    };
  }

  async click({ selector, options = {} }) {
    await this.page.click(selector, options);
    return { clicked: selector };
  }

  async typeText({ selector, text, options = {} }) {
    if (selector) {
      await this.page.fill(selector, text);
    } else {
      await this.page.keyboard.type(text, options);
    }
    return { typed: text.length };
  }

  async screenshot({ fullPage = false, selector }) {
    let options = { type: 'png' };
    
    if (selector) {
      const element = await this.page.$(selector);
      if (element) {
        const buffer = await element.screenshot(options);
        return { screenshot: buffer.toString('base64') };
      }
      throw new Error(`Element not found: ${selector}`);
    }

    options.fullPage = fullPage;
    const buffer = await this.page.screenshot(options);
    return { screenshot: buffer.toString('base64') };
  }

  async getContent({ selector, type = 'text' }) {
    if (selector) {
      const element = await this.page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      switch (type) {
        case 'html':
          return { content: await element.innerHTML() };
        case 'outer':
          return { content: await element.evaluate(el => el.outerHTML) };
        default:
          return { content: await element.innerText() };
      }
    }

    // Get full page content
    const content = await this.page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      text: document.body.innerText,
      html: document.documentElement.outerHTML
    }));

    return content;
  }

  async executeScript({ script, args = [] }) {
    const result = await this.page.evaluate(script, ...args);
    return { result };
  }

  async wait({ selector, state = 'visible', timeout = 30000 }) {
    if (selector) {
      await this.page.waitForSelector(selector, { state, timeout });
      return { found: selector };
    }
    
    // Just wait for time
    await this.page.waitForTimeout(timeout);
    return { waited: timeout };
  }

  async scroll({ selector, x = 0, y = 0, direction }) {
    if (selector) {
      await this.page.evaluate(({ sel, scrollY }) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, { sel: selector, scrollY: y });
    } else if (direction) {
      switch (direction) {
        case 'down':
          await this.page.evaluate(() => window.scrollBy(0, 500));
          break;
        case 'up':
          await this.page.evaluate(() => window.scrollBy(0, -500));
          break;
        case 'bottom':
          await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          break;
        case 'top':
          await this.page.evaluate(() => window.scrollTo(0, 0));
          break;
      }
    } else {
      await this.page.evaluate(({ scrollX, scrollY }) => {
        window.scrollTo(scrollX, scrollY);
      }, { scrollX: x, scrollY: y });
    }

    return { scrolled: true };
  }

  async select({ selector, value, label, index }) {
    if (value) {
      await this.page.selectOption(selector, { value });
    } else if (label) {
      await this.page.selectOption(selector, { label });
    } else if (index !== undefined) {
      await this.page.selectOption(selector, { index });
    }
    return { selected: true };
  }

  async hover({ selector }) {
    await this.page.hover(selector);
    return { hovered: selector };
  }

  async getElement({ selector }) {
    const element = await this.page.$(selector);
    if (!element) {
      return { found: false };
    }

    const info = await element.evaluate(el => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      text: el.innerText?.substring(0, 500),
      value: el.value,
      href: el.href,
      src: el.src,
      type: el.type,
      checked: el.checked,
      disabled: el.disabled,
      attributes: Object.fromEntries(
        Array.from(el.attributes).map(a => [a.name, a.value])
      ),
      rect: el.getBoundingClientRect().toJSON()
    }));

    return { found: true, element: info };
  }

  async getElements({ selector, limit = 20 }) {
    const elements = await this.page.$$(selector);
    const results = [];

    for (let i = 0; i < Math.min(elements.length, limit); i++) {
      const info = await elements[i].evaluate(el => ({
        index: i,
        tagName: el.tagName,
        text: el.innerText?.substring(0, 200),
        href: el.href,
        value: el.value
      }));
      info.index = i;
      results.push(info);
    }

    return { count: elements.length, elements: results };
  }

  async fillForm({ selector, data }) {
    const form = selector ? await this.page.$(selector) : await this.page.$('form');
    
    if (!form) {
      throw new Error('Form not found');
    }

    for (const [field, value] of Object.entries(data)) {
      try {
        // Try different selectors
        const selectors = [
          `[name="${field}"]`,
          `#${field}`,
          `[id="${field}"]`,
          `[placeholder*="${field}" i]`
        ];

        let filled = false;
        for (const sel of selectors) {
          try {
            const element = await form.$(sel);
            if (element) {
              await element.fill(String(value));
              filled = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!filled) {
          console.warn(`Could not find field: ${field}`);
        }
      } catch (e) {
        console.warn(`Failed to fill ${field}:`, e.message);
      }
    }

    return { filled: Object.keys(data) };
  }

  async submitForm({ selector, method = 'click' }) {
    if (method === 'click') {
      // Find and click submit button
      const submitButton = await this.page.$(
        `${selector ? selector + ' ' : ''}[type="submit"], ` +
        `${selector ? selector + ' ' : ''}button:has-text("Submit"), ` +
        `${selector ? selector + ' ' : ''}button:has-text("Send")`
      );
      
      if (submitButton) {
        await submitButton.click();
      } else {
        throw new Error('Submit button not found');
      }
    } else {
      // Use form.submit()
      await this.page.evaluate((sel) => {
        const form = sel ? document.querySelector(sel) : document.querySelector('form');
        if (form) form.submit();
      }, selector);
    }

    // Wait for navigation
    await this.page.waitForLoadState('networkidle');
    
    return { 
      submitted: true,
      url: this.page.url()
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE SYSTEM OPERATIONS
  // These handle client: prefixed paths from the AI tools
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Read a file from the local filesystem
   */
  async fileRead({ path: filePath, encoding = 'utf8' }) {
    const resolvedPath = this.resolvePath(filePath);
    
    try {
      const content = await fs.readFile(resolvedPath, encoding);
      const stats = await fs.stat(resolvedPath);
      
      return {
        path: filePath,
        content,
        size: stats.size,
        modified: stats.mtime.toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Write a file to the local filesystem
   */
  async fileWrite({ path: filePath, content, permissions }) {
    const resolvedPath = this.resolvePath(filePath);
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      
      await fs.writeFile(resolvedPath, content, 'utf8');
      
      if (permissions) {
        await fs.chmod(resolvedPath, parseInt(permissions, 8));
      }
      
      const stats = await fs.stat(resolvedPath);
      
      return {
        path: filePath,
        size: stats.size,
        created: true
      };
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * List files in a directory
   */
  async fileList({ path: dirPath }) {
    const resolvedPath = this.resolvePath(dirPath || '.');
    
    try {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const files = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(resolvedPath, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        } catch {
          return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: 0,
            error: 'Could not stat'
          };
        }
      }));
      
      return { path: dirPath, files };
    } catch (error) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Delete a file
   */
  async fileDelete({ path: filePath }) {
    const resolvedPath = this.resolvePath(filePath);
    
    try {
      const stats = await fs.stat(resolvedPath);
      
      if (stats.isDirectory()) {
        await fs.rm(resolvedPath, { recursive: true });
      } else {
        await fs.unlink(resolvedPath);
      }
      
      return { path: filePath, deleted: true };
    } catch (error) {
      throw new Error(`Failed to delete: ${error.message}`);
    }
  }

  /**
   * Check if a file/directory exists
   */
  async fileExists({ path: filePath }) {
    const resolvedPath = this.resolvePath(filePath);
    
    try {
      const stats = await fs.stat(resolvedPath);
      return {
        path: filePath,
        exists: true,
        isDirectory: stats.isDirectory(),
        size: stats.size
      };
    } catch {
      return { path: filePath, exists: false };
    }
  }

  /**
   * Execute a terminal command
   */
  async terminalExecute({ command, cwd, timeout = 30000 }) {
    const options = {
      timeout,
      cwd: cwd ? this.resolvePath(cwd) : undefined,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    };
    
    try {
      const { stdout, stderr } = await execAsync(command, options);
      return {
        command,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0
      };
    } catch (error) {
      return {
        command,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
        exitCode: error.code || 1
      };
    }
  }

  /**
   * Open a file in the system's default editor
   */
  async editorOpen({ path: filePath }) {
    const resolvedPath = this.resolvePath(filePath);
    
    // Use xdg-open on Linux, open on macOS, start on Windows
    const platform = process.platform;
    let command;
    
    if (platform === 'darwin') {
      command = `open "${resolvedPath}"`;
    } else if (platform === 'win32') {
      command = `start "" "${resolvedPath}"`;
    } else {
      // Linux/Crostini
      command = `xdg-open "${resolvedPath}"`;
    }
    
    try {
      await execAsync(command);
      return { path: filePath, opened: true };
    } catch (error) {
      throw new Error(`Failed to open editor: ${error.message}`);
    }
  }

  /**
   * Resolve a path relative to home directory
   * Handles ~ expansion and relative paths
   */
  resolvePath(filePath) {
    if (!filePath) return process.cwd();
    
    // Expand ~ to home directory
    if (filePath.startsWith('~')) {
      return path.join(process.env.HOME || '/home', filePath.slice(1));
    }
    
    // Absolute paths stay as-is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    
    // Relative paths are relative to home
    return path.join(process.env.HOME || process.cwd(), filePath);
  }
}
