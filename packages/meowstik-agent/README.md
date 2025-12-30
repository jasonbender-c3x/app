# Meowstik Desktop Agent

Desktop agent for Meowstik AI collaboration. Enables real-time screen sharing and AI-controlled input injection.

## Installation

```bash
npm install -g meowstik-agent
```

Or run directly with npx:

```bash
npx meowstik-agent --token YOUR_SESSION_TOKEN --server wss://your-app.replit.app
```

## Usage

1. Create a desktop session in the Meowstik web app
2. Copy the session token
3. Run the agent:

```bash
meowstik-agent --token YOUR_TOKEN --server wss://your-app.replit.app
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --token` | Session token (required) | - |
| `-s, --server` | Server WebSocket URL | - |
| `-f, --fps` | Screen capture frames per second | 2 |
| `-q, --quality` | JPEG quality (1-100) | 60 |
| `--no-audio` | Disable audio capture | enabled |
| `--no-input` | Disable input injection | enabled |

## Features

- Real-time screen capture and streaming
- Mouse movement, clicks, and scrolling
- Keyboard input injection
- Automatic reconnection on disconnect
- Cross-platform support (Windows, macOS, Linux)

## Requirements

- Node.js 18+
- For input injection: Native build tools for robotjs

### Installing robotjs dependencies

**Windows:**
```bash
npm install --global windows-build-tools
```

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt-get install libxtst-dev libpng++-dev
```

## Security

- The agent only accepts input commands from the authenticated server
- Screen data is encrypted in transit via WebSocket
- Session tokens expire after disconnection
- No data is stored locally

## Development

```bash
# Clone and install
git clone https://github.com/your-repo/meowstik-agent
cd meowstik-agent
npm install

# Run in development
npm run dev -- --token YOUR_TOKEN --server wss://localhost:5000

# Build
npm run build
```
