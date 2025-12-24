# Meowstik Desktop

A Linux desktop application for running Meowstik AI Chat locally.

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Linux operating system (Ubuntu, Debian, Fedora, etc.)
- A Google AI API key (for Gemini)

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/jasonbender-c3x/meowstik.git
cd meowstik
```

2. Install dependencies for the main app:
```bash
npm install
```

3. Navigate to the desktop app folder:
```bash
cd desktop-app
npm install
```

4. Set up environment variables:
```bash
# Create a .env file in the desktop-app folder
echo "GEMINI_API_KEY=your_api_key_here" > .env
echo "DATABASE_URL=your_postgres_url" >> .env
```

5. Run in development mode:
```bash
npm run dev
```

## Building for Distribution

### Build AppImage (recommended for most Linux distros):
```bash
npm run build:appimage
```

### Build .deb package (for Debian/Ubuntu):
```bash
npm run build:deb
```

The built packages will be in the `dist/` folder.

## Features

- **Local Backend**: Runs the complete Meowstik backend locally
- **System Tray**: Minimize to system tray for quick access
- **Offline Capable**: Works without internet (except for AI features)
- **Native Integration**: File dialogs, notifications, keyboard shortcuts
- **Auto-Start**: Option to start with system boot

## Configuration

The app stores configuration in:
- Linux: `~/.config/meowstik-desktop/`

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google AI API key | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Optional |
| `PORT` | Backend port (default: 5001) | No |

## Keyboard Shortcuts

- `Ctrl+N` - New Chat
- `Ctrl+,` - Settings
- `Ctrl+Q` - Quit
- `F11` - Toggle Fullscreen
- `Ctrl+R` - Reload

## Troubleshooting

### Backend not starting
- Check that Node.js 18+ is installed
- Verify the server files are in the correct location
- Check logs in the terminal

### Database connection issues
- Ensure PostgreSQL is installed and running
- Verify DATABASE_URL is correct
- For local-only mode, the app can work without a database

### API errors
- Verify your GEMINI_API_KEY is valid
- Check internet connection for AI features

## Development

```bash
# Run in development mode with DevTools
npm run dev

# Build for production
npm run build
```

## License

MIT License - See LICENSE file for details.
