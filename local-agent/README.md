# Meowstik Local Agent

A local software package that spawns and controls browser instances, communicates with the Meowstik backend, and interfaces with the browser extension for AI-powered browser automation.

## Features

- **Browser Automation**: Spawns Chrome/Chromium with Playwright
- **Extension Integration**: Loads the Meowstik extension for enhanced capabilities
- **Backend Communication**: WebSocket connection to Meowstik for AI-directed tasks
- **Full Browser Control**: Navigate, click, type, screenshot, scroll, and more
- **DevTools Access**: Console logs, network requests, page content extraction

## Installation

```bash
cd local-agent
npm install
npx playwright install chromium
```

## Usage

```bash
# Start with defaults
npm start

# Or with options
node src/index.js --backend wss://your-meowstik-instance.com --headless

# Options:
#   -b, --backend <url>         Backend WebSocket URL (default: wss://meowstik.replit.app)
#   -p, --extension-port <port> Extension bridge port (default: 9222)
#   --headless                  Run browser in headless mode
```

## Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Meowstik Backend  │◄───►│   Local Agent    │◄───►│    Extension    │
│   (AI + WebSocket)  │     │   (Playwright)   │     │   (Chrome)      │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
         │                           │                        │
         │                           │                        │
         ▼                           ▼                        ▼
   AI Processing              Browser Control          Screen Capture
   Task Planning              DOM Manipulation         Console Logs
   Tool Execution             Form Filling             Network Requests
```

## Supported Commands

The agent accepts commands from the backend:

| Command | Description |
|---------|-------------|
| `navigate` | Go to a URL |
| `click` | Click an element |
| `type` | Type text into an element |
| `screenshot` | Capture the page |
| `get_content` | Extract page content |
| `execute_script` | Run JavaScript |
| `wait` | Wait for element or time |
| `scroll` | Scroll the page |
| `select` | Select dropdown option |
| `hover` | Hover over element |
| `fill_form` | Fill a form with data |
| `submit_form` | Submit a form |
| `keyboard` | Press keyboard keys |
| `go_back` / `go_forward` | Navigate history |
| `new_tab` / `close_tab` | Tab management |

## Extension Bridge

The local agent runs a WebSocket server (default port 9222) that the browser extension connects to. This allows:

- Enhanced screen capture
- Console log forwarding
- Network request capture
- DOM inspection from extension context

## Development

```bash
# Run with auto-reload
npm run dev

# Set extension path if not using default
EXTENSION_PATH=/path/to/extension npm start
```
