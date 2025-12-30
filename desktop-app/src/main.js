/**
 * =============================================================================
 * MEOWSTIK DESKTOP - ELECTRON MAIN PROCESS
 * =============================================================================
 * 
 * 🎓 TEACHING TOOL: This is the main entry point for the Electron desktop app.
 * 
 * WHAT THIS FILE DOES:
 * --------------------
 * 1. Starts the Node.js backend server
 * 2. Creates the main application window
 * 3. Adds a system tray icon for quick access
 * 4. Handles menu and keyboard shortcuts
 * 
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * ┌─────────────────────────────────────────────────────────┐
 * │                   ELECTRON APP                          │
 * │  ┌──────────────┐     ┌──────────────────────────────┐  │
 * │  │  Main Process │────▶│  Renderer Process (Browser)  │  │
 * │  │  (This file) │     │  (React Frontend)            │  │
 * │  └──────┬───────┘     └──────────────────────────────┘  │
 * │         │                                                │
 * │         ▼                                                │
 * │  ┌──────────────┐                                       │
 * │  │Backend Server│ ◀─── HTTP API ────┘                   │
 * │  │  (Express)   │                                       │
 * │  └──────────────┘                                       │
 * └─────────────────────────────────────────────────────────┘
 * 
 * PORTABILITY NOTES:
 * ------------------
 * This code is designed to run on multiple platforms:
 * - Linux desktop (primary target)
 * - macOS (with minor modifications)
 * - Windows (with electron-builder config changes)
 * - Google Cloud (backend only, no Electron)
 * - Colab notebooks (backend only, use memory adapter)
 * 
 * ENVIRONMENT VARIABLES:
 * ----------------------
 * GEMINI_API_KEY        - Required for AI features
 * DATABASE_URL          - PostgreSQL connection (optional, uses memory if not set)
 * VECTOR_STORE_BACKEND  - 'pgvector' | 'vertex' | 'memory'
 * PORT                  - Backend server port (default: 5001)
 * =============================================================================
 */

// =============================================================================
// IMPORTS - Core Electron and Node.js modules
// =============================================================================
const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// =============================================================================
// GLOBAL STATE
// =============================================================================
// These variables track the app's state across the lifecycle

let mainWindow = null;       // The main browser window
let tray = null;             // System tray icon
let backendProcess = null;   // Child process running the Express server
let backendPort = 5001;      // Port for the backend (5000 is used by frontend in dev)
let isQuitting = false;      // Flag to handle graceful shutdown

// Detect if we're in development mode (for DevTools, hot reload, etc.)
const isDev = process.env.NODE_ENV === 'development';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the correct path to resources in dev vs production
 * 
 * 🎓 TEACHING NOTE:
 * In development, resources are relative to the source directory.
 * In production (packaged app), they're in a special 'resources' folder.
 * This function handles both cases seamlessly.
 */
function getResourcePath(relativePath) {
  if (isDev) {
    // In dev, go up from src/ to the project root
    return path.join(__dirname, '..', '..', relativePath);
  }
  // In production, use Electron's resourcesPath
  return path.join(process.resourcesPath, relativePath);
}

