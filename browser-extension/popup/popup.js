/**
 * Meowstik Browser Extension - Popup Script
 * 
 * Main popup UI controller with:
 * - Chat interface
 * - Live Voice integration
 * - Screen capture for AI analysis
 * - Settings management
 */

const DEFAULT_SERVER_URL = 'wss://meowstik.replit.app';
const DEFAULT_AGENT_PORT = 9222;

class MeowstikPopup {
  constructor() {
    this.ws = null;
    this.settings = {};
    this.isVoiceActive = false;
    this.audioContext = null;
    this.mediaStream = null;
    this.audioWorklet = null;
    this.currentCapture = null;
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.setupTabs();
    
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
      agentPort: stored.agentPort || DEFAULT_AGENT_PORT,
      autoConnect: stored.autoConnect ?? true,
      voiceActivation: stored.voiceActivation ?? false,
      verbosityMode: stored.verbosityMode || 'verbose'
    };

    document.getElementById('server-url').value = this.settings.serverUrl;
    document.getElementById('agent-port').value = this.settings.agentPort;
    document.getElementById('auto-connect').checked = this.settings.autoConnect;
    document.getElementById('voice-activation').checked = this.settings.voiceActivation;
    document.getElementById('verbosity-mode').value = this.settings.verbosityMode;
  }

  async saveSettings() {
    this.settings = {
      serverUrl: document.getElementById('server-url').value || DEFAULT_SERVER_URL,
      agentPort: parseInt(document.getElementById('agent-port').value) || DEFAULT_AGENT_PORT,
      autoConnect: document.getElementById('auto-connect').checked,
      voiceActivation: document.getElementById('voice-activation').checked,
      verbosityMode: document.getElementById('verbosity-mode').value
    };

    await chrome.storage.local.set(this.settings);
    this.showNotification('Settings saved');
  }

  setupEventListeners() {
    document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    document.getElementById('voice-btn').addEventListener('click', () => this.toggleVoice());
    document.getElementById('mute-btn').addEventListener('click', () => this.toggleMute());
    document.getElementById('speaker-btn').addEventListener('click', () => this.toggleSpeaker());

    document.getElementById('capture-visible-btn').addEventListener('click', () => this.captureVisible());
    document.getElementById('capture-full-btn').addEventListener('click', () => this.captureFullPage());
    document.getElementById('capture-select-btn').addEventListener('click', () => this.selectElement());
    document.getElementById('analyze-capture-btn').addEventListener('click', () => this.analyzeCapture());

    document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
    document.getElementById('connect-btn').addEventListener('click', () => this.connect());

    document.getElementById('open-full-ui').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: this.settings.serverUrl.replace('wss://', 'https://').replace('ws://', 'http://') });
    });
  }

  setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-tab`).classList.remove('hidden');
      });
    });
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
      return;
    }

    const wsUrl = `${this.settings.serverUrl}/api/extension/connect`;
    this.updateConnectionStatus('connecting');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to Meowstik backend');
        this.updateConnectionStatus('connected');
        
        this.ws.send(JSON.stringify({
          type: 'extension_connected',
          capabilities: [
            'screen_capture',
            'page_content',
            'console_logs',
            'network_logs',
            'voice_input',
            'voice_output',
            'tab_control'
          ]
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleServerMessage(message);
        } catch (e) {
          console.error('Invalid message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from backend');
        this.updateConnectionStatus('disconnected');
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus('disconnected');
      };
    } catch (error) {
      console.error('Connection failed:', error);
      this.updateConnectionStatus('disconnected');
    }
  }

  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connection-status');
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');

    dot.className = 'status-dot ' + status;
    
    const labels = {
      connected: 'Connected',
      connecting: 'Connecting...',
      disconnected: 'Disconnected'
    };
    text.textContent = labels[status] || status;

    const connectBtn = document.getElementById('connect-btn');
    connectBtn.textContent = status === 'connected' ? 'Disconnect' : 'Connect';
  }

  handleServerMessage(message) {
    console.log('Server message:', message.type);

    switch (message.type) {
      case 'chat_response':
        this.addMessage(message.content, 'assistant');
        break;

      case 'voice_audio':
        this.playAudio(message.audio);
        break;

      case 'execute_command':
        this.executeCommand(message);
        break;

      case 'request_capture':
        this.captureAndSend(message.captureType);
        break;

      case 'request_page_content':
        this.sendPageContent();
        break;
    }
  }

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    if (!text) return;

    this.addMessage(text, 'user');
    input.value = '';

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'chat_message',
        content: text
      }));
    } else {
      chrome.runtime.sendMessage({
        type: 'chat_message',
        content: text
      });
    }
  }

  addMessage(content, role) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.textContent = content;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  async toggleVoice() {
    const btn = document.getElementById('voice-btn');
    const status = document.getElementById('voice-status');

    if (this.isVoiceActive) {
      this.stopVoice();
      btn.classList.remove('active');
      status.textContent = 'Press to start voice conversation';
    } else {
      await this.startVoice();
      btn.classList.add('active');
      status.textContent = 'Listening... speak now';
    }
  }

  async startVoice() {
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      await this.audioContext.audioWorklet.addModule(chrome.runtime.getURL('audio-processor.js'));
      this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-processor');
      
      this.audioWorklet.port.onmessage = (event) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'voice_audio',
            audio: event.data.audio
          }));
        }
      };

      source.connect(this.audioWorklet);
      this.isVoiceActive = true;
      
      this.startVisualization();
    } catch (error) {
      console.error('Failed to start voice:', error);
      this.showNotification('Microphone access denied');
    }
  }

  stopVoice() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioWorklet) {
      this.audioWorklet.disconnect();
      this.audioWorklet = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isVoiceActive = false;
  }

  startVisualization() {
    const canvas = document.getElementById('audio-canvas');
    const ctx = canvas.getContext('2d');
    
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!this.isVoiceActive) return;
      
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = '#16213e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        const hue = (i / bufferLength) * 60 + 340;
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };
    
    draw();
  }

  async playAudio(base64Audio) {
    try {
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }
      
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  toggleMute() {
    if (this.mediaStream) {
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      document.getElementById('mute-btn').textContent = audioTrack.enabled ? '🔇' : '🔈';
    }
  }

  toggleSpeaker() {
    console.log('Toggle speaker');
  }

  async captureVisible() {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      this.showCapture(dataUrl);
    } catch (error) {
      console.error('Capture failed:', error);
      this.showNotification('Failed to capture screen');
    }
  }

  async captureFullPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { type: 'capture_full_page' }, (response) => {
      if (response && response.dataUrl) {
        this.showCapture(response.dataUrl);
      } else {
        this.showNotification('Full page capture failed');
      }
    });
  }

  async selectElement() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { type: 'start_element_selection' });
    window.close();
  }

  showCapture(dataUrl) {
    this.currentCapture = dataUrl;
    const preview = document.getElementById('capture-preview');
    preview.innerHTML = `<img src="${dataUrl}" alt="Captured screen">`;
    document.getElementById('analyze-capture-btn').disabled = false;
  }

  async analyzeCapture() {
    if (!this.currentCapture) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'analyze_image',
        image: this.currentCapture.split(',')[1]
      }));
      
      this.showNotification('Analyzing with AI...');
      
      document.querySelector('.tab[data-tab="chat"]').click();
    } else {
      this.showNotification('Not connected to server');
    }
  }

  async captureAndSend(captureType) {
    let dataUrl;
    
    if (captureType === 'visible') {
      dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    }
    
    if (dataUrl && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'capture_result',
        captureType,
        image: dataUrl.split(',')[1]
      }));
    }
  }

  async sendPageContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { type: 'get_page_content' }, (response) => {
      if (response && this.ws) {
        this.ws.send(JSON.stringify({
          type: 'page_content',
          ...response
        }));
      }
    });
  }

  async executeCommand(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, {
      type: 'execute_command',
      command: message.command,
      params: message.params
    }, (response) => {
      if (this.ws) {
        this.ws.send(JSON.stringify({
          type: 'command_result',
          id: message.id,
          success: response?.success ?? false,
          result: response?.result,
          error: response?.error
        }));
      }
    });
  }

  showNotification(text) {
    console.log('Notification:', text);
  }
}

const popup = new MeowstikPopup();
