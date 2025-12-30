const serverUrlInput = document.getElementById('server-url');
const connectBtn = document.getElementById('connect-btn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const connectionSection = document.getElementById('connection-section');
const chatSection = document.getElementById('chat-section');
const toolsSection = document.getElementById('tools-section');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const captureBtn = document.getElementById('capture-btn');

let isConnected = false;
let serverUrl = '';
let sessionId = null;
let extensionToken = null;

async function init() {
  const stored = await chrome.storage.local.get(['serverUrl', 'sessionId', 'extensionToken']);
  if (stored.serverUrl) {
    serverUrlInput.value = stored.serverUrl;
  }
  if (stored.sessionId && stored.extensionToken) {
    sessionId = stored.sessionId;
    extensionToken = stored.extensionToken;
    serverUrl = stored.serverUrl;
    await checkConnection();
  }
}

function getAuthHeaders() {
  return extensionToken ? { 'X-Extension-Token': extensionToken } : {};
}

async function checkConnection() {
  try {
    const response = await fetch(`${serverUrl}/api/status`);
    if (response.ok) {
      setConnected(true);
    } else {
      setConnected(false);
    }
  } catch (error) {
    setConnected(false);
  }
}

function setConnected(connected) {
  isConnected = connected;
  if (connected) {
    statusDot.classList.add('connected');
    statusDot.classList.remove('disconnected');
    statusText.textContent = 'Connected';
    connectionSection.classList.add('hidden');
    chatSection.classList.remove('hidden');
    toolsSection.classList.remove('hidden');
  } else {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
    connectionSection.classList.remove('hidden');
    chatSection.classList.add('hidden');
    toolsSection.classList.add('hidden');
  }
}

function addMessage(content, role) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;
  msg.textContent = content;
  messagesContainer.appendChild(msg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !isConnected) return;

  addMessage(text, 'user');
  messageInput.value = '';

  try {
    const response = await fetch(`${serverUrl}/api/extension/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ message: text, sessionId }),
    });

    if (response.ok) {
      const data = await response.json();
      addMessage(data.response || 'No response', 'ai');
    } else {
      addMessage('Failed to get response', 'system');
    }
  } catch (error) {
    addMessage('Connection error', 'system');
  }
}

async function captureScreenshot() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    
    const response = await fetch(`${serverUrl}/api/extension/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ 
        image: screenshot,
        url: tab.url,
        title: tab.title,
        sessionId,
      }),
    });

    if (response.ok) {
      addMessage('Screenshot captured and sent to AI', 'system');
    }
  } catch (error) {
    addMessage('Failed to capture screenshot', 'system');
  }
}

async function extractPageContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText,
    });

    const response = await fetch(`${serverUrl}/api/extension/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        content: result.result,
        url: tab.url,
        title: tab.title,
        sessionId,
      }),
    });

    if (response.ok) {
      addMessage('Page content extracted', 'system');
    }
  } catch (error) {
    addMessage('Failed to extract content', 'system');
  }
}

async function getConsoleLogs() {
  chrome.runtime.sendMessage({ type: 'GET_CONSOLE_LOGS' }, (response) => {
    if (response && response.logs) {
      addMessage(`Captured ${response.logs.length} console entries`, 'system');
    }
  });
}

async function getNetworkRequests() {
  chrome.runtime.sendMessage({ type: 'GET_NETWORK_REQUESTS' }, (response) => {
    if (response && response.requests) {
      addMessage(`Captured ${response.requests.length} network requests`, 'system');
    }
  });
}

connectBtn.addEventListener('click', async () => {
  serverUrl = serverUrlInput.value.trim();
  if (!serverUrl) return;

  try {
    const registerResponse = await fetch(`${serverUrl}/api/extension/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!registerResponse.ok) {
      throw new Error('Failed to register extension');
    }

    const registerData = await registerResponse.json();
    extensionToken = registerData.token;

    const response = await fetch(`${serverUrl}/api/extension/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ source: 'extension' }),
    });

    if (response.ok) {
      const data = await response.json();
      sessionId = data.sessionId;
      await chrome.storage.local.set({ serverUrl, sessionId, extensionToken });
      setConnected(true);
      addMessage('Connected to Meowstik server', 'system');
    }
  } catch (error) {
    addMessage('Failed to connect', 'system');
  }
});

sendBtn.addEventListener('click', sendMessage);
captureBtn.addEventListener('click', captureScreenshot);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById('tool-screenshot').addEventListener('click', captureScreenshot);
document.getElementById('tool-extract').addEventListener('click', extractPageContent);
document.getElementById('tool-console').addEventListener('click', getConsoleLogs);
document.getElementById('tool-network').addEventListener('click', getNetworkRequests);

init();
