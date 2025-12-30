# Meowstik Browser Extension

AI-powered browser assistant with voice, screen capture, and automation capabilities.

## Features

- **Chat Interface**: Chat with Meowstik AI directly from your browser
- **Live Voice**: Real-time voice conversations using WebSocket streaming
- **Screen Capture**: Capture visible area, full page, or select elements for AI analysis
- **Page Analysis**: Extract and analyze page content, links, forms
- **Browser Automation**: AI can navigate, click, type, and interact with pages
- **Console/Network Logs**: Capture and send logs to AI for debugging

## Installation

### From Source (Development)

1. Clone or download this directory
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `browser-extension` directory

### Configuration

1. Click the Meowstik extension icon
2. Go to Settings tab
3. Enter your server URL (default: `wss://meowstik.replit.app`)
4. Click "Connect"

## Keyboard Shortcuts

- `Ctrl+Shift+M` (Cmd+Shift+M on Mac): Open popup
- `Ctrl+Shift+V`: Start voice conversation
- `Ctrl+Shift+S`: Quick capture screen

## Architecture

```
browser-extension/
├── manifest.json          # Extension configuration
├── background/
│   └── service-worker.js  # Persistent WebSocket connection
├── content/
│   ├── content-script.js  # Page interaction & DOM access
│   └── content-style.css  # Injected styles
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styles
│   ├── popup.js           # Popup logic
│   └── audio-processor.js # Voice audio worklet
└── icons/                 # Extension icons
```

## Communication Flow

```
┌─────────────┐    WebSocket    ┌─────────────────┐
│   Popup     │◄──────────────►│ Meowstik Server │
└─────────────┘                 └─────────────────┘
       │                               │
       │ Chrome APIs                   │
       ▼                               ▼
┌─────────────┐                 ┌─────────────────┐
│  Background │◄──────────────►│   Local Agent   │
│   Worker    │    WebSocket    │   (Playwright)  │
└─────────────┘                 └─────────────────┘
       │
       │ chrome.tabs.sendMessage
       ▼
┌─────────────┐
│   Content   │
│   Script    │
└─────────────┘
```

## Permissions

- `tabs`: Access tab information
- `activeTab`: Interact with current tab
- `storage`: Save settings
- `scripting`: Execute scripts in pages
- `contextMenus`: Right-click menu
- `notifications`: Show notifications
- `<all_urls>`: Access all websites

## Integration with Local Agent

The extension can communicate with the Meowstik Local Agent running on your computer for enhanced capabilities:

1. Start the local agent: `npm start` in `local-agent/`
2. Extension automatically connects via WebSocket
3. Local agent provides Playwright browser automation

## Privacy

- All communication is encrypted via WSS
- No data is stored on third-party servers
- Console logs are only sent when explicitly requested
- You control what pages the extension can access
