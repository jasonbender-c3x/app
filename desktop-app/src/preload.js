const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (event, path) => callback(path));
  },
  
  onNewChat: (callback) => {
    ipcRenderer.on('new-chat', () => callback());
  },
  
  startLocalAgent: () => ipcRenderer.invoke('start-local-agent'),
  stopLocalAgent: () => ipcRenderer.invoke('stop-local-agent'),
  getLocalAgentStatus: () => ipcRenderer.invoke('get-local-agent-status'),
  
  onLocalAgentLog: (callback) => {
    ipcRenderer.on('local-agent-log', (event, log) => callback(log));
  },
  
  executeTerminal: (options) => ipcRenderer.invoke('execute-terminal', options),
  
  fileRead: (options) => ipcRenderer.invoke('file-read', options),
  fileWrite: (options) => ipcRenderer.invoke('file-write', options),
  fileList: (options) => ipcRenderer.invoke('file-list', options),
  
  platform: process.platform,
  isElectron: true
});

console.log('Meowstik Desktop preload script loaded');