/**
 * Wait for the backend server to be ready
 * 
 * 🎓 TEACHING NOTE:
 * This implements a "polling" pattern - repeatedly checking if a server is up.
 * It's a simple way to ensure the backend is ready before loading the UI.
 * 
 * @param {number} port - The port to check
 * @param {number} maxAttempts - Maximum number of attempts before giving up
 * @returns {Promise<boolean>} - True if backend is ready, false otherwise
 */
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
      console.log(`✅ Backend ready on port ${port}`);
      return true;
    } catch (e) {
      console.log(`⏳ Waiting for backend... attempt ${i + 1}/${maxAttempts}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

// =============================================================================
// BACKEND SERVER MANAGEMENT
// =============================================================================

/**
 * Start the Express backend server as a child process
 * 
 * 🎓 TEACHING NOTE:
 * We spawn the backend as a separate process for several reasons:
 * 1. Process isolation - Backend crashes don't crash the UI
 * 2. Easy restart - Can restart backend without restarting Electron
 * 3. Portability - Same backend code works in Electron, Cloud, or Colab
 * 
 * The backend uses:
 * - Express.js for HTTP API
 * - PostgreSQL/pgvector for data (or in-memory for offline use)
 * - Google Gemini for AI features
 */
async function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = getResourcePath('server');
    
    // Build environment variables for the backend
    // These can be overridden by the user's .env file
    const env = {
      ...process.env,
      PORT: backendPort.toString(),
      NODE_ENV: 'production',
      // Use the default vector store detection
      // It will auto-detect: pgvector if DATABASE_URL is set,
      // vertex if GOOGLE_CLOUD_PROJECT is set, otherwise memory
    };

    console.log(`🚀 Starting backend from: ${serverPath}`);
    console.log(`   Port: ${backendPort}`);
    console.log(`   Vector Store: ${env.VECTOR_STORE_BACKEND || '(auto-detect)'}`);

    // Spawn the backend using tsx (TypeScript executor)
    backendProcess = spawn('npx', ['tsx', 'index.ts'], {
      cwd: serverPath,
      env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Log backend output (useful for debugging)
    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (error) => {
      console.error('❌ Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      if (!isQuitting) {
        // Unexpected exit - show error to user
        dialog.showErrorBox('Backend Error', 
          'The backend server has stopped unexpectedly.\n\n' +
          'Please check the logs for more information.'
        );
      }
    });

    // Wait for the backend to be ready before resolving
    waitForBackend(backendPort).then((ready) => {
      if (ready) {
        resolve();
      } else {
        reject(new Error('Backend failed to start within timeout'));
      }
    });
  });
}

/**
 * Stop the backend server gracefully
 * 
 * 🎓 TEACHING NOTE:
 * We use SIGTERM to allow the server to clean up (close DB connections, etc.)
 * This is more graceful than SIGKILL which would terminate immediately.
 */
function stopBackend() {
  if (backendProcess) {
    console.log('🛑 Stopping backend...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

// =============================================================================
// WINDOW MANAGEMENT
// =============================================================================

/**
 * Create the main application window
 * 
 * 🎓 TEACHING NOTE:
 * BrowserWindow is Electron's way of creating a native window that runs
 * a web page. It's essentially a Chromium browser embedded in your app.
 * 
 * Key concepts:
 * - preload.js: Bridge between Node.js and the browser context
 * - contextIsolation: Security feature preventing renderer access to Node.js
 * - nodeIntegration: Disabled for security (use preload instead)
 */
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
      nodeIntegration: false,    // Security: Don't expose Node.js to renderer
      contextIsolation: true     // Security: Isolate preload scripts
    },
    show: false  // Don't show until ready (prevents flash of white screen)
  });

  // Load the frontend from our backend server
  mainWindow.loadURL(`http://localhost:${backendPort}`);

  // Show window only when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window close - hide to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();  // Just hide, don't actually close
    }
  });

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// =============================================================================
// SYSTEM TRAY
// =============================================================================

/**
 * Create the system tray icon and menu
 * 
 * 🎓 TEACHING NOTE:
 * The system tray provides:
 * 1. Quick access when the window is hidden
 * 2. Status indicator (is the app running?)
 * 3. Essential controls without opening the main window
 * 
 * On Linux, this typically appears in the top panel.
 */
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    console.log('Tray icon not found, using main icon');
    tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.png'));
  }

  // Build the context menu (right-click menu)
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
          message: ready ? '✅ Backend is running' : '❌ Backend is not responding',
          detail: `Port: ${backendPort}\nVector Store: ${process.env.VECTOR_STORE_BACKEND || 'auto-detect'}`
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

  // Click on tray icon to show/focus window
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

// =============================================================================
// APPLICATION MENU
// =============================================================================

