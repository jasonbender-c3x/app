# Meowstik - UI Architecture Documentation

## Overview

Meowstik features a modern, Google-esque user interface built with React, TypeScript, and Tailwind CSS. The design emphasizes simplicity, clarity, and accessibility while providing a sophisticated multimodal chat experience.

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | Component-based UI framework |
| **TypeScript** | Type-safe development |
| **Tailwind CSS v4** | Utility-first styling |
| **shadcn/ui** | Accessible component library (Radix UI primitives) |
| **Framer Motion** | Smooth animations and transitions |
| **TanStack Query** | Server state management and caching |
| **Wouter** | Lightweight client-side routing |
| **Monaco Editor** | Code editing capabilities |

---

## Application Structure

```
client/src/
├── App.tsx              # Main app with routing
├── main.tsx             # Entry point
├── index.css            # Global styles and CSS variables
├── components/
│   ├── chat/
│   │   ├── input-area.tsx   # Message input component
│   │   ├── message.tsx      # Message display component
│   │   └── sidebar.tsx      # Chat list sidebar
│   └── ui/                  # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ... (50+ components)
├── hooks/
│   ├── use-voice.ts     # Voice input/output hook
│   ├── use-toast.ts     # Toast notifications
│   └── use-mobile.tsx   # Mobile detection
├── lib/
│   ├── queryClient.ts   # TanStack Query config
│   └── utils.ts         # Utility functions
└── pages/
    ├── home.tsx         # Main chat interface
    ├── editor.tsx       # Code editor page
    ├── preview.tsx      # Preview page
    ├── google-services.tsx  # Google integrations
    └── not-found.tsx    # 404 page
```

---

## Design System

### Color Palette

The application uses CSS custom properties for theming with support for light and dark modes:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --secondary: 240 4.8% 95.9%;
  --muted: 240 4.8% 95.9%;
  --accent: 240 4.8% 95.9%;
  --destructive: 0 84.2% 60.2%;
}
```

### Typography

| Font | Usage |
|------|-------|
| **Inter** | Body text, UI elements |
| **Outfit** | Display text, headings |

### Spacing & Layout

- Container max-width: `max-w-4xl` (896px)
- Standard padding: `p-4` (16px)
- Border radius: `rounded-3xl` for major containers

---

## Core Components

### 1. Chat Sidebar (`sidebar.tsx`)

The sidebar displays the list of chat conversations with navigation capabilities.

```
┌────────────────────────┐
│  Meowstik     [+]   │  ← Header with new chat button
├────────────────────────┤
│  ┌──────────────────┐  │
│  │ Chat Title 1     │  │  ← Chat list items
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ Chat Title 2     │  │
│  └──────────────────┘  │
│  ...                   │
└────────────────────────┘
```

**Features:**
- Create new chats
- Delete existing chats
- Navigate between conversations
- Visual indication of active chat

### 2. Message Display (`message.tsx`)

Renders individual messages with support for structured content.

```
┌────────────────────────────────────────────┐
│  User                              3:45 PM │
│  ──────────────────────────────────────── │
│  How do I create a new file?               │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  ✨ Nebula                         3:45 PM │
│  ──────────────────────────────────────── │
│  Here's how to create a new file...        │
│                                            │
│  ┌─────────────────────────────────────┐   │
│  │ 📄 example.js                       │   │  ← File operation card
│  │ Created successfully                │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

**Features:**
- Markdown rendering with syntax highlighting
- Tool call result display
- File operation indicators
- Error message display
- Timestamp formatting

### 3. Input Area (`input-area.tsx`)

A sophisticated input component for composing messages.

```
┌─────────────────────────────────────────────────────┐
│  [📷 Preview] [📷 Preview]                          │  ← Attachment previews
│                                                     │
│  Ask Nebula anything...                             │  ← Placeholder
│  [User input text here]                             │  ← Auto-resizing textarea
│                                                     │
│  ────────────────────────────────────────────────  │
│  [🖥️] [📎] [🎤]                           [➤ Send] │  ← Action buttons
└─────────────────────────────────────────────────────┘
  Nebula may display inaccurate info...                  ← Disclaimer
```

