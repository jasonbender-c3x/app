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
  
  platform: process.platform,
  isElectron: true
});

console.log('Meowstik Desktop preload script loaded');
