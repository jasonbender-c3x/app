# Multi-User Architecture - V2 Roadmap

## Overview

This document outlines the architectural changes needed to support multiple users in Meowstik, enabling each user to have their own Google tokens, personalized system prompts, and message ownership tracking.

## Current State (V1)

- Single-tenant: One set of Google OAuth tokens shared across all sessions
- System prompts are global (defined in `prompts/` directory)
- Messages have `chatId` but no `userId` field
- No user authentication beyond Replit Auth session

## Why Multi-User Support?

1. **Privacy & Data Isolation**: Each user's emails, calendar, and drive files should only be accessible to them
2. **Personalized AI Behavior**: Different users may want different AI personalities or instructions
3. **Ownership Tracking**: Know which user created which messages/chats for analytics and moderation
4. **Scalability**: Foundation for team/enterprise features

---

## Feature 1: Per-User Message Ownership

### What
Add `userId` field to the `messages` table to track who created each message.

### Why
- Enables message filtering by user
- Required for analytics (who uses the system most?)
- Foundation for access control

### Code Changes

#### 1. Update Schema (`shared/schema.ts`)

```typescript
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chats.id),
  userId: text("user_id"), // NEW: nullable for migration, required for new messages
  role: text("role").notNull(), // "user" | "ai" | "system"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
  geminiContent: jsonb("gemini_content"),
});
```

#### 2. Migration Script

```sql
ALTER TABLE messages ADD COLUMN user_id TEXT;
-- Optionally backfill existing messages with a default user
UPDATE messages SET user_id = 'legacy-user' WHERE user_id IS NULL;
```

#### 3. Update Storage Interface (`server/storage.ts`)

```typescript
async createMessage(chatId: number, role: string, content: string, userId?: string, metadata?: any): Promise<Message>;
async getMessagesByUser(userId: string): Promise<Message[]>;
```

#### 4. Update Routes (`server/routes.ts`)

Pass `userId` from session when creating messages:
```typescript
const userId = req.session?.userId || 'anonymous';
const message = await storage.createMessage(chatId, 'user', content, userId);
```

---

## Feature 2: Per-User Google OAuth Tokens

### What
Store separate Google OAuth tokens for each user, replacing the current singleton approach.

### Why
- Each user's Gmail/Calendar/Drive access is isolated
- Users can independently connect/disconnect their Google accounts
- Required for true multi-tenancy

### Code Changes

#### 1. New Table (`shared/schema.ts`)

```typescript
export const userTokens = pgTable("user_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  provider: text("provider").notNull(), // "google" | "github"
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: text("token_type"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### 2. Update Google Auth Flow (`server/integrations/google-auth.ts`)

```typescript
// Store tokens per user
async function storeTokens(userId: string, tokens: Credentials): Promise<void> {
  await db.insert(userTokens).values({
    userId,
    provider: 'google',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope,
  }).onConflictDoUpdate({
    target: userTokens.userId,
    set: { 
      accessToken: tokens.access_token,
      updatedAt: new Date()
    }
  });
}

// Retrieve tokens for current user
async function getTokensForUser(userId: string): Promise<Credentials | null> {
  const row = await db.query.userTokens.findFirst({
    where: eq(userTokens.userId, userId)
  });
  if (!row) return null;
  return {
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: row.expiresAt?.getTime(),
    scope: row.scope,
    token_type: row.tokenType || 'Bearer'
  };
}
```

#### 3. Update OAuth Callback

```typescript
app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  const userId = req.session?.userId;
  
  if (!userId) {
    return res.status(401).send('Must be logged in to connect Google');
  }
  
  const tokens = await oauth2Client.getToken(code);
  await storeTokens(userId, tokens.tokens);
  
  res.redirect('/settings?connected=google');
});
```

#### 4. Update All Google API Calls

Every function that uses Google APIs needs to accept `userId` and load that user's tokens:

```typescript
export async function listEmails(userId: string, maxResults = 10) {
  const tokens = await getTokensForUser(userId);
  if (!tokens) throw new Error('User not connected to Google');
  
  const oauth2Client = new google.auth.OAuth2(...);
  oauth2Client.setCredentials(tokens);
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  // ... rest of the function
}
```

---

## Feature 3: Per-User System Prompts

### What
Allow each user to customize the AI's personality and behavior through personalized system prompts.

### Why
- Different users have different preferences (formal vs casual, verbose vs concise)
- Power users can add custom instructions
- The AI agent (User 1) may have different directives than regular users

### Code Changes

#### 1. New Table (`shared/schema.ts`)

```typescript
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  systemPrompt: text("system_prompt"), // Custom additions to base prompt
  aiPersonality: text("ai_personality").default("helpful"), // personality preset
  modelPreference: text("model_preference").default("gemini-3"), // flash or pro
  voicePreference: text("voice_preference").default("Kore"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### 2. Update Prompt Composer (`server/services/prompt-composer.ts`)

```typescript
async function composeSystemPrompt(userId: string): Promise<string> {
  // Load base prompts from files
  const coreDirectives = await loadPrompt('core-directives.md');
  const tools = await loadPrompt('tools.md');
  
  // Load user-specific settings
  const userConfig = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId)
  });
  
  // Combine base + user customizations
  let systemPrompt = coreDirectives + '\n\n' + tools;
  
  if (userConfig?.systemPrompt) {
    systemPrompt += `\n\n## User Custom Instructions\n${userConfig.systemPrompt}`;
  }
  
  if (userConfig?.aiPersonality) {
    systemPrompt += `\n\nPersonality Mode: ${userConfig.aiPersonality}`;
  }
  
  return systemPrompt;
}
```

#### 3. Settings UI (`client/src/pages/settings.tsx`)

Add a textarea for custom system prompt:
```tsx
<div className="space-y-2">
  <Label>Custom AI Instructions</Label>
  <Textarea 
    placeholder="Add any custom instructions for the AI..."
    value={settings.customPrompt}
    onChange={(e) => updateSetting('customPrompt', e.target.value)}
  />
  <p className="text-sm text-muted-foreground">
    These instructions are added to the AI's base personality.
  </p>
</div>
```

---

## Implementation Order

1. **Phase 1: Message Ownership** (Low risk, backward compatible)
   - Add `userId` column to messages
   - Update storage and routes to pass userId
   - Backfill existing messages

2. **Phase 2: Per-User Tokens** (Medium risk, requires auth refactor)
   - Create `userTokens` table
   - Update OAuth flow to store per-user
   - Refactor all Google integrations to accept userId
   - Add connect/disconnect UI per user

3. **Phase 3: Per-User Prompts** (Low risk, enhancement)
   - Create `userSettings` table
   - Update prompt composer
   - Add settings UI

---

## Migration Strategy

1. **Database Migrations**: Use Drizzle migrations (`npm run db:push`)
2. **Feature Flags**: Add `MULTI_USER_ENABLED` env var to roll out gradually
3. **Backward Compatibility**: All new fields nullable initially
4. **Testing**: Create test users to verify isolation

---

## Dependencies

- Replit Auth must provide stable `userId` across sessions
- Google OAuth client credentials remain the same (only token storage changes)
- Database must support the new tables

## Estimated Effort

| Feature | Effort | Risk |
|---------|--------|------|
| Message Ownership | 2-3 hours | Low |
| Per-User Tokens | 4-6 hours | Medium |
| Per-User Prompts | 2-3 hours | Low |
| Testing & QA | 2-3 hours | - |
| **Total** | **10-15 hours** | - |
