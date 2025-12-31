# Browser & Computer Use

> AI-controlled browser automation and full desktop control

---

## Overview

Meowstik provides two levels of computer control:

1. **Browser Use** - AI controls a headless browser via Playwright
2. **Computer Use** - AI controls the entire desktop via screen capture and input injection

Both can be used with [Collaborative Editing](./collaborative-editing.md) for real-time voice-guided sessions.

---

## Browser Use (Playwright)

### How It Works

| Step | Description |
|------|-------------|
| 1. Session Start | AI spawns a Playwright browser instance |
| 2. Navigation | AI navigates to URLs, clicks, types |
| 3. Vision | Screenshots sent to Gemini Vision for analysis |
| 4. Decision | AI decides next action based on visual analysis |
| 5. Execution | Playwright executes the action |
| 6. Loop | Repeat until task complete |

### Available Actions

| Action | Description | Example |
|--------|-------------|---------|
| `navigate` | Go to a URL | `{ url: "https://example.com" }` |
| `click` | Click an element | `{ selector: "#submit-btn" }` |
| `type` | Type text into an input | `{ selector: "input", text: "hello" }` |
| `screenshot` | Capture current state | Returns base64 image |
| `wait` | Wait for element | `{ selector: ".loading", state: "hidden" }` |
| `getText` | Extract text content | `{ selector: ".title" }` |
| `evaluate` | Run JavaScript | `{ script: "document.title" }` |
| `scroll` | Scroll the page | `{ direction: "down", amount: 500 }` |

### Pages

| Page | Route | Description |
|------|-------|-------------|
| [Browser](/browser) | `/browser` | Full browser control with Browserbase |
| [Collaborate](/collaborate) | `/collaborate` | AI collaboration hub |

### API Endpoints

```
POST /api/playwright/navigate   - Navigate to URL
POST /api/playwright/click      - Click element
POST /api/playwright/type       - Type text
POST /api/playwright/screenshot - Capture screenshot
POST /api/playwright/wait       - Wait for element
POST /api/playwright/getText    - Get element text
POST /api/playwright/evaluate   - Execute JavaScript
```

### Integration with Voice

When used with [Mode B (2-Way Real-Time)](./collaborative-editing.md#mode-b-2-way-real-time-full-desktop):

```
User: "Go to GitHub and find my repositories"
AI: [navigates to github.com, analyzes page, clicks profile, finds repos]
AI: "I found 15 repositories. Which one would you like to open?"
```

---

## Computer Use (Full Desktop)

### How It Works

| Component | Description |
|-----------|-------------|
| **Desktop Agent** | Local Node.js app on user's computer |
| **Screen Capture** | Captures frames at 1-2 FPS |
| **Relay Server** | Forwards frames to Gemini Vision |
| **Input Injection** | Sends mouse/keyboard events via robotjs |

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S COMPUTER                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐     ┌────────────────────────────┐  │
│  │   Desktop Agent    │     │      Any Application       │  │
│  │   (meowstik-agent) │     │  (Photoshop, Excel, etc)   │  │
│  └─────────┬──────────┘     └────────────────────────────┘  │
│            │                           ▲                     │
│            │ Capture Screen            │ Inject Input        │
│            │ (1 FPS)                   │ (mouse/keyboard)    │
│            ▼                           │                     │
│  ┌─────────────────────────────────────┴───────────────────┐ │
│  │                    Screen Buffer                        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     MEOWSTIK SERVER                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐     ┌──────────────┐     ┌───────────┐  │
│  │  Desktop Relay │────►│ Gemini Vision │────►│ AI Tools  │  │
│  │    Service     │◄────│   Analysis    │◄────│ Executor  │  │
│  └────────────────┘     └──────────────┘     └───────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Available Input Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `mouseMove` | Move cursor | `{ x, y }` |
| `mouseClick` | Click at position | `{ x, y, button }` |
| `mouseDoubleClick` | Double-click | `{ x, y }` |
| `mouseDrag` | Drag from A to B | `{ fromX, fromY, toX, toY }` |
| `scroll` | Scroll wheel | `{ x, y, amount }` |
| `keyTap` | Press a key | `{ key, modifiers }` |
| `typeString` | Type a string | `{ text }` |
| `keyDown` / `keyUp` | Hold/release key | `{ key }` |

### Use Cases

| Use Case | Description |
|----------|-------------|
| **Any Application** | Control Photoshop, Excel, VS Code, anything |
| **Gaming** | AI plays games with vision feedback |
| **Accessibility** | Hands-free computer control for disabled users |
| **Automation** | Automate complex multi-app workflows |
| **Remote Assistance** | AI helps troubleshoot your computer |

---

## Comparison

| Feature | Browser Use | Computer Use |
|---------|-------------|--------------|
| Scope | Web pages only | Entire desktop |
| Speed | Fast (direct API) | Slower (vision loop) |
| Reliability | High (selectors) | Variable (vision) |
| Setup | None (server-side) | Requires local agent |
| Apps Supported | Web apps | Any application |

---

## Tool Calls

### Browser Use Tools

```typescript
// Navigate and click
{ tool: "browser_navigate", params: { url: "https://github.com" } }
{ tool: "browser_click", params: { selector: "#sign-in-btn" } }
{ tool: "browser_type", params: { selector: "#username", text: "user@example.com" } }
{ tool: "browser_screenshot" }
```

### Computer Use Tools

```typescript
// Full desktop control
{ tool: "desktop_screenshot" }
{ tool: "desktop_click", params: { x: 500, y: 300 } }
{ tool: "desktop_type", params: { text: "Hello world" } }
{ tool: "desktop_key", params: { key: "enter" } }
```

---

## Installation

### Browser Use

No installation required - Playwright runs on the server via Browserbase.

### Computer Use

See [Installing the Desktop Agent](./install-desktop-agent.md) for setup instructions.

---

## Related Documentation

- [Collaborative Editing](./collaborative-editing.md) - Voice-guided collaboration
- [Installing the Browser Extension](./install-browser-extension.md) - Chrome extension setup
- [Installing the Desktop Agent](./install-desktop-agent.md) - Desktop agent setup
- [Agent Configuration](./agent-configuration.md) - Tool and behavior settings
- [Ragent Index](./INDEX.md) - All agent documentation
