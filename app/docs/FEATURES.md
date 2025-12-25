# Meowstik - Complete Feature Documentation

A next-generation AI chat interface with integrated Google Workspace services, code editing capabilities, and voice interaction.

---

## Table of Contents

1. [AI-Powered Chat Interface](#1-ai-powered-chat-interface)
2. [Google Workspace Integration](#2-google-workspace-integration)
3. [Code Editor & Live Preview](#3-code-editor--live-preview)
4. [Voice Interaction](#4-voice-interaction)
5. [Document Processing (RAG)](#5-document-processing-rag)
6. [Terminal Access](#6-terminal-access)
7. [User Interface & Experience](#7-user-interface--experience)
8. [Data Management](#8-data-management)
9. [Technical Architecture](#9-technical-architecture)

---

## 1. AI-Powered Chat Interface

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Gemini AI Engine** | Powered by Google's Generative AI (Gemini) for intelligent, context-aware conversations |
| **Real-time Streaming** | Responses stream word-by-word using Server-Sent Events (SSE) for a natural conversation feel |
| **Persistent History** | All conversations are saved to a PostgreSQL database and accessible across sessions |
| **Markdown Rendering** | Full markdown support including headings, lists, code blocks, tables, and formatting |
| **Quick-Start Prompts** | Suggested conversation starters help new users get started quickly |

### Chat Management

- **Create New Chats**: Start fresh conversations anytime
- **Rename Chats**: Give meaningful names to your conversations
- **Chat History Sidebar**: Access all past conversations in a collapsible sidebar
- **Seamless Switching**: Move between conversations without losing context
- **Auto-titling**: AI automatically suggests titles based on conversation content

### Message Features

- **User & AI Messages**: Clear visual distinction between your messages and AI responses
- **Code Block Syntax Highlighting**: Code snippets are beautifully formatted with language-specific highlighting
- **Copy to Clipboard**: One-click copying of code blocks and messages
- **Timestamps**: See when each message was sent

---

## 2. Google Workspace Integration

Meowstik connects directly to your Google account, allowing the AI to help you manage your digital workspace.

### Gmail Integration

| Action | Description |
|--------|-------------|
| **List Emails** | View your recent inbox messages with sender, subject, and preview |
| **Read Emails** | Open and read full email contents including attachments |
| **Send Emails** | Compose and send new emails with subject, body, and recipients |
| **Search Emails** | Find specific emails by keyword, sender, or date |
| **Label Management** | View email labels and categories |

**Example Commands:**
- "Show me my recent emails"
- "Read the email from John about the project"
- "Send an email to team@company.com about the meeting"
- "Search for emails containing 'invoice'"

### Google Drive Integration

| Action | Description |
|--------|-------------|
| **Browse Files** | List files and folders in your Drive |
| **Search Files** | Find documents by name or content |
| **Read Content** | View the contents of documents and files |
| **Create Files** | Create new documents, spreadsheets, or text files |
| **Update Files** | Modify existing file contents |
| **Delete Files** | Remove files from your Drive |

**Example Commands:**
- "Show my recent Google Drive files"
- "Search for files containing 'budget report'"
- "Create a new document called 'Meeting Notes'"
- "Read the contents of my project proposal"

### Google Calendar Integration

| Action | Description |
|--------|-------------|
| **List Calendars** | View all your calendars (personal, work, shared) |
| **View Events** | See upcoming events with times, locations, and descriptions |
| **Create Events** | Schedule new meetings and appointments |
| **Update Events** | Modify event details, times, or attendees |
| **Delete Events** | Cancel scheduled events |

**Example Commands:**
- "What's on my calendar this week?"
- "Schedule a meeting with Sarah tomorrow at 2pm"
- "Update the team meeting to 3pm instead"
- "Show events for next Monday"

### Google Docs Integration

| Action | Description |
|--------|-------------|
| **Read Documents** | Extract and view text content from any Google Doc |
| **Create Documents** | Make new documents with initial content |
| **Append Text** | Add content to the end of existing documents |
| **Find & Replace** | Search for and replace text within documents |

**Example Commands:**
- "Read my document called 'Product Roadmap'"
- "Create a new doc with today's meeting notes"
- "Add a new section to my blog draft"
- "Replace 'Q3' with 'Q4' in the quarterly report"

### Google Sheets Integration

| Action | Description |
|--------|-------------|
| **List Spreadsheets** | View all your spreadsheets |
| **Read Data** | Get values from specific cell ranges |
| **Write Data** | Update cells with new values |
| **Append Rows** | Add new data to the bottom of a sheet |
| **Create Spreadsheets** | Make new spreadsheets with headers |
| **Clear Ranges** | Remove data from specified cells |

**Example Commands:**
- "Show data from cells A1 to D10 in my budget spreadsheet"
- "Add a new row with today's sales figures"
- "Create a new spreadsheet for tracking expenses"
- "Clear the data in column E"

### Google Tasks Integration

| Action | Description |
|--------|-------------|
| **List Task Lists** | View all your task lists |
| **View Tasks** | See tasks within a specific list |
| **Create Tasks** | Add new tasks with titles and due dates |
| **Update Tasks** | Modify task details |
| **Complete Tasks** | Mark tasks as done |
| **Delete Tasks** | Remove tasks from lists |

**Example Commands:**
- "Show my tasks for today"
- "Add 'Review proposal' to my work tasks"
- "Mark the grocery list task as complete"
- "What tasks are due this week?"

---

## 3. Code Editor & Live Preview

A full-featured development environment built into Meowstik.

### Monaco Editor Features

| Feature | Description |
|---------|-------------|
| **VS Code Experience** | Same editing engine used by Visual Studio Code |
| **Multi-Language Support** | HTML, CSS, JavaScript, TypeScript, JSON, Markdown |
| **Syntax Highlighting** | Intelligent code coloring based on language |
| **Code Completion** | IntelliSense-powered autocomplete suggestions |
| **Error Detection** | Real-time syntax error highlighting |
| **Find & Replace** | Powerful search with regex support |
| **Multiple Cursors** | Edit multiple locations simultaneously |
| **Keyboard Shortcuts** | Standard VS Code shortcuts work out of the box |

### Theme Support

- **Light Theme**: Clean, bright interface for well-lit environments
- **Dark Theme**: Easy on the eyes for extended coding sessions
- **Theme Toggle**: Switch between themes with one click

### Auto-Save

- **Browser Storage**: Code is automatically saved to local storage
- **Persistence**: Your work is preserved even if you close the browser
- **No Manual Saving**: Changes are saved as you type

### Live Preview

| Feature | Description |
|---------|-------------|
| **Sandboxed Execution** | Code runs safely in an isolated iframe |
| **Real-time Updates** | See changes instantly as you edit |
| **Refresh Button** | Manually reload the preview when needed |
| **Fullscreen Mode** | Expand preview for distraction-free viewing |

### Responsive Testing

Simulate how your code looks on different devices:

| Viewport | Width | Use Case |
|----------|-------|----------|
| **Mobile** | 375px | Smartphone view |
| **Tablet** | 768px | iPad/tablet view |
| **Desktop** | Full width | Standard desktop view |

---

## 4. Voice Interaction

Hands-free communication with the AI assistant.

### Speech-to-Text (Voice Input)

| Feature | Description |
|---------|-------------|
| **Voice Activation** | Click the microphone button to start speaking |
| **Real-time Transcription** | See your words appear as you speak |
| **Web Speech API** | Uses browser's built-in speech recognition |
| **Language Support** | Supports multiple languages based on browser settings |
| **Toggle On/Off** | Easy activation and deactivation |

### Text-to-Speech (Voice Output)

| Feature | Description |
|---------|-------------|
| **Read Aloud** | AI responses can be spoken out loud |
| **Natural Voice** | Uses browser's speech synthesis for natural-sounding output |
| **Pause/Resume** | Control playback as needed |
| **Per-Message Control** | Choose which messages to hear |

---

## 5. Document Processing (RAG)

Retrieval-Augmented Generation for intelligent document handling.

### Document Upload

| Feature | Description |
|---------|-------------|
| **PDF Support** | Upload and process PDF documents |
| **Text Extraction** | Automatic content extraction from files |
| **Attachment Management** | Attach files to messages for context |

### Semantic Chunking

| Feature | Description |
|---------|-------------|
| **Intelligent Splitting** | Documents are split into meaningful chunks |
| **Overlap Preservation** | Context is maintained between chunks |
| **Optimized Size** | Chunks are sized for optimal AI processing |

### Vector Embeddings

| Feature | Description |
|---------|-------------|
| **Semantic Search** | Find relevant content based on meaning, not just keywords |
| **Context Retrieval** | AI retrieves relevant document sections to answer questions |
| **Efficient Storage** | Embeddings are stored for fast retrieval |

---

## 6. Terminal Access

Execute commands directly from the chat interface.

### Shell Command Execution

| Feature | Description |
|---------|-------------|
| **Command Execution** | Run shell commands in a sandboxed environment |
| **Output Display** | See command output directly in the chat |
| **Error Handling** | Clear error messages when commands fail |
| **Security** | Sandboxed execution prevents dangerous operations |

**Example Commands:**
- "Run 'ls -la' to list files"
- "Execute 'npm install' to install dependencies"
- "Check the current directory with 'pwd'"

---

## 7. User Interface & Experience

### Design Philosophy

| Principle | Description |
|-----------|-------------|
| **Google-esque Aesthetic** | Clean, airy design inspired by Google's design language |
| **Minimalist Interface** | Focus on content, not clutter |
| **Consistent Spacing** | Generous whitespace for readability |
| **Visual Hierarchy** | Clear organization of information |

### Typography

| Element | Font | Purpose |
|---------|------|---------|
| **Body Text** | Inter | Readable, professional body copy |
| **Headings** | Outfit | Modern, distinctive display text |
| **Code** | Monospace | Clear code readability |

### Responsive Design

| Screen Size | Behavior |
|-------------|----------|
| **Desktop** | Full layout with sidebar and main content |
| **Tablet** | Collapsible sidebar, optimized spacing |
| **Mobile** | Stacked layout, touch-friendly controls |

### Animations & Transitions

| Animation | Purpose |
|-----------|---------|
| **Framer Motion** | Smooth, professional UI animations |
| **Fade Transitions** | Gentle content appearance |
| **Slide Effects** | Sidebar and modal animations |
| **Loading States** | Clear visual feedback during processing |

### Theme Support

| Theme | Description |
|-------|-------------|
| **Light Mode** | Bright, clean interface |
| **Dark Mode** | Eye-friendly dark colors |
| **System Preference** | Automatically matches OS settings |

### Notifications

| Type | Purpose |
|------|---------|
| **Toast Notifications** | Quick feedback for actions |
| **Error Messages** | Clear error communication |
| **Success Confirmations** | Confirmation of completed actions |

---

## 8. Data Management

### Chat Persistence

| Feature | Description |
|---------|-------------|
| **PostgreSQL Database** | Reliable, scalable data storage |
| **Auto-save** | Messages are saved automatically |
| **Cross-session Access** | Access conversations from any device |
| **Data Integrity** | ACID-compliant transactions |

### Message Storage

| Field | Description |
|-------|-------------|
| **ID** | Unique identifier (UUID) |
| **Chat ID** | Reference to parent conversation |
| **Role** | User or AI message |
| **Content** | The message text |
| **Metadata** | Additional information (attachments, tool calls) |
| **Timestamp** | When the message was created |

### Draft Management

| Feature | Description |
|---------|-------------|
| **Auto-save Drafts** | In-progress messages are saved |
| **Draft Recovery** | Recover unsent messages |
| **Attachment Drafts** | Files attached to unsent messages are preserved |

---

## 9. Technical Architecture

### Frontend Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI component framework |
| **TypeScript** | Type-safe development |
| **Vite** | Fast development and build tool |
| **Tailwind CSS v4** | Utility-first styling |
| **shadcn/ui** | Accessible UI components |
| **TanStack Query** | Server state management |
| **Wouter** | Lightweight routing |
| **Framer Motion** | Animation library |
| **Monaco Editor** | Code editing |

### Backend Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime |
| **Express.js** | HTTP server framework |
| **Drizzle ORM** | Type-safe database operations |
| **PostgreSQL** | Relational database |
| **Google APIs** | Workspace integrations |

### AI & Processing

| Technology | Purpose |
|------------|---------|
| **Google Gemini** | Conversational AI engine |
| **Server-Sent Events** | Real-time streaming |
| **Delimiter Parser** | Tool call extraction |
| **RAG Pipeline** | Document retrieval and context |

### Security

| Feature | Description |
|---------|-------------|
| **OAuth2 Authentication** | Secure Google account access |
| **Token Management** | Automatic token refresh and caching |
| **Sandboxed Execution** | Safe code and command execution |
| **Input Validation** | Zod schemas for data validation |

---

## Quick Reference: What You Can Ask Nebula

### Productivity
- "Show my recent emails"
- "What's on my calendar today?"
- "Create a new document for meeting notes"
- "Add a task to buy groceries"

### File Management
- "Search my Drive for project files"
- "Read the contents of my report"
- "Update the budget spreadsheet"

### Communication
- "Send an email to my team about the update"
- "Find emails from last week"

### Development
- "Help me write a JavaScript function"
- "Preview this HTML code"
- "Run npm install"

### General Assistance
- "Summarize this document"
- "Explain this concept"
- "Help me plan my day"

---

*Meowstik - Your AI-powered productivity companion*
