/**
 * Meowstik Browser Extension - Background Service Worker
 * 
 * Manages:
 * - Persistent WebSocket connection to Meowstik backend
 * - Communication between content scripts and popup
 * - Command execution routing to local-agent
 * - Screen capture coordination
 * - Keyboard shortcuts
 */

const DEFAULT_SERVER_URL = 'wss://meowstik.replit.app';

class BackgroundService {
  constructor() {
    this.ws = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.settings = {};
    this.pendingCommands = new Map();
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupMessageListeners();
    this.setupCommandListeners();
    this.setupContextMenus();
    
    if (this.settings.autoConnect) {
      this.connect();
    }
  }

  async loadSettings() {
    const stored = await chrome.storage.local.get([
      'serverUrl',
      'agentPort', 
      'autoConnect',
      'voiceActivation',
      'verbosityMode'
    ]);

    this.settings = {
      serverUrl: stored.serverUrl || DEFAULT_SERVER_URL,
      agentPort: stored.agentPort || 9222,
      autoConnect: stored.autoConnect ?? true,
      voiceActivation: stored.voiceActivation ?? false,
      verbosityMode: stored.verbosityMode || 'verbose'
    };
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = `${this.settings.serverUrl}/api/extension/connect`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Background] Connected to Meowstik');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        this.ws.send(JSON.stringify({
          type: 'extension_connected',
          source: 'background',
          capabilities: [
            'screen_capture',
            'page_content',
            'console_logs',
            'network_logs',
            'tab_control',
            'history_access',
            'bookmark_access',
            'downloads_access',
            'cookies_access'
          ]
        }));

        this.updateBadge('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleServerMessage(message);
        } catch (e) {
          console.error('[Background] Invalid message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[Background] WebSocket closed');
        this.isConnecting = false;
        this.updateBadge('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[Background] WebSocket error:', error);
        this.isConnecting = false;
        this.updateBadge('error');
      };
    } catch (error) {
      console.error('[Background] Connection failed:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Background] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`[Background] Reconnecting in ${delay/1000}s (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  updateBadge(status) {
    const colors = {
      connected: '#4ade80',
      disconnected: '#fbbf24',
      error: '#ef4444'
    };

    chrome.action.setBadgeBackgroundColor({ color: colors[status] || '#888' });
    chrome.action.setBadgeText({ text: status === 'connected' ? '' : '!' });
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleInternalMessage(message, sender, sendResponse);
      return true;
    });
  }

  setupCommandListeners() {
    chrome.commands.onCommand.addListener((command) => {
      switch (command) {
        case 'start-voice':
          this.startVoiceFromBackground();
          break;
        case 'capture-screen':
          this.captureScreenFromBackground();
          break;
      }
    });
  }

  setupContextMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'meowstik-analyze',
        title: 'Analyze with Meowstik AI',
        contexts: ['selection', 'image', 'page']
      });

      chrome.contextMenus.create({
        id: 'meowstik-explain',
        title: 'Explain this',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'meowstik-summarize',
        title: 'Summarize page',
        contexts: ['page']
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  async handleServerMessage(message) {
    console.log('[Background] Server message:', message.type);

    switch (message.type) {
      case 'capture_request':
        await this.captureAndSend(message);
        break;

      case 'page_content_request':
        await this.getPageContentAndSend(message);
        break;

      case 'execute_script':
        await this.executeScriptInTab(message);
        break;

      case 'navigate':
        await this.navigateTab(message);
        break;

      case 'tab_control':
        await this.controlTab(message);
        break;

      case 'click':
      case 'type':
      case 'scroll':
      case 'wait':
        await this.forwardToContentScript(message);
        break;

      case 'voice_response':
        this.broadcastToPopup({ type: 'voice_audio', audio: message.audio });
        break;

      case 'chat_response':
        this.broadcastToPopup({ type: 'chat_response', content: message.content });
        break;
    }
  }

  async handleInternalMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'get_connection_status':
        sendResponse({ connected: this.ws?.readyState === WebSocket.OPEN });
        break;

      case 'connect':
        this.connect();
        sendResponse({ success: true });
        break;

      case 'disconnect':
        if (this.ws) {
          this.ws.close();
        }
        sendResponse({ success: true });
        break;

      case 'chat_message':
        this.sendToServer({
          type: 'chat_message',
          content: message.content,
          tabId: sender.tab?.id
        });
        sendResponse({ success: true });
        break;

      case 'voice_audio':
        this.sendToServer({
          type: 'voice_audio',
          audio: message.audio
        });
        sendResponse({ success: true });
        break;

      case 'element_selected':
        this.sendToServer({
          type: 'element_selected',
          element: message.element,
          screenshot: message.screenshot
        });
        sendResponse({ success: true });
        break;

      case 'console_log':
        this.sendToServer({
          type: 'console_log',
          level: message.level,
          args: message.args,
          url: sender.tab?.url
        });
        break;

      case 'network_request':
        this.sendToServer({
          type: 'network_request',
          request: message.request
        });
        break;
    }
  }

  async handleContextMenuClick(info, tab) {
    let prompt = '';

    switch (info.menuItemId) {
      case 'meowstik-analyze':
        if (info.selectionText) {
          prompt = `Analyze this text: "${info.selectionText}"`;
        } else if (info.srcUrl) {
          prompt = `Analyze this image: ${info.srcUrl}`;
          const screenshot = await this.captureVisibleTab();
          this.sendToServer({
            type: 'analyze_image',
            image: screenshot.split(',')[1],
            context: prompt
          });
          return;
        } else {
          prompt = `Analyze this page: ${tab.url}`;
        }
        break;

      case 'meowstik-explain':
        prompt = `Explain this: "${info.selectionText}"`;
        break;

      case 'meowstik-summarize':
        prompt = `Summarize this page: ${tab.url}`;
        await this.getPageContentAndSend({ tabId: tab.id, summarize: true });
        return;
    }

    if (prompt) {
      this.sendToServer({
        type: 'chat_message',
        content: prompt,
        tabId: tab.id
      });
    }
  }

  async captureAndSend(message) {
    try {
      const dataUrl = await this.captureVisibleTab();
      
      this.sendToServer({
        type: 'capture_result',
        id: message.id,
        image: dataUrl.split(',')[1],
        captureType: message.captureType || 'visible'
      });
    } catch (error) {
      this.sendToServer({
        type: 'capture_error',
        id: message.id,
        error: error.message
      });
    }
  }

  async captureVisibleTab() {
    return chrome.tabs.captureVisibleTab(null, { format: 'png' });
  }

  async getPageContentAndSend(message) {
    const [tab] = message.tabId 
      ? [{ id: message.tabId }]
      : await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { type: 'get_page_content' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Content script error:', chrome.runtime.lastError);
        return;
      }

      this.sendToServer({
        type: 'page_content',
        id: message.id,
        url: response?.url,
        title: response?.title,
        content: response?.content,
        html: response?.html
      });
    });
  }

  async executeScriptInTab(message) {
    const [tab] = message.tabId
      ? [{ id: message.tabId }]
      : await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (script) => eval(script),
        args: [message.script]
      });

      this.sendToServer({
        type: 'script_result',
        id: message.id,
        success: true,
        result: result[0]?.result
      });
    } catch (error) {
      this.sendToServer({
        type: 'script_result',
        id: message.id,
        success: false,
        error: error.message
      });
    }
  }

  async navigateTab(message) {
    const [tab] = message.tabId
      ? [{ id: message.tabId }]
      : await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.tabs.update(tab.id, { url: message.url });

    this.sendToServer({
      type: 'navigate_result',
      id: message.id,
      success: true,
      url: message.url
    });
  }

  async controlTab(message) {
    try {
      let result;

      switch (message.action) {
        case 'new':
          result = await chrome.tabs.create({ url: message.url || 'about:blank' });
          break;

        case 'close':
          await chrome.tabs.remove(message.tabId);
          result = { closed: message.tabId };
          break;

        case 'reload':
          await chrome.tabs.reload(message.tabId);
          result = { reloaded: message.tabId };
          break;

        case 'list':
          result = await chrome.tabs.query({});
          break;

        case 'activate':
          await chrome.tabs.update(message.tabId, { active: true });
          result = { activated: message.tabId };
          break;
      }

      this.sendToServer({
        type: 'tab_control_result',
        id: message.id,
        success: true,
        result
      });
    } catch (error) {
      this.sendToServer({
        type: 'tab_control_result',
        id: message.id,
        success: false,
        error: error.message
      });
    }
  }

  async forwardToContentScript(message) {
    const [tab] = message.tabId
      ? [{ id: message.tabId }]
      : await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, {
      type: 'execute_command',
      command: message.type,
      params: message
    }, (response) => {
      this.sendToServer({
        type: 'command_result',
        id: message.id,
        success: response?.success ?? false,
        result: response?.result,
        error: response?.error
      });
    });
  }

  async startVoiceFromBackground() {
    chrome.runtime.sendMessage({ type: 'open_popup_voice' });
  }

  async captureScreenFromBackground() {
    const dataUrl = await this.captureVisibleTab();
    
    this.sendToServer({
      type: 'quick_capture',
      image: dataUrl.split(',')[1]
    });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Meowstik',
      message: 'Screen captured and sent to AI for analysis'
    });
  }

  sendToServer(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[Background] Not connected, message queued:', message.type);
    }
  }

  broadcastToPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {
    });
  }
}

const backgroundService = new BackgroundService();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    backgroundService.loadSettings();
  }
});
