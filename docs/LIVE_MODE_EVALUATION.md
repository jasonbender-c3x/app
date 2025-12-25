# Gemini Live Mode Evaluation

## Overview
The application implements a real-time voice conversation feature using the Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`). The implementation spans the client (React) and server (Node.js/Express + WebSockets).

## Architecture
- **Client**: Captures audio using `MediaRecorder` / `ScriptProcessorNode`, converts to PCM, and streams via WebSocket. Plays back received audio chunks.
- **Server**:
  - **HTTP**: `/api/live/session` endpoints for session management.
  - **WebSocket**: `/api/live/stream/:sessionId` for bidirectional audio/text streaming.
  - **Integration**: Uses `@google/genai` SDK to connect to Gemini Live API.

## Code Analysis

### Server-Side
- **`server/websocket-live.ts`**: Correctly sets up a WebSocket server attached to the main HTTP server. Handles message routing (audio, text, interrupt, persona).
- **`server/integrations/gemini-live.ts`**:
  - Uses the correct model: `gemini-2.5-flash-native-audio-preview-12-2025`.
  - Configures session with `Modality.AUDIO` and `Modality.TEXT`.
  - Implements `receiveResponses` generator to stream data from Gemini to the WebSocket client.
  - **Note**: The `interrupt` function relies on `liveSession.session.interrupt()`, which is expected to be available in the SDK.

### Client-Side
- **`client/src/pages/live.tsx`**:
  - Uses `ScriptProcessorNode` for audio processing. **Warning**: This API is deprecated and runs on the main thread, which may cause audio glitches or UI jank. `AudioWorklet` is the recommended replacement.
  - Audio format: 16kHz input, 24kHz output. Matches server configuration.
  - Base64 encoding/decoding is done manually in loops. While functional for small chunks, this is less efficient than using `FileReader` or `TextDecoder`/`TextEncoder` (though `atob`/`btoa` are generally fast enough for this use case).

## Environment & Errors
The user reported the following errors in `server/websocket-live.ts`:
- `Cannot find module 'ws'`
- `Cannot find module 'http'`
- `Cannot find name 'Buffer'`

**Cause**: These are TypeScript environment issues.
- `ws` is listed in `dependencies`.
- `@types/ws` and `@types/node` are in `devDependencies`.
- `tsconfig.json` includes `server/**/*` and specifies `types: ["node", "vite/client"]`.

**Resolution**:
1. Ensure `npm install` has been run successfully.
2. Restart the VS Code TypeScript server (Command Palette -> `TypeScript: Restart TS Server`).
3. If using a specific workspace version of TypeScript, ensure it matches the project configuration.

## Recommendations
1.  **Migrate to AudioWorklet**: [COMPLETED] Replaced `ScriptProcessorNode` in `client/src/pages/live.tsx` with `AudioWorklet` (`client/public/audio-processor.js`) for better performance and stability.
2.  **Error Handling**: Ensure robust error handling on the client if the WebSocket connection drops or the Gemini session expires.
3.  **Type Definitions**: Verify that `node_modules` is populated and `@types` are present. (Addressed via `setup_windows.bat`)

## Conclusion
The "Live Mode" implementation is architecturally sound and follows the proposed design. The reported errors are likely environmental. The use of deprecated audio APIs on the client is the main technical debt to address.

## Recent Updates
- **Refactoring**: Migrated client-side audio processing to `AudioWorklet`.
- **Environment**: Created `setup_windows.bat` to automate Node.js, FFmpeg, and dependency installation.
- **Architecture**: Extracted Live API routes to `server/routes/live.ts` for better modularity.
