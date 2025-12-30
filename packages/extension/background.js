const consoleLogs = new Map();
const networkRequests = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'meowstik-ask',
    title: 'Ask Meowstik about this',
    contexts: ['selection', 'image', 'link'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'meowstik-ask') {
    const stored = await chrome.storage.local.get(['serverUrl', 'sessionId']);
    if (!stored.serverUrl) return;

    let content = '';
    if (info.selectionText) {
      content = `Selected text: "${info.selectionText}"`;
    } else if (info.srcUrl) {
      content = `Image URL: ${info.srcUrl}`;
    } else if (info.linkUrl) {
      content = `Link: ${info.linkUrl}`;
    }

    try {
      await fetch(`${stored.serverUrl}/api/extension/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          pageUrl: tab.url,
          pageTitle: tab.title,
          sessionId: stored.sessionId,
        }),
      });
    } catch (error) {
      console.error('[Meowstik] Context menu action failed:', error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONSOLE_LOG') {
    const tabId = sender.tab?.id;
    if (tabId) {
      if (!consoleLogs.has(tabId)) {
        consoleLogs.set(tabId, []);
      }
      consoleLogs.get(tabId).push(message.data);
      if (consoleLogs.get(tabId).length > 100) {
        consoleLogs.get(tabId).shift();
      }
    }
  }

  if (message.type === 'GET_CONSOLE_LOGS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      sendResponse({ logs: consoleLogs.get(tabId) || [] });
    });
    return true;
  }

  if (message.type === 'GET_NETWORK_REQUESTS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      sendResponse({ requests: networkRequests.get(tabId) || [] });
    });
    return true;
  }
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const tabId = details.tabId;
    if (tabId > 0) {
      if (!networkRequests.has(tabId)) {
        networkRequests.set(tabId, []);
      }
      networkRequests.get(tabId).push({
        url: details.url,
        method: details.method,
        statusCode: details.statusCode,
        type: details.type,
        timestamp: Date.now(),
      });
      if (networkRequests.get(tabId).length > 50) {
        networkRequests.get(tabId).shift();
      }
    }
  },
  { urls: ['<all_urls>'] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  consoleLogs.delete(tabId);
  networkRequests.delete(tabId);
});