/**
 * Create the application menu bar
 * 
 * 🎓 TEACHING NOTE:
 * The menu bar provides:
 * 1. Standard operations (File, Edit, View, Help)
 * 2. Keyboard shortcuts (accelerators)
 * 3. Native look and feel
 */
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
        // Only show DevTools in development
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
        },
        { type: 'separator' },
        {
          label: 'About Vector Store',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Vector Store System',
              message: 'Modular RAG Storage',
              detail: 
                'This app supports multiple vector storage backends:\n\n' +
                '• pgvector - PostgreSQL with vector extension\n' +
                '• Vertex AI - Google Cloud managed RAG\n' +
                '• In-Memory - For testing and Colab\n\n' +
                'Set VECTOR_STORE_BACKEND environment variable to switch.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// =============================================================================
// IPC HANDLERS - Communication between main and renderer process
// =============================================================================

/**
 * 🎓 TEACHING NOTE:
 * IPC (Inter-Process Communication) is how the renderer (browser) talks
 * to the main process (Node.js). The renderer can't directly access Node.js
 * APIs for security reasons, so we use ipcMain.handle() to expose specific
 * functions safely.
 */

// Get the backend URL (useful for making API calls from renderer)
ipcMain.handle('get-backend-url', () => {
  return `http://localhost:${backendPort}`;
});

// Get app version from package.json
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Show native save file dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  return dialog.showSaveDialog(mainWindow, options);
});

// Show native open file dialog
ipcMain.handle('show-open-dialog', async (event, options) => {
  return dialog.showOpenDialog(mainWindow, options);
});

// =============================================================================
// EXTENSION BRIDGE - IPC for browser extension communication
// =============================================================================

let localAgentProcess = null;

/**
 * Start the local-agent for Playwright automation
 */
