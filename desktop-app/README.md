# Meowstik Desktop

A Linux desktop application for running Meowstik AI Chat locally.

🎓 **This is a teaching tool** - The code is extensively documented to help you understand Electron development and portable AI application architecture.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON DESKTOP APP                     │
│                                                             │
│  ┌──────────────────┐      ┌──────────────────────────────┐│
│  │   Main Process   │ IPC  │     Renderer Process         ││
│  │   (main.js)      │◀────▶│     (React Frontend)         ││
│  │                  │      │                              ││
│  │  • Window mgmt   │      │  • Chat UI                   ││
│  │  • System tray   │      │  • Settings                  ││
│  │  • File dialogs  │      │  • Live Voice                ││
│  │  • Menu bar      │      │  • Code Editor               ││
│  └────────┬─────────┘      └──────────────────────────────┘│
│           │                                                 │
│           │ spawns                                          │
│           ▼                                                 │
│  ┌──────────────────┐                                       │
│  │  Backend Server  │ ◀── HTTP API                          │
│  │  (Express.js)    │                                       │
│  │                  │                                       │
│  │  • REST API      │                                       │
│  │  • WebSocket     │                                       │
│  │  • AI Services   │                                       │
│  └────────┬─────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MODULAR VECTOR STORE                     │   │
│  │                                                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │   │
│  │  │pgvector │  │Vertex AI│  │ Memory  │  │Pinecone │  │   │
│  │  │(Postgres)│  │ (GCP)   │  │ (Local) │  │ (Cloud) │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Linux operating system (Ubuntu, Debian, Fedora, etc.)
- A Google AI API key (GEMINI_API_KEY)

### From Source (Manual)

```bash
# 1. Clone the repository
git clone https://github.com/jasonbender-c3x/meowstik.git
cd meowstik

# 2. Install main app dependencies
npm install

# 3. Navigate to desktop app
cd desktop-app
npm install

# 4. Set up environment (see Configuration section)
cp .env.example .env
# Edit .env with your settings

# 5. Run in development mode
npm run dev
```

### Quick Install (Recommended)

If you have a `secrets.json` file from your crypto locker:

```bash
# 1. Clone and enter the desktop-app folder
git clone https://github.com/jasonbender-c3x/meowstik.git
cd meowstik/desktop-app

# 2. Place your secrets.json in this folder

# 3. Run the installer
chmod +x install.sh
./install.sh
```

The installer will:
1. Check for `secrets.json` (error if missing)
2. Parse it and create a secure `.env` file (permissions 600)
3. Install system dependencies via apt
4. Install all Node.js packages
5. Copy the browser extension to `~/.meowstik/extension/`
6. Guide you through Chrome extension installation
7. Pause for you to install the extension, then continue

## 📦 Portability

This app is designed to run on multiple platforms:

| Platform | Vector Store | Notes |
|----------|-------------|-------|
| **Replit** | pgvector | Uses built-in PostgreSQL |
| **Google Cloud** | Vertex AI | Managed RAG service |
| **Local/Desktop** | pgvector or memory | Choose based on needs |
| **Colab Notebook** | memory | No database required |
| **Docker** | Any | Mount volumes for persistence |
| **Chromebook** | memory or pgvector | Via Linux container or browser extension |
| **Windows** | pgvector or memory | Full Playwright support |

### Switching Vector Stores

The app auto-detects the best backend:

```bash
# Auto-detection priority:
# 1. DATABASE_URL → pgvector
# 2. GOOGLE_CLOUD_PROJECT → Vertex AI
# 3. None → In-memory (development/testing)

# Or explicitly set:
VECTOR_STORE_BACKEND=pgvector   # PostgreSQL with pgvector
VECTOR_STORE_BACKEND=vertex     # Google Cloud Vertex AI
VECTOR_STORE_BACKEND=memory     # In-memory (no persistence)
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GEMINI_API_KEY` | Google AI API key | Yes | - |
| `DATABASE_URL` | PostgreSQL connection string | No | (uses memory) |
| `VECTOR_STORE_BACKEND` | 'pgvector' \| 'vertex' \| 'memory' | No | (auto-detect) |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID (for Vertex AI) | No | - |
| `PORT` | Backend port | No | 5001 |

### Example Configurations

**Local Development (no database):**
```bash
GEMINI_API_KEY=your_api_key
VECTOR_STORE_BACKEND=memory
```

**Local with PostgreSQL:**
```bash
GEMINI_API_KEY=your_api_key
DATABASE_URL=postgresql://user:pass@localhost:5432/meowstik
```

**Google Cloud Deployment:**
```bash
GEMINI_API_KEY=your_api_key
GOOGLE_CLOUD_PROJECT=my-project-id
VECTOR_STORE_BACKEND=vertex
```

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New Chat |
| `Ctrl+,` | Settings |
| `Ctrl+Q` | Quit |
| `F11` | Toggle Fullscreen |
| `Ctrl+R` | Reload |
| `Ctrl+Shift+I` | DevTools (dev mode only) |

## 🔧 Building for Distribution

### Build AppImage (recommended for most Linux distros):
```bash
npm run build:appimage
```

### Build .deb package (for Debian/Ubuntu):
```bash
npm run build:deb
```

Built packages will be in the `dist/` folder.

## 📚 Code Structure

```
desktop-app/
├── src/
│   ├── main.js         # Electron main process (extensively documented)
│   └── preload.js      # Bridge between main and renderer
├── assets/
│   ├── icon.png        # App icon
│   ├── icon.svg        # Vector icon source
│   └── tray-icon.png   # System tray icon
├── package.json        # Dependencies and build config
└── README.md           # This file
```

## 🎓 Learning Resources

This project demonstrates several key concepts:

1. **Electron Architecture**
   - Main vs Renderer process
   - IPC communication
   - Preload scripts for security

2. **Adapter Pattern**
   - Multiple vector store backends
   - Same interface, different implementations
   - Factory pattern for creation

3. **Child Process Management**
   - Spawning Node.js servers
   - Health checking with polling
   - Graceful shutdown

4. **Desktop Integration**
   - System tray
   - Native menus
   - File dialogs

## 🖥️ Platform Notes

### Chromebook

On Chromebook, you have two options:

1. **Browser Extension Only** (no root required)
   - Install the Meowstik extension in Chrome
   - The extension handles all browser automation
   - Connect to a remote Meowstik backend (Replit, cloud, etc.)

2. **Full Desktop App** (requires Linux container)
   - Enable Linux (Crostini) in ChromeOS settings
   - Run the installer inside the Linux container
   - The desktop app provides local file access

### Windows

Full support with Playwright:
- Node.js 18+ required
- Playwright supports Windows 10/11 (x64 and ARM64)
- Install via the standard npm process

### Linux

Native support:
- Ubuntu, Debian, Fedora, and derivatives
- Uses apt for system dependencies
- AppImage and .deb packages available

## 🐛 Troubleshooting

### Backend not starting
- Check that Node.js 18+ is installed
- Verify GEMINI_API_KEY is set
- Check port 5001 is available
- Look at terminal logs for errors

### Database connection issues
- Ensure PostgreSQL is installed and running
- Verify DATABASE_URL format is correct
- Try `VECTOR_STORE_BACKEND=memory` for testing without a database

### API errors
- Verify your GEMINI_API_KEY is valid
- Check internet connection for AI features
- Review rate limits on your API key

### Window not showing
- Check for existing processes: `ps aux | grep meowstik`
- Kill stale processes: `pkill -f meowstik`
- Try running with: `npm run dev` for debug output

## 📄 License

MIT License - See LICENSE file for details.

---

**Made with 🐱 by the Meowstik team**
