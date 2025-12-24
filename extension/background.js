// Meowstik Extension Background Service Worker

const networkRequests = new Map();
const MAX_REQUESTS = 100;

// Initialize context menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'meowstik-analyze',
    title: 'Analyze with Meowstik',
    contexts: ['selection', 'page', 'image', 'link']
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

  chrome.contextMenus.create({
    id: 'meowstik-screenshot',
    title: 'Screenshot & Analyze',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { apiBase } = await chrome.storage.local.get(['apiBase']);
  const baseUrl = apiBase || 'https://meowstik.replit.app';

  let action, data;

  switch (info.menuItemId) {
    case 'meowstik-analyze':
      if (info.selectionText) {
        action = 'analyze_selection';
        data = { text: info.selectionText, url: tab.url };
      } else if (info.srcUrl) {
        action = 'analyze_image';
        data = { imageUrl: info.srcUrl, url: tab.url };
      } else if (info.linkUrl) {
        action = 'analyze_link';
        data = { linkUrl: info.linkUrl, url: tab.url };
      } else {
        action = 'analyze_page';
        data = { url: tab.url, title: tab.title };
      }
      break;

    case 'meowstik-explain':
      action = 'explain';
      data = { text: info.selectionText, url: tab.url };
      break;

    case 'meowstik-summarize':
      action = 'summarize';
      data = { url: tab.url, title: tab.title };
      break;

    case 'meowstik-screenshot':
      try {
        const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        action = 'analyze_screenshot';
        data = { screenshot, url: tab.url, title: tab.title };
      } catch (e) {
        console.error('Screenshot failed:', e);
        return;
      }
      break;
  }

  // Send to backend
  try {
    const response = await fetch(`${baseUrl}/api/extension/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });
    
    if (response.ok) {
      const result = await response.json();
      // Show notification or open side panel with result
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Meowstik',
        message: result.message || 'Analysis complete!'
      });
    }
  } catch (e) {
    console.error('Backend request failed:', e);
  }
});

// Capture network requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    
    const request = {
      id: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      timestamp: Date.now(),
      tabId: details.tabId
    };

    // Capture request body for POST/PUT
    if (details.requestBody) {
      if (details.requestBody.raw) {
        try {
          const decoder = new TextDecoder('utf-8');
          request.body = details.requestBody.raw.map(part => 
            part.bytes ? decoder.decode(part.bytes) : ''
          ).join('');
        } catch (e) {
          request.body = '[binary data]';
        }
      } else if (details.requestBody.formData) {
        request.body = details.requestBody.formData;
      }
    }

    networkRequests.set(details.requestId, request);
    
    // Limit stored requests
    if (networkRequests.size > MAX_REQUESTS) {
      const firstKey = networkRequests.keys().next().value;
      networkRequests.delete(firstKey);
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

// Capture response headers
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const request = networkRequests.get(details.requestId);
    if (request) {
      request.statusCode = details.statusCode;
      request.responseHeaders = details.responseHeaders;
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Capture request completion
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const request = networkRequests.get(details.requestId);
    if (request) {
      request.completed = true;
      request.duration = Date.now() - request.timestamp;
    }
  },
  { urls: ['<all_urls>'] }
);

// Capture request errors
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const request = networkRequests.get(details.requestId);
    if (request) {
      request.error = details.error;
    }
  },
  { urls: ['<all_urls>'] }
);

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getNetworkRequests') {
    const tabId = message.tabId;
    let requests = Array.from(networkRequests.values());
    
    if (tabId) {
      requests = requests.filter(r => r.tabId === tabId);
    }
    
    // Return most recent 50
    sendResponse(requests.slice(-50));
    return true;
  }

  if (message.action === 'clearNetworkRequests') {
    networkRequests.clear();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'captureScreen') {
    chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 90 })
      .then(dataUrl => sendResponse({ screenshot: dataUrl }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// WebSocket connection to local agent (if running)
let localAgentWs = null;

async function connectToLocalAgent() {
  const { localAgentUrl } = await chrome.storage.local.get(['localAgentUrl']);
  const wsUrl = localAgentUrl || 'ws://localhost:9222';

  try {
    localAgentWs = new WebSocket(wsUrl);
    
    localAgentWs.onopen = () => {
      console.log('Connected to local agent');
      localAgentWs.send(JSON.stringify({ type: 'extension_connected' }));
    };

    localAgentWs.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      handleLocalAgentMessage(message);
    };

    localAgentWs.onclose = () => {
      console.log('Disconnected from local agent');
      localAgentWs = null;
      // Reconnect after delay
      setTimeout(connectToLocalAgent, 5000);
    };

    localAgentWs.onerror = (error) => {
      console.log('Local agent connection error (agent may not be running)');
    };
  } catch (e) {
    console.log('Could not connect to local agent');
  }
}

async function handleLocalAgentMessage(message) {
  switch (message.type) {
    case 'capture_screen':
      const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      localAgentWs.send(JSON.stringify({ type: 'screenshot', data: screenshot, id: message.id }));
      break;

    case 'get_console_logs':
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: 'getConsoleLogs' }, (logs) => {
        localAgentWs.send(JSON.stringify({ type: 'console_logs', data: logs, id: message.id }));
      });
      break;

    case 'get_network':
      const requests = Array.from(networkRequests.values()).slice(-50);
      localAgentWs.send(JSON.stringify({ type: 'network_requests', data: requests, id: message.id }));
      break;

    case 'get_page_content':
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(activeTab.id, { action: 'getPageContent' }, (content) => {
        localAgentWs.send(JSON.stringify({ type: 'page_content', data: content, id: message.id }));
      });
      break;

    case 'execute_script':
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: new Function(message.script)
        });
        localAgentWs.send(JSON.stringify({ type: 'script_result', data: result, id: message.id }));
      } catch (e) {
        localAgentWs.send(JSON.stringify({ type: 'script_error', error: e.message, id: message.id }));
      }
      break;

    case 'navigate':
      const [navTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.update(navTab.id, { url: message.url });
      localAgentWs.send(JSON.stringify({ type: 'navigated', id: message.id }));
      break;

    case 'click':
      const [clickTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(clickTab.id, { action: 'click', selector: message.selector }, (result) => {
        localAgentWs.send(JSON.stringify({ type: 'clicked', data: result, id: message.id }));
      });
      break;

    case 'type':
      const [typeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(typeTab.id, { 
        action: 'type', 
        selector: message.selector, 
        text: message.text 
      }, (result) => {
        localAgentWs.send(JSON.stringify({ type: 'typed', data: result, id: message.id }));
      });
      break;
  }
}

// Try to connect to local agent on startup
connectToLocalAgent();

console.log('Meowstik background service worker initialized');
