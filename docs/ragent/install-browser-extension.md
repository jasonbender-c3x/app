# Installing the Browser Extension

> Meowstik AI Assistant for Chrome

---

## Overview

The Meowstik browser extension adds AI assistance directly to your browser:

- **Popup Chat** - Quick AI chat from any webpage
- **Screen Capture** - Share your screen with the AI
- **Page Analysis** - AI reads and understands page content
- **Console Monitoring** - AI sees JavaScript errors
- **Context Menu** - Right-click to ask AI about selected text

---

## Installation Steps

### Method 1: Load Unpacked (Developer Mode)

1. **Download the Extension**
   
   Download the extension files from Meowstik:
   - Go to [/collaborate](/collaborate) in Meowstik
   - Click "Download Extension" button
   - Extract the ZIP file to a folder

2. **Open Chrome Extensions**
   
   - Open Chrome
   - Navigate to `chrome://extensions`
   - Or: Menu → More Tools → Extensions

3. **Enable Developer Mode**
   
   - Toggle "Developer mode" switch (top right)

4. **Load the Extension**
   
   - Click "Load unpacked"
   - Select the extracted extension folder
   - Extension should appear in your toolbar

5. **Pin the Extension**
   
   - Click the puzzle icon in Chrome toolbar
   - Click the pin icon next to "Meowstik AI Assistant"

### Method 2: Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store in a future release.

---

## Extension Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration and permissions |
| `popup.html` | Popup chat interface |
| `popup.js` | Popup chat logic |
| `popup.css` | Popup styling |
| `background.js` | Background service worker |
| `content.js` | Page content extraction |
| `content.css` | Page overlay styling |

---

## Connecting to Meowstik

1. **Get Authentication Token**
   
   - Go to [/collaborate](/collaborate) in Meowstik
   - Click "Get Extension Token"
   - Copy the token

2. **Configure Extension**
   
   - Click the Meowstik icon in Chrome toolbar
   - Click "Settings" (gear icon)
   - Paste your authentication token
   - Enter your Meowstik server URL
   - Click "Connect"

3. **Verify Connection**
   
   - Status indicator should turn green
   - Try asking a question in the popup chat

---

## Features

### Popup Chat

Click the extension icon to open a quick chat:

```
You: What's on this page?
AI: This is the GitHub homepage. I can see trending repositories 
    and a sign-in form.
```

### Screen Capture

Share what you're seeing with the AI:

1. Click "Share Screen" in popup
2. Select the tab or window to share
3. AI can now see your screen in real-time

### Page Content

Right-click anywhere and select:

- "Ask Meowstik about this page"
- "Ask Meowstik about selection"
- "Summarize this page"

### Console Monitoring

The extension monitors JavaScript errors:

```
AI: I noticed a JavaScript error on this page:
    "TypeError: Cannot read property 'length' of undefined"
    This might be causing the form not to submit.
```

---

## Permissions Explained

| Permission | Why It's Needed |
|------------|-----------------|
| `activeTab` | Access current tab for screenshots |
| `storage` | Store authentication token |
| `tabs` | List and navigate tabs |
| `scripting` | Inject content scripts |
| `contextMenus` | Add right-click menu items |
| `webRequest` | Monitor network for errors |
| `<all_urls>` | Work on any website |

---

## Troubleshooting

### Extension Not Connecting

1. Check your authentication token is correct
2. Verify the server URL includes `https://`
3. Make sure Meowstik is running
4. Try refreshing the extension

### No Response from AI

1. Check the connection status (should be green)
2. Verify you're logged into Meowstik
3. Check browser console for errors

### Screen Share Not Working

1. Grant screen share permission when prompted
2. Try selecting "This Tab" instead of entire screen
3. Check if other extensions are blocking

---

## Security

- **Token Storage** - Tokens are stored in Chrome's encrypted storage
- **HTTPS Only** - All communication uses TLS encryption
- **No Data Logging** - Page content is processed, not stored
- **Session Expiry** - Tokens expire after disconnection

---

## Updating the Extension

1. Download the latest version from Meowstik
2. Go to `chrome://extensions`
3. Find Meowstik AI Assistant
4. Click the refresh icon (🔄)

---

## Related Documentation

- [Browser & Computer Use](./browser-computer-use.md) - AI automation capabilities
- [Collaborative Editing](./collaborative-editing.md) - Voice-guided sessions
- [Installing the Desktop Agent](./install-desktop-agent.md) - Full desktop control
- [Ragent Index](./INDEX.md) - All agent documentation
