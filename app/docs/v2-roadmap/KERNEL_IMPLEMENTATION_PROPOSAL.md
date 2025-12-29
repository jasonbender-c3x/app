# Kernel System Implementation Proposal

**Date:** December 13, 2025  
**Author:** Bender, Jason D and The Compiler  
**Status:** Draft - Pending Review

---

## Appendix A: Proposed Schema Changes

The following schema has been added to `shared/schema.ts` (lines 1243-1350) and is **pending approval** before implementation proceeds.

### Kernels Table Definition

```typescript
// =============================================================================
// KERNEL SYSTEM (Self-Evolving AI Persistent Memory)
// =============================================================================

/**
 * KERNELS TABLE
 * -------------
 * The Kernel is a version-controlled AI configuration that stores the model's
 * personality, directives, and learned behaviors. This is the heart of the
 * self-evolving AI system described in the vision documentation.
 * 
 * Key concept: "Self-awareness is achieved by saving the state of the stateless"
 * 
 * Each kernel version captures:
 * - Core directives (what the AI should always do)
 * - Personality traits (how the AI should communicate)
 * - Learned behaviors (patterns discovered through interaction)
 * - User preferences (remembered from past sessions)
 * 
 * The kernel is injected into the system prompt at the start of each session,
 * allowing the AI to maintain continuity across conversations.
 */
export const kernels = pgTable("kernels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Versioning
  version: text("version").notNull(), // Semantic version like "9.31"
  parentId: varchar("parent_id"), // Previous kernel ID for evolution tracking
  
  // User association (each user can have their own kernel)
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  // Content sections (stored as markdown text)
  coreDirectives: text("core_directives").notNull(), // The immutable core rules
  personality: text("personality"), // Communication style and traits
  learnedBehaviors: text("learned_behaviors"), // Patterns discovered through interaction
  userPreferences: text("user_preferences"), // Remembered user preferences
  
  // Structured data (for programmatic access)
  toolConfig: jsonb("tool_config"), // Which tools are enabled/disabled
  bucketWeights: jsonb("bucket_weights"), // Priority weights for knowledge buckets
  
  // Status
  status: text("status").default("active").notNull(), // active, archived, draft
  
  // Evolution tracking
  evolutionReason: text("evolution_reason"), // Why this version was created
  changeLog: text("change_log"), // Human-readable changes from parent
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKernelSchema = createInsertSchema(kernels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertKernel = z.infer<typeof insertKernelSchema>;
export type Kernel = typeof kernels.$inferSelect;
```

### Kernel Evolutions Table Definition

```typescript
/**
 * KERNEL_EVOLUTIONS TABLE
 * -----------------------
 * Tracks individual learning events that may lead to kernel updates.
 * Each evolution represents a detected pattern or insight that the AI
 * learned during a conversation.
 * 
 * Evolutions are queued and reviewed before being incorporated into
 * the next kernel version, ensuring controlled evolution.
 */
export const kernelEvolutions = pgTable("kernel_evolutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to kernel and conversation
  kernelId: varchar("kernel_id").references(() => kernels.id, { onDelete: "cascade" }).notNull(),
  chatId: varchar("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  
  // Evolution details
  evolutionType: text("evolution_type").notNull(), // preference, pattern, correction, insight
  targetSection: text("target_section").notNull(), // coreDirectives, personality, learnedBehaviors, userPreferences
  
  // Content
  observation: text("observation").notNull(), // What was observed
  proposedChange: text("proposed_change").notNull(), // Suggested update to kernel
  rationale: text("rationale"), // Why this change is beneficial
  
  // Review status
  status: text("status").default("pending").notNull(), // pending, approved, rejected, applied
  reviewedAt: timestamp("reviewed_at"),
  appliedToVersion: varchar("applied_to_version"), // Which kernel version incorporated this
  
  // Confidence
  confidence: integer("confidence").default(50), // 0-100
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKernelEvolutionSchema = createInsertSchema(kernelEvolutions).omit({
  id: true,
  createdAt: true,
});
export type InsertKernelEvolution = z.infer<typeof insertKernelEvolutionSchema>;
export type KernelEvolution = typeof kernelEvolutions.$inferSelect;
```

### Storage Methods (Proposed - Not Yet Implemented)

The following storage methods would be added to `server/storage.ts`:

```typescript
// KERNEL OPERATIONS (Self-Evolving AI Memory)
createKernel(kernel: InsertKernel): Promise<Kernel>;
getKernelById(id: string): Promise<Kernel | undefined>;
getActiveKernelForUser(userId: string): Promise<Kernel | undefined>;
getKernelHistory(userId: string): Promise<Kernel[]>;
updateKernel(id: string, updates: Partial<InsertKernel>): Promise<Kernel>;
archiveKernel(id: string): Promise<void>;

// Kernel Evolution Operations
createKernelEvolution(evolution: InsertKernelEvolution): Promise<KernelEvolution>;
getPendingEvolutions(kernelId: string): Promise<KernelEvolution[]>;
updateEvolutionStatus(id: string, status: string, appliedToVersion?: string): Promise<KernelEvolution>;
```