ipcMain.handle('start-local-agent', async () => {
  if (localAgentProcess) {
    return { success: true, message: 'Local agent already running' };
  }

  const agentPath = getResourcePath('local-agent');
  
  try {
    localAgentProcess = spawn('node', ['src/index.js'], {
      cwd: agentPath,
      env: { ...process.env, PORT: '9222' },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    localAgentProcess.stdout.on('data', (data) => {
      console.log(`[LocalAgent] ${data.toString().trim()}`);
      if (mainWindow) {
        mainWindow.webContents.send('local-agent-log', data.toString());
      }
    });

    localAgentProcess.stderr.on('data', (data) => {
      console.error(`[LocalAgent Error] ${data.toString().trim()}`);
    });

    localAgentProcess.on('close', (code) => {
      console.log(`Local agent exited with code ${code}`);
      localAgentProcess = null;
    });

    return { success: true, message: 'Local agent started on port 9222' };
  } catch (error) {
    console.error('Failed to start local agent:', error);
    return { success: false, message: error.message };
  }
});

/**
 * Stop the local-agent
 */
ipcMain.handle('stop-local-agent', () => {
  if (localAgentProcess) {
    localAgentProcess.kill('SIGTERM');
    localAgentProcess = null;
    return { success: true };
  }
  return { success: false, message: 'Agent not running' };
});

/**
 * Get local-agent status
 */
ipcMain.handle('get-local-agent-status', () => {
  return { running: localAgentProcess !== null };
});

/**
 * Execute terminal command (for extension bridge)
 * 
 * SECURITY: Only allow whitelisted commands to prevent command injection
 */
const ALLOWED_COMMANDS = new Set([
  'ls', 'pwd', 'whoami', 'date', 'cat', 'head', 'tail', 'wc',
  'grep', 'find', 'which', 'echo', 'node', 'npm', 'git'
]);

ipcMain.handle('execute-terminal', async (event, { command, args, cwd }) => {
  // Validate command is a single whitelisted executable
  if (!command || typeof command !== 'string') {
    return { exitCode: -1, stdout: '', stderr: 'Invalid command' };
  }
  
  // Extract base command (first word)
  const baseCommand = command.split(/\s+/)[0];
  
  if (!ALLOWED_COMMANDS.has(baseCommand)) {
    return { exitCode: -1, stdout: '', stderr: `Command not allowed: ${baseCommand}` };
  }
  
  // Validate cwd is a safe path (no path traversal)
  const safeCwd = cwd && typeof cwd === 'string' 
    ? cwd.replace(/\.\./g, '').replace(/~|\$/g, '') 
    : process.env.HOME;
  
  return new Promise((resolve) => {
    // Use spawn without shell:true for safer execution
    const cmdParts = command.split(/\s+/);
    const proc = spawn(cmdParts[0], cmdParts.slice(1), {
      cwd: safeCwd,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      resolve({ exitCode: code, stdout, stderr });
    });

    proc.on('error', (error) => {
      resolve({ exitCode: -1, stdout: '', stderr: error.message });
    });
  });
});

/**
 * File operations for extension bridge
 * 
 * SECURITY: Validate paths to prevent directory traversal attacks
 */
function validatePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return null;
  
  // Normalize and resolve the path
  const resolved = path.resolve(inputPath);
  
  // Only allow access within home directory or /tmp
  const homeDir = process.env.HOME || '/home';
  const tmpDir = '/tmp';
  
  if (resolved.startsWith(homeDir) || resolved.startsWith(tmpDir)) {
    return resolved;
  }
  
  return null;
}

ipcMain.handle('file-read', async (event, { path: filePath }) => {
  const fs = require('fs').promises;
  const safePath = validatePath(filePath);
  
  if (!safePath) {
    return { success: false, error: 'Access denied: path outside allowed directories' };
  }
  
  try {
    const content = await fs.readFile(safePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file-write', async (event, { path: filePath, content }) => {
  const fs = require('fs').promises;
  const safePath = validatePath(filePath);
  
  if (!safePath) {
    return { success: false, error: 'Access denied: path outside allowed directories' };
  }
  
  try {
    await fs.writeFile(safePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file-list', async (event, { path: dirPath }) => {
  const fs = require('fs').promises;
  const safePath = validatePath(dirPath);
  
  if (!safePath) {
    return { success: false, error: 'Access denied: path outside allowed directories' };
  }
  
  try {
    const entries = await fs.readdir(safePath, { withFileTypes: true });
    const files = entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile()
    }));
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =============================================================================
// APPLICATION LIFECYCLE
// =============================================================================

/**
 * App is ready - start everything
 * 
 * 🎓 TEACHING NOTE:
 * The 'ready' event fires when Electron has finished initialization.
 * This is the safe place to create windows, trays, and start servers.
 */
app.whenReady().then(async () => {
  console.log('='.repeat(60));
  console.log('🐱 Meowstik Desktop starting...');
  console.log('='.repeat(60));
  
  try {
    await startBackend();
    console.log('✅ Backend started successfully');
  } catch (error) {
    console.error('❌ Failed to start backend:', error);
    dialog.showErrorBox(
      'Startup Error',
      'Failed to start the backend server.\n\n' +
      'Please check your configuration and try again.\n\n' +
      'Common issues:\n' +
      '• Missing GEMINI_API_KEY\n' +
      '• Port 5001 already in use\n' +
      '• Missing Node.js dependencies'
    );
  }

  createTray();
  createMenu();
  createWindow();
});

// Handle all windows closed
app.on('window-all-closed', () => {
  // On Linux, keep running in the tray
  if (process.platform !== 'linux') {
    app.quit();
  }
});

// Handle app activation (e.g., clicking dock icon on macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

// Clean up before quitting
app.on('before-quit', () => {
  isQuitting = true;
  if (localAgentProcess) {
    localAgentProcess.kill('SIGTERM');
    localAgentProcess = null;
  }
  stopBackend();
});

app.on('will-quit', () => {
  if (localAgentProcess) {
    localAgentProcess.kill('SIGTERM');
    localAgentProcess = null;
  }
  stopBackend();
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * 🎓 TEACHING NOTE:
 * Always handle uncaught errors in production apps!
 * These handlers prevent the app from silently crashing.
 */
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  stopBackend();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection:', reason);
});