**Features:**
- Auto-resizing textarea (grows up to 200px)
- Enter to send (Shift+Enter for newline)
- File attachment via drag-drop or button
- Screen capture integration
- Voice input toggle
- Animated send button with loading state
- Attachment preview with remove option

---

## User Interactions

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | Insert newline |

### Voice Input Flow

```
┌─────────────┐     Click Mic     ┌──────────────┐
│   Idle      │──────────────────►│  Listening   │
└─────────────┘                   └──────────────┘
                                        │
                                        │ Speech recognized
                                        ▼
                                  ┌──────────────┐
                                  │  Transcript  │
                                  │  appended    │
                                  └──────────────┘
```

### Screen Capture Flow

```
User clicks 🖥️ button
        │
        ▼
┌───────────────────┐
│ Select window/    │  ← Browser prompt
│ screen to share   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Capture frame &   │
│ add as attachment │
└───────────────────┘
```

### File Upload Flow

```
User clicks 📎 or drops file
        │
        ▼
┌───────────────────┐
│ Read file as      │
│ base64 DataURL    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Add to            │
│ attachments[]     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Show preview      │
│ (if image)        │
└───────────────────┘
```

---

## State Management

### Server State (TanStack Query)

```typescript
// Fetching chats
const { data: chats } = useQuery({
  queryKey: ["/api/chats"],
  queryFn: () => fetch("/api/chats").then(r => r.json())
});

// Sending messages with mutation
const sendMessage = useMutation({
  mutationFn: (data) => fetch("/api/messages", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  onSuccess: () => queryClient.invalidateQueries()
});
```

### Local State (React useState)

| State | Location | Purpose |
|-------|----------|---------|
| `input` | InputArea | Current text input |
| `attachments` | InputArea | Files waiting to be sent |
| `isListening` | useVoice | Voice recording status |
| `transcript` | useVoice | Accumulated speech text |

---

## Animation System

Meowstik uses Framer Motion for smooth, polished animations:

### Attachment Preview Animation

```typescript
<motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.8 }}
/>
```

### Button State Transitions

```css
.transition-all duration-300
```

### Loading States

- **Send Button**: Sparkles icon with `animate-pulse`
- **Voice Button**: Pulsing red background when recording

---

## Accessibility

### ARIA Labels

All interactive elements include appropriate `data-testid` attributes:

| Element | Test ID Pattern |
|---------|----------------|
| Send button | `button-send` |
| Voice input | `button-voice-input` |
| File attach | `button-file-attach` |
| Screen capture | `button-screen-capture` |
| Attachments | `attachment-preview-${id}` |
| Remove button | `button-remove-attachment-${id}` |

### Keyboard Navigation

- Full keyboard accessibility for all interactive elements
- Focus states with visible indicators
- Escape key to cancel operations

---

## Responsive Design

### Breakpoints

| Size | Behavior |
|------|----------|
| Mobile (`< 768px`) | Collapsible sidebar, full-width input |
| Tablet (`768px - 1024px`) | Side-by-side layout |
| Desktop (`> 1024px`) | Full layout with expanded sidebar |

### Mobile Optimizations

- Touch-friendly button sizes (minimum 44x44px)
- Swipe gestures for sidebar
- Optimized keyboard handling

---

## Component Library (shadcn/ui)

The application includes 50+ pre-built UI components:

### Layout Components
- Card, Dialog, Sheet, Drawer
- Accordion, Collapsible, Tabs

### Form Components
- Button, Input, Textarea, Select
- Checkbox, Radio, Switch, Slider

### Data Display
- Table, Badge, Avatar, Skeleton
- Progress, Toast, Alert

### Navigation
- Navigation Menu, Menubar, Dropdown Menu
- Breadcrumb, Pagination

### Overlays
- Dialog, Alert Dialog, Context Menu
- Hover Card, Popover, Tooltip