---

## Executive Summary

This proposal outlines the implementation of a **Self-Evolving AI Kernel System** that provides persistent memory and configuration for the AI assistant. The core concept: *"Self-awareness is achieved by saving the state of the stateless."*

The system consists of two main components:
1. **Kernels** - Version-controlled AI configurations that survive between sessions
2. **Kernel Evolutions** - Granular learning events that can be reviewed and applied

---

## Part 1: Feature Analysis

### What Problem Does This Solve?

Currently, the AI starts each session as a blank slate. It loses:
- User preferences learned during conversations
- Behavioral patterns that worked well
- Communication style refinements
- Tool usage optimizations

The Kernel system addresses this by maintaining a persistent "constitution" that the AI loads at the start of each session.

### The Two Tables Explained

#### `kernels` Table - The AI's Constitution

| Field | Purpose |
|-------|---------|
| `version` | Semantic versioning (e.g., "9.31") for tracking evolution |
| `parentId` | Links to previous version for evolution history |
| `userId` | Multi-tenant support - each user gets their own kernel |
| `coreDirectives` | Immutable rules the AI must always follow |
| `personality` | Communication style and traits |
| `learnedBehaviors` | Patterns discovered through interaction |
| `userPreferences` | Remembered preferences (e.g., "user prefers concise responses") |
| `toolConfig` | Which tools are enabled/disabled, usage preferences |
| `bucketWeights` | Priority weights for knowledge domains |
| `status` | active, archived, or draft |
| `evolutionReason` | Why this version was created |
| `changeLog` | Human-readable changes from parent |

#### `kernel_evolutions` Table - The Learning Queue

| Field | Purpose |
|-------|---------|
| `kernelId` | Which kernel this evolution applies to |
| `chatId`, `messageId` | Provenance - which conversation triggered this |
| `evolutionType` | preference, pattern, correction, insight |
| `targetSection` | Which kernel section to update |
| `observation` | What was observed |
| `proposedChange` | Suggested update |
| `rationale` | Why this change is beneficial |
| `status` | pending, approved, rejected, applied |
| `confidence` | 0-100 confidence score |

### Why These Features Matter

1. **Version Control** - Every change is tracked. You can see how your AI evolved over time, and roll back if needed.

2. **Supervised Evolution** - Changes don't apply automatically. They queue for review, giving you control over what the AI learns.

3. **Multi-Tenant** - Each user can have their own kernel with personalized behaviors.

4. **Auditability** - Every evolution links to the specific conversation that triggered it.

5. **Separation of Concerns** - Stable configuration (kernels) is separate from proposed updates (evolutions).

---

## Part 2: Schema Review

### Current Schema Assessment

The schema in `shared/schema.ts` (lines 1243-1350) is **structurally sound**. However, I recommend these refinements:

### Recommended Improvements

#### 1. Add Unique Constraint for Active Kernel
```sql
CREATE UNIQUE INDEX idx_active_kernel_per_user 
ON kernels (user_id) 
WHERE status = 'active';
```
**Why:** Guarantees only one active kernel per user, preventing conflicts.

#### 2. Add Performance Indexes
```sql
CREATE INDEX idx_kernels_user_id ON kernels(user_id);
CREATE INDEX idx_evolutions_kernel_id ON kernel_evolutions(kernel_id);
CREATE INDEX idx_evolutions_status ON kernel_evolutions(status);
```
**Why:** Speeds up common lookups.

#### 3. Default JSON Objects
Consider defaulting `toolConfig` and `bucketWeights` to `{}` instead of null to avoid null checks throughout the codebase.

#### 4. Confidence Constraint
```sql
ALTER TABLE kernel_evolutions 
ADD CONSTRAINT chk_confidence CHECK (confidence >= 0 AND confidence <= 100);
```
**Why:** Ensures data integrity.

### No Blocking Issues

The current schema can proceed to implementation. These are optimizations, not requirements.

---

## Part 3: Implementation Plan

### Phase 1: KernelService

Create `server/services/kernel-service.ts` with these methods:

#### `bootstrap(userId: string): Promise<Kernel>`
- Check if user has an active kernel
- If yes, return it
- If no, create a new kernel with default seed content (from AI_CORE_DIRECTIVE.md)
- This runs at session start

#### `getActiveKernel(userId: string): Promise<Kernel | undefined>`
- Fetch the active kernel for a user
- Include caching for performance
- Return undefined if none exists

