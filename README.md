# Nebula Chat

A next-generation AI chat interface built with modern web technologies, featuring conversational AI powered by Google's Gemini, integrated Google Workspace services, and a code editor with live preview.

---

## Table of Contents

1. [Features](#features)
2. [Getting Started](#getting-started)
3. [Architecture Overview](#architecture-overview)
4. [Glossary](#glossary)
   - [Database Tables & Types](#database-tables--types)
   - [Core Functions](#core-functions)
   - [React Hooks](#react-hooks)
   - [API Endpoints](#api-endpoints)
   - [Key Concepts](#key-concepts)

---

## Features

### 1. AI-Powered Chat Interface

The core feature of Nebula Chat is a conversational AI assistant powered by Google's Gemini model.

- **Real-time Streaming Responses**: AI responses stream in word-by-word using Server-Sent Events (SSE), providing a natural conversation feel
- **Chat History**: All conversations are persisted to a PostgreSQL database and organized in a collapsible sidebar
- **Quick-Start Prompts**: New users see suggested conversation starters on the welcome screen
- **Markdown Support**: AI responses render with full markdown formatting including code blocks, lists, and headings
- **Chat Management**: Create new chats, rename existing ones, and switch between conversations seamlessly

### 2. Code Editor (Monaco Editor)

A full-featured code editor identical to VS Code's editing experience.

- **Multi-Language Support**: HTML, CSS, JavaScript, TypeScript, JSON, and Markdown
- **Syntax Highlighting**: Intelligent code coloring based on language
- **Light/Dark Themes**: Toggle between visual themes for comfortable coding
- **Auto-Save**: Code is automatically saved to browser local storage
- **Live Preview Integration**: Preview your code in real-time with one click

### 3. Live Code Preview

View your HTML/CSS/JS code rendered in a sandboxed environment.

- **Sandboxed Iframe**: Code runs safely in an isolated iframe
- **Responsive Viewport Simulation**: Test mobile (375px), tablet (768px), and desktop views
- **Fullscreen Mode**: Expand preview for distraction-free viewing
- **Refresh Button**: Reload the preview with the latest saved code

### 4. Google Workspace Integration

Access and manage your Google account services directly from Nebula Chat.

#### Google Drive
- Browse files and folders
- Search for documents
- Open, create, update, and delete files

#### Gmail
- View inbox and email threads
- Read individual emails
- Compose and send new emails
- Search emails by keyword

#### Google Calendar
- List all calendars
- View upcoming events
- Create new calendar events
- Update and delete events

#### Google Docs
- Read document contents
- Create new documents
- Append text to existing documents
- Find and replace text

#### Google Sheets
- List spreadsheets
- Read cell ranges
- Update and append data
- Clear ranges
- Create new spreadsheets

#### Google Tasks
- View task lists
- Create, complete, and delete tasks
- Organize with multiple task lists

### 5. Voice Interaction

Built-in voice capabilities using the Web Speech API.

- **Speech-to-Text**: Speak your messages instead of typing
- **Text-to-Speech**: Have AI responses read aloud
- **Voice Input Toggle**: One-click activation of voice mode

### 6. Modern UI/UX

- **Google-esque Design**: Clean, airy aesthetic with lots of whitespace
- **Responsive Layout**: Works on mobile, tablet, and desktop
- **Smooth Animations**: Framer Motion-powered transitions
- **Toast Notifications**: Non-intrusive feedback messages
- **Dark Mode Ready**: CSS custom properties for theme switching

---

## Getting Started

### Prerequisites

- Node.js 20+ (automatically provided by Replit)
- PostgreSQL database (automatically configured via `DATABASE_URL`)
- Google Gemini API key (set as `GEMINI_API_KEY` environment variable)

### Installation

```bash
# Install dependencies
npm install

# Push database schema to PostgreSQL
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-configured on Replit) |
| `GEMINI_API_KEY` | Google Generative AI API key for chat functionality |

### Running the Application

The application runs on port 5000 with the following routes:

| Route | Description |
|-------|-------------|
| `/` | Main chat interface - Start AI conversations |
| `/editor` | Code editor with Monaco Editor |
| `/preview` | Live preview of your code |
| `/google` | Google Workspace services dashboard |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Pages     │  │ Components  │  │        Hooks            │ │
│  │  - home     │  │  - chat     │  │  - useToast             │ │
│  │  - editor   │  │  - sidebar  │  │  - useMobile            │ │
│  │  - preview  │  │  - message  │  │  - useVoice             │ │
│  │  - google   │  │  - input    │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                           │                                     │
│                  TanStack Query (React Query)                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP API
┌─────────────────────────────▼───────────────────────────────────┐
│                       SERVER (Express)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     API Routes                           │   │
│  │  /api/chats, /api/drive, /api/gmail, /api/calendar, etc │   │
│  └─────────────────────────────┬───────────────────────────┘   │
│                                │                                │
│  ┌─────────────────────────────▼───────────────────────────┐   │
│  │                   Storage Layer                          │   │
│  │              (Drizzle ORM → PostgreSQL)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Google API Integrations                      │   │
│  │  Drive │ Gmail │ Calendar │ Docs │ Sheets │ Tasks        │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Glossary

### Database Tables & Types

| Name | Type | Description |
|------|------|-------------|
| `chats` | Table | Stores chat conversation metadata (id, title, timestamps) |
| `messages` | Table | Stores individual messages within chats |
| `Chat` | Type | TypeScript type for a complete chat record from the database |
| `Message` | Type | TypeScript type for a complete message record from the database |
| `InsertChat` | Type | Type for creating new chats (only `title` required) |
| `InsertMessage` | Type | Type for creating new messages (chatId, role, content required) |
| `insertChatSchema` | Zod Schema | Validation schema for chat creation requests |
| `insertMessageSchema` | Zod Schema | Validation schema for message creation requests |

### Database Fields

| Field | Table | Description |
|-------|-------|-------------|
| `id` | Both | UUID primary key, auto-generated by PostgreSQL |
| `title` | chats | Human-readable name for the conversation |
| `createdAt` | Both | Timestamp when the record was created |
| `updatedAt` | chats | Timestamp of last activity (new message added) |
| `chatId` | messages | Foreign key linking message to its parent chat |
| `role` | messages | Message sender: `"user"` or `"ai"` |
| `content` | messages | The text content of the message (supports markdown) |

### Core Functions

#### Storage Layer (`server/storage.ts`)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `createChat` | `InsertChat` | `Promise<Chat>` | Creates a new chat conversation in the database |
| `getChats` | none | `Promise<Chat[]>` | Retrieves all chats, sorted by most recent activity |
| `getChatById` | `id: string` | `Promise<Chat \| undefined>` | Finds a specific chat by its UUID |
| `updateChatTitle` | `id: string, title: string` | `Promise<void>` | Changes the title of an existing chat |
| `addMessage` | `InsertMessage` | `Promise<Message>` | Adds a new message to a chat, updates chat timestamp |
| `getMessagesByChatId` | `chatId: string` | `Promise<Message[]>` | Gets all messages for a chat, sorted chronologically |

#### API Utilities (`client/src/lib/queryClient.ts`)

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `apiRequest` | `method, url, data?` | `Promise<Response>` | Makes HTTP requests with automatic error handling |
| `getQueryFn` | `{ on401: UnauthorizedBehavior }` | `QueryFunction<T>` | Creates query functions for React Query with 401 handling |
| `throwIfResNotOk` | `Response` | `void` | Throws an error if HTTP response is not OK (status >= 400) |

#### Google Drive (`server/integrations/google-drive.ts`)

| Function | Description |
|----------|-------------|
| `listDriveFiles` | Lists files from Google Drive with optional query filter |
| `getDriveFile` | Gets file metadata by ID |
| `getDriveFileContent` | Retrieves the content of a specific file |
| `createDriveFile` | Creates a new file in Google Drive |
| `updateDriveFile` | Updates an existing file's content |
| `deleteDriveFile` | Deletes a file from Google Drive |
| `searchDriveFiles` | Searches files by name or content |

#### Gmail (`server/integrations/gmail.ts`)

| Function | Description |
|----------|-------------|
| `listEmails` | Lists emails from inbox with optional max results |
| `getEmail` | Retrieves a specific email by ID |
| `sendEmail` | Sends a new email |
| `searchEmails` | Searches emails by query string |
| `getLabels` | Retrieves all Gmail labels |

#### Google Calendar (`server/integrations/google-calendar.ts`)

| Function | Description |
|----------|-------------|
| `listCalendars` | Lists all user's calendars |
| `listEvents` | Lists events from a specific calendar |
| `getEvent` | Gets a specific event by ID |
| `createEvent` | Creates a new calendar event |
| `updateEvent` | Updates an existing event |
| `deleteEvent` | Deletes a calendar event |

#### Google Docs (`server/integrations/google-docs.ts`)

| Function | Description |
|----------|-------------|
| `getDocument` | Retrieves document metadata and structure |
| `getDocumentText` | Extracts plain text from a document |
| `createDocument` | Creates a new Google Doc |
| `appendText` | Adds text to the end of a document |
| `replaceText` | Finds and replaces text in a document |
| `listDocuments` | Lists user's Google Docs documents |

#### Google Sheets (`server/integrations/google-sheets.ts`)

| Function | Description |
|----------|-------------|
| `getSpreadsheet` | Gets spreadsheet metadata and structure |
| `getSheetValues` | Reads values from a cell range |
| `updateSheetValues` | Updates values in a cell range |
| `appendSheetValues` | Appends rows to a sheet |
| `clearSheetRange` | Clears values in a cell range |
| `createSpreadsheet` | Creates a new spreadsheet |
| `listSpreadsheets` | Lists user's spreadsheets |

#### Google Tasks (`server/integrations/google-tasks.ts`)

| Function | Description |
|----------|-------------|
| `listTaskLists` | Lists all task lists |
| `getTaskList` | Gets a specific task list by ID |
| `createTaskList` | Creates a new task list |
| `deleteTaskList` | Deletes a task list |
| `listTasks` | Lists tasks in a specific task list |
| `getTask` | Gets a specific task by ID |
| `createTask` | Creates a new task |
| `updateTask` | Updates a task's properties |
| `completeTask` | Marks a task as completed |
| `deleteTask` | Deletes a task |
| `clearCompletedTasks` | Removes all completed tasks from a list |

### React Hooks

| Hook | File | Description |
|------|------|-------------|
| `useToast` | `use-toast.ts` | Provides toast notification functionality with add, dismiss, and update methods |
| `useMobile` | `use-mobile.tsx` | Detects mobile viewport width (< 768px) using media query listener |
| `useVoice` | `use-voice.ts` | Integrates Web Speech API for speech-to-text and text-to-speech functionality |

### API Endpoints

#### Chat Endpoints (`/api/chats`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chats` | Create a new chat conversation |
| `GET` | `/api/chats` | Get all chat conversations (sorted by most recent) |
| `GET` | `/api/chats/:id` | Get a specific chat by ID with messages |
| `PATCH` | `/api/chats/:id` | Update a chat's title |
| `POST` | `/api/chats/:id/messages` | Send a message and get streaming AI response (SSE) |

#### Google Drive Endpoints (`/api/drive`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/drive/files` | List files (optional `?query=` filter) |
| `GET` | `/api/drive/files/:id` | Get file metadata by ID |
| `GET` | `/api/drive/files/:id/content` | Download file content as text |
| `POST` | `/api/drive/files` | Create a new file |
| `PUT` | `/api/drive/files/:id` | Update file content |
| `DELETE` | `/api/drive/files/:id` | Delete a file |
| `GET` | `/api/drive/search` | Search files by name/content (`?q=` query) |

#### Gmail Endpoints (`/api/gmail`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/gmail/messages` | List emails (optional `?maxResults=`) |
| `GET` | `/api/gmail/messages/:id` | Get full email by ID |
| `POST` | `/api/gmail/messages` | Send a new email |
| `GET` | `/api/gmail/labels` | Get all Gmail labels |
| `GET` | `/api/gmail/search` | Search emails (`?q=` query) |

#### Google Calendar Endpoints (`/api/calendar`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/calendar/calendars` | List all calendars |
| `GET` | `/api/calendar/events` | List events (optional `?calendarId=`, `?timeMin=`, `?timeMax=`) |
| `GET` | `/api/calendar/events/:id` | Get event by ID |
| `POST` | `/api/calendar/events` | Create a new event |
| `PATCH` | `/api/calendar/events/:id` | Update an event |
| `DELETE` | `/api/calendar/events/:id` | Delete an event |

#### Google Docs Endpoints (`/api/docs`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/docs` | List all documents |
| `GET` | `/api/docs/:id` | Get document metadata |
| `GET` | `/api/docs/:id/text` | Get document plain text content |
| `POST` | `/api/docs` | Create a new document |
| `POST` | `/api/docs/:id/append` | Append text to document |
| `POST` | `/api/docs/:id/replace` | Find and replace text |

#### Google Sheets Endpoints (`/api/sheets`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sheets` | List all spreadsheets |
| `GET` | `/api/sheets/:id` | Get spreadsheet metadata |
| `GET` | `/api/sheets/:id/values` | Get values from range (`?range=`) |
| `PUT` | `/api/sheets/:id/values` | Update values in range |
| `POST` | `/api/sheets/:id/values` | Append rows to sheet |
| `POST` | `/api/sheets` | Create a new spreadsheet |
| `DELETE` | `/api/sheets/:id/values` | Clear values in range |

#### Google Tasks Endpoints (`/api/tasks`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks/lists` | List all task lists |
| `GET` | `/api/tasks/lists/:id` | Get task list by ID |
| `POST` | `/api/tasks/lists` | Create a new task list |
| `DELETE` | `/api/tasks/lists/:id` | Delete a task list |
| `GET` | `/api/tasks/lists/:listId/tasks` | List tasks in a list |
| `GET` | `/api/tasks/lists/:listId/tasks/:taskId` | Get specific task |
| `POST` | `/api/tasks/lists/:listId/tasks` | Create a new task |
| `PATCH` | `/api/tasks/lists/:listId/tasks/:taskId` | Update a task |
| `POST` | `/api/tasks/lists/:listId/tasks/:taskId/complete` | Mark task completed |
| `DELETE` | `/api/tasks/lists/:listId/tasks/:taskId` | Delete a task |
| `POST` | `/api/tasks/lists/:listId/clear` | Clear completed tasks |

### Key Concepts

| Term | Description |
|------|-------------|
| **Drizzle ORM** | Type-safe database toolkit for TypeScript that translates your code into SQL queries |
| **TanStack Query** | Data-fetching library that handles caching, background updates, and loading states |
| **Server-Sent Events (SSE)** | HTTP protocol for real-time, one-way server-to-client communication (used for AI streaming) |
| **Monaco Editor** | The code editor that powers VS Code, embedded in the browser |
| **shadcn/ui** | Collection of reusable UI components built on Radix UI primitives |
| **Radix UI** | Low-level, accessible component primitives for building design systems |
| **Tailwind CSS** | Utility-first CSS framework for rapid styling |
| **Framer Motion** | Animation library for React with declarative motion components |
| **PostgreSQL** | Relational database storing all chat and message data |
| **UUID** | Universally Unique Identifier - random string used for record IDs |
| **OAuth2** | Authentication protocol used to access Google services on behalf of users |
| **Replit Connectors** | Replit's system for managing OAuth tokens and API credentials |
| **Repository Pattern** | Design pattern where data access logic is encapsulated in a separate layer |
| **Singleton Pattern** | Design pattern where only one instance of a class exists app-wide |
| **Query Client** | Central store for all cached data and query state in React Query |
| **Zod** | TypeScript-first schema validation library for runtime type checking |
| **Webhook** | HTTP endpoint that receives data pushed from external services |
| **Cascade Delete** | Database behavior where deleting a parent record deletes all related child records |
| **Hot Module Replacement (HMR)** | Development feature that updates code in browser without full page reload |
| **Optimistic Updates** | UI pattern where changes appear immediately before server confirmation |
| **Toast Notification** | Temporary popup message providing user feedback |

### UI Component Variables

| Component | File | Description |
|-----------|------|-------------|
| `Sidebar` | `sidebar.tsx` | Chat history navigation panel, collapsible on mobile |
| `ChatMessage` | `message.tsx` | Individual message bubble with user/AI styling |
| `InputArea` | `input-area.tsx` | Message input with auto-resize and send button |
| `DrivePanel` | `google-services.tsx` | Google Drive file browser interface |
| `GmailPanel` | `google-services.tsx` | Email list and compose interface |
| `CalendarPanel` | `google-services.tsx` | Calendar events viewer |
| `DocsPanel` | `google-services.tsx` | Google Docs viewer |
| `SheetsPanel` | `google-services.tsx` | Spreadsheet data viewer |
| `TasksPanel` | `google-services.tsx` | Task list management interface |

### State Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `currentChatId` | Home | UUID of the currently selected chat conversation |
| `messages` | Home | Array of Message objects for the current chat |
| `sidebarCollapsed` | Home | Boolean controlling sidebar visibility |
| `isStreaming` | Home | Boolean indicating if AI response is streaming |
| `code` | Editor | Current code content in the Monaco editor |
| `language` | Editor | Selected programming language for syntax highlighting |
| `theme` | Editor | Current editor theme (light/dark) |
| `viewport` | Preview | Selected viewport size (mobile/tablet/desktop) |
| `isFullscreen` | Preview | Boolean for fullscreen preview mode |
| `activeTab` | Google Services | Currently selected Google service tab |

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui
- **Backend**: Express.js, Node.js, Drizzle ORM
- **Database**: PostgreSQL (Neon-backed)
- **AI**: Google Generative AI (Gemini)
- **State Management**: TanStack Query (React Query v5)
- **Routing**: Wouter (client-side)
- **Code Editor**: Monaco Editor
- **Animations**: Framer Motion
- **Form Validation**: Zod + React Hook Form
