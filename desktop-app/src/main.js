const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let tray = null;
let backendProcess = null;
let backendPort = 5001;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development';

function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', '..', relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

async function waitForBackend(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/api/status`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log(`Backend ready on port ${port}`);
      return true;
    } catch (e) {
      console.log(`Waiting for backend... attempt ${i + 1}/${maxAttempts}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

async function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = getResourcePath('server');
    const env = {
      ...process.env,
      PORT: backendPort.toString(),
      NODE_ENV: 'production',
      DATABASE_URL: process.env.DATABASE_URL || ''
    };

    console.log(`Starting backend from: ${serverPath}`);

    backendProcess = spawn('npx', ['tsx', 'index.ts'], {
      cwd: serverPath,
      env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString()}`);
    });

    backendProcess.on('error', (error) => {
      console.error('Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      if (!isQuitting) {
        dialog.showErrorBox('Backend Error', 'The backend server has stopped unexpectedly.');
      }
    });

    waitForBackend(backendPort).then((ready) => {
      if (ready) {
        resolve();
      } else {
        reject(new Error('Backend failed to start'));
      }
    });
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Meowstik',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  mainWindow.loadURL(`http://localhost:${backendPort}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    console.log('Tray icon not found, using default');
    tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.png'));
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Meowstik',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('navigate', '/settings');
        }
      }
    },
    {
      label: 'Backend Status',
      click: async () => {
        const ready = await waitForBackend(backendPort, 1);
        dialog.showMessageBox({
          type: ready ? 'info' : 'warning',
          title: 'Backend Status',
          message: ready ? 'Backend is running' : 'Backend is not responding',
          detail: `Port: ${backendPort}`
        });
      }
    },
    { type: 'separator' },
    {
      label: 'Restart Backend',
      click: async () => {
        stopBackend();
        try {
          await startBackend();
          if (mainWindow) {
            mainWindow.reload();
          }
        } catch (e) {
          dialog.showErrorBox('Error', 'Failed to restart backend');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Meowstik - AI Chat Assistant');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('new-chat');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate', '/settings');
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/jasonbender-c3x/meowstik');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/jasonbender-c3x/meowstik/issues');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle('get-backend-url', () => {
  return `http://localhost:${backendPort}`;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  return dialog.showOpenDialog(mainWindow, options);
});

app.whenReady().then(async () => {
  console.log('Meowstik Desktop starting...');
  
  try {
    await startBackend();
    console.log('Backend started successfully');
  } catch (error) {
    console.error('Failed to start backend:', error);
    dialog.showErrorBox(
      'Startup Error',
      'Failed to start the backend server. Please check your configuration.'
    );
  }

  createTray();
  createMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'linux') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackend();
});

app.on('will-quit', () => {
  stopBackend();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  stopBackend();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
});