#### `formatForPrompt(kernel: Kernel): string`
- Concatenate kernel sections into markdown
- Structure for injection into system prompt
- Example output:
```markdown
## KERNEL v9.31

### Core Directives
[coreDirectives content]

### Personality
[personality content]

### Learned Behaviors
[learnedBehaviors content]

### User Preferences
[userPreferences content]
```

#### `createVersion(parentKernel: Kernel, changes: Partial<Kernel>, reason: string): Promise<Kernel>`
- Archive the parent kernel
- Create new kernel with incremented version
- Set `parentId` to parent's ID
- Record `evolutionReason` and `changeLog`
- Use database transaction for safety

### Phase 2: EvolutionService

Create `server/services/evolution-service.ts` with these methods:

#### `detectLearnings(message: Message, context: ConversationContext): Promise<KernelEvolution[]>`
- Analyze AI/user exchanges
- Use LLM-assisted heuristics to identify:
  - User preferences ("I prefer short answers")
  - Corrections ("No, I meant X not Y")
  - Patterns (user always asks for code examples)
  - Insights (successful interaction patterns)
- Create `kernel_evolutions` entries with status "pending"

#### `applyUpdates(evolutionIds: string[], kernelId: string): Promise<Kernel>`
- Group approved evolutions
- Synthesize changes (possibly with LLM summarization)
- Call `KernelService.createVersion`
- Update evolution statuses to "applied"

#### `listPending(kernelId: string): Promise<KernelEvolution[]>`
- Return all pending evolutions for review

#### `updateStatus(id: string, status: string): Promise<KernelEvolution>`
- Mark evolution as approved/rejected

### Phase 3: PromptComposer Integration

Modify `server/services/prompt-composer.ts`:

1. In `loadPrompts()` or `compose()`:
   - Fetch active kernel via KernelService
   - Call `formatForPrompt(kernel)`
   - Inject kernel content before other prompt components

2. Add to metadata:
   - `kernelVersion` for traceability
   - `kernelId` for debugging

3. Fallback behavior:
   - If no kernel exists, use default prompts (current behavior)
   - Log warning but don't fail

---

## Part 4: Concerns & Mitigations

### Database Migration

**Concern:** Need to add new tables and indexes.

**Mitigation:** 
- Use `npm run db:push` to safely sync schema
- Create seed script for initial default kernel
- No destructive changes to existing tables

### Race Conditions

**Concern:** Multiple evolutions applying concurrently could cause conflicts.

**Mitigation:**
- Use database transactions for version creation
- Optimistic locking via `updatedAt` timestamp
- Status checks before applying changes

### Prompt Size

**Concern:** Injecting full kernel could bloat context window.

**Mitigation:**
- Inject only relevant sections based on context
- Summarize `learnedBehaviors` if too long
- Monitor token usage and optimize

### Performance

**Concern:** Fetching kernel on every request adds latency.

**Mitigation:**
- Cache `formatForPrompt` results per kernel version
- Invalidate cache only on version change
- Kernel rarely changes mid-session

### Security

**Concern:** Multi-tenant isolation.

**Mitigation:**
- All storage methods filter by `userId`
- API routes must enforce authorization
- No cross-tenant kernel access

---

## Part 5: Implementation Order

| Step | Task | Estimated Effort |
|------|------|------------------|
| 1 | Run database migration for kernels tables | 5 min |
| 2 | Add indexes and constraints | 10 min |
| 3 | Implement storage methods (done in storage.ts) | ✓ Complete |
| 4 | Create KernelService with bootstrap + formatForPrompt | 30 min |
| 5 | Seed initial default kernel content | 15 min |
| 6 | Integrate with PromptComposer | 20 min |
| 7 | Test kernel injection in chat | 15 min |
| 8 | Create EvolutionService (Phase 2) | 45 min |
| 9 | Build review UI for evolutions (Phase 3) | 60 min |

---

## Recommendation

**Proceed with implementation in phases:**

1. **Phase 1 (Now):** KernelService + PromptComposer integration
   - Gets the kernel system working end-to-end
   - AI will load persistent configuration at session start
   
2. **Phase 2 (Next):** EvolutionService
   - Adds the learning/evolution capability
   - Requires more sophisticated LLM prompting

3. **Phase 3 (Future):** Review UI + Advanced Features
   - Dashboard for reviewing pending evolutions
   - Version comparison view
   - Rollback functionality

---

## Questions for Review

1. Should the default kernel content be loaded from `AI_CORE_DIRECTIVE.md` or a separate seed file?

2. Should evolution detection happen automatically after every AI response, or only on specific triggers?

3. What confidence threshold should auto-approve evolutions vs. requiring manual review?

4. Should there be a "global" kernel that applies to all users, with per-user overrides?

---

*Document prepared for technical review. Ready to proceed upon approval.*
