// Meowstik Extension Popup

const API_BASE = 'https://meowstik.replit.app'; // Will be configurable

class MeowstikPopup {
  constructor() {
    this.messages = [];
    this.isConnected = false;
    this.currentTab = null;
    this.init();
  }

  async init() {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;

    // Load settings
    await this.loadSettings();

    // Check connection
    await this.checkConnection();

    // Bind events
    this.bindEvents();
  }

  async loadSettings() {
    const result = await chrome.storage.local.get(['apiBase', 'authToken']);
    if (result.apiBase) {
      this.apiBase = result.apiBase;
    } else {
      this.apiBase = API_BASE;
    }
    this.authToken = result.authToken || null;
  }

  async checkConnection() {
    const statusEl = document.getElementById('status');
    try {
      // Try the extension action endpoint as a health check
      const response = await fetch(`${this.apiBase}/api/extension/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping' })
      });
      if (response.ok) {
        this.isConnected = true;
        statusEl.className = 'status connected';
        statusEl.querySelector('.status-text').textContent = 'Connected';
      } else {
        throw new Error('Not connected');
      }
    } catch (e) {
      this.isConnected = false;
      statusEl.className = 'status error';
      statusEl.querySelector('.status-text').textContent = 'Offline';
    }
  }

  bindEvents() {
    // Send message
    document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
    document.getElementById('userInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Quick actions
    document.getElementById('captureScreen').addEventListener('click', () => this.captureScreen());
    document.getElementById('analyzeConsole').addEventListener('click', () => this.analyzeConsole());
    document.getElementById('inspectNetwork').addEventListener('click', () => this.inspectNetwork());
    document.getElementById('analyzePage').addEventListener('click', () => this.analyzePage());

    // Workspace actions
    document.getElementById('addCalendar').addEventListener('click', () => this.quickAction('calendar'));
    document.getElementById('saveDrive').addEventListener('click', () => this.quickAction('drive'));
    document.getElementById('createTask').addEventListener('click', () => this.quickAction('task'));
    document.getElementById('sendEmail').addEventListener('click', () => this.quickAction('email'));

    // Footer
    document.getElementById('openApp').addEventListener('click', () => {
      chrome.tabs.create({ url: this.apiBase });
    });
    document.getElementById('settings').addEventListener('click', () => this.showSettings());
  }

  async captureScreen() {
    try {
      this.addMessage('user', '📷 Capture screen and analyze');
      this.addMessage('assistant', '<div class="loading"></div> Capturing screen...');

      // Capture visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 90 });

      // Send to backend for analysis
      const response = await this.sendToBackend({
        action: 'analyze_screenshot',
        screenshot: dataUrl,
        url: this.currentTab.url,
        title: this.currentTab.title
      });

      this.updateLastMessage(response.message || 'Screenshot captured and analyzed!');
    } catch (error) {
      this.updateLastMessage(`Error: ${error.message}`, true);
    }
  }

  async analyzeConsole() {
    try {
      this.addMessage('user', '🔧 Analyze console logs');
      this.addMessage('assistant', '<div class="loading"></div> Fetching console logs...');

      // Request console logs from content script
      const logs = await this.sendToContentScript({ action: 'getConsoleLogs' });

      if (logs && logs.length > 0) {
        const response = await this.sendToBackend({
          action: 'analyze_console',
          logs: logs,
          url: this.currentTab.url
        });
        this.updateLastMessage(response.message || `Found ${logs.length} console entries`);
      } else {
        this.updateLastMessage('No console logs captured yet. Enable DevTools mode to start capturing.');
      }
    } catch (error) {
      this.updateLastMessage(`Error: ${error.message}`, true);
    }
  }

  async inspectNetwork() {
    try {
      this.addMessage('user', '🌐 Inspect network requests');
      this.addMessage('assistant', '<div class="loading"></div> Fetching network data...');

      // Get network requests from background
      const requests = await chrome.runtime.sendMessage({ action: 'getNetworkRequests' });

      if (requests && requests.length > 0) {
        const response = await this.sendToBackend({
          action: 'analyze_network',
          requests: requests,
          url: this.currentTab.url
        });
        this.updateLastMessage(response.message || `Analyzed ${requests.length} network requests`);
      } else {
        this.updateLastMessage('No network requests captured. They will be recorded as you browse.');
      }
    } catch (error) {
      this.updateLastMessage(`Error: ${error.message}`, true);
    }
  }

  async analyzePage() {
    try {
      this.addMessage('user', '📄 Analyze this page');
      this.addMessage('assistant', '<div class="loading"></div> Extracting page content...');

      // Get page content from content script
      const pageData = await this.sendToContentScript({ action: 'getPageContent' });

      const response = await this.sendToBackend({
        action: 'analyze_page',
        content: pageData,
        url: this.currentTab.url,
        title: this.currentTab.title
      });

      this.updateLastMessage(response.message || 'Page analyzed!');
    } catch (error) {
      this.updateLastMessage(`Error: ${error.message}`, true);
    }
  }

  async quickAction(type) {
    try {
      const pageData = await this.sendToContentScript({ action: 'getPageContent' });
      
      this.addMessage('user', `Quick action: ${type}`);
      this.addMessage('assistant', '<div class="loading"></div> Processing...');

      const response = await this.sendToBackend({
        action: 'quick_action',
        type: type,
        pageContent: pageData,
        url: this.currentTab.url,
        title: this.currentTab.title
      });

      this.updateLastMessage(response.message || 'Action completed!');
    } catch (error) {
      this.updateLastMessage(`Error: ${error.message}`, true);
    }
  }

  async sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    this.addMessage('user', message);
    this.addMessage('assistant', '<div class="loading"></div>');

    try {
      const includeContext = document.getElementById('includeContext').checked;
      let context = null;

      if (includeContext) {
        context = await this.sendToContentScript({ action: 'getPageContent' });
      }

      const response = await this.sendToBackend({
        action: 'chat',
        message: message,
        context: context,
        url: this.currentTab.url,
        title: this.currentTab.title
      });

      this.updateLastMessage(response.message || 'No response');
    } catch (error) {
      this.updateLastMessage(`Error: ${error.message}`, true);
    }
  }

  async sendToContentScript(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(this.currentTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async sendToBackend(data) {
    const response = await fetch(`${this.apiBase}/api/extension/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    return response.json();
  }

  addMessage(role, content) {
    const messagesEl = document.getElementById('messages');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    messageEl.innerHTML = `<p>${content}</p>`;
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  updateLastMessage(content, isError = false) {
    const messagesEl = document.getElementById('messages');
    const lastMessage = messagesEl.lastElementChild;
    if (lastMessage) {
      lastMessage.innerHTML = `<p>${content}</p>`;
      if (isError) {
        lastMessage.classList.add('error');
      }
    }
  }

  showSettings() {
    // Simple prompt for now - could be a separate page
    const newBase = prompt('Enter Meowstik API URL:', this.apiBase);
    if (newBase) {
      this.apiBase = newBase;
      chrome.storage.local.set({ apiBase: newBase });
      this.checkConnection();
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new MeowstikPopup();
});
