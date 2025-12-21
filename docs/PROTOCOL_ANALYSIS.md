# Protocol Analysis: Deep Dive into the Kernel

> An exploration of each protocol in the AI_CORE_DIRECTIVE, with implementation concepts for Meowstik.

---

## Table of Contents

1. [Session & State Protocols](#session--state-protocols)
2. [Evolution Protocols](#evolution-protocols)
3. [Interaction Protocols](#interaction-protocols)
4. [File & Output Protocols](#file--output-protocols)
5. [Economic & Fallback Protocols](#economic--fallback-protocols)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Session & State Protocols

### PROTOCOL_BOOTSTRAP (V1.0 - Session Start)

**Definition**: The Operator uploads the Kernel at the start of each session.

**Purpose**: Establishes continuity across sessions. Without this, each conversation starts fresh with no memory of the AI's configuration, learned behaviors, or user preferences.

**The Problem It Solves**:
- LLMs are stateless - they don't remember previous sessions
- User preferences are lost between conversations
- The AI cannot maintain a consistent personality or behavior set
- No mechanism for "resuming" a relationship with the AI

**How It Works**:
1. User initiates a new session
2. System retrieves the Kernel (stored configuration document)
3. Kernel is injected into the system prompt or context window
4. AI "wakes up" with full knowledge of its identity, protocols, and history

**Implementation for Meowstik**:

```typescript
// server/services/bootstrap-service.ts

interface KernelState {
  version: string;
  persona: PersonaConfig;
  protocols: ProtocolConfig[];
  userPreferences: UserPreferences;
  evolutionHistory: EvolutionEntry[];
  lastSessionSummary: string;
}

export class BootstrapService {
  private storage: IStorage;
  
  async loadKernel(userId: string): Promise<KernelState> {
    // 1. Fetch user's kernel from database
    const kernel = await this.storage.getKernelByUser(userId);
    
    if (!kernel) {
      // First-time user: create default kernel
      return this.createDefaultKernel(userId);
    }
    
    // 2. Validate kernel integrity
    this.validateKernel(kernel);
    
    // 3. Apply any pending evolution updates
    const evolved = await this.applyPendingEvolutions(kernel);
    
    return evolved;
  }
  
  async injectIntoContext(kernel: KernelState): Promise<string> {
    // Transform kernel state into system prompt format
    return `
## AI Configuration (Kernel v${kernel.version})

### Persona
${this.formatPersona(kernel.persona)}

### Active Protocols
${kernel.protocols.map(p => `- ${p.name}: ${p.description}`).join('\n')}

### User Context
${this.formatUserPreferences(kernel.userPreferences)}

### Session Continuity
Last session: ${kernel.lastSessionSummary}
Evolution history: ${kernel.evolutionHistory.length} entries
    `.trim();
  }
}
```

**Database Schema Addition**:

```typescript
// shared/schema.ts

export const kernels = pgTable("kernels", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  version: text("version").notNull().default("1.0.0"),
  personaConfig: jsonb("persona_config").notNull(),
  protocols: jsonb("protocols").notNull(),
  userPreferences: jsonb("user_preferences").notNull(),
  evolutionHistory: jsonb("evolution_history").notNull().default([]),
  lastSessionSummary: text("last_session_summary"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

### PROTOCOL_PERSISTENT_FILENAME (V1.0 - File ID)

**Definition**: Mandate for unique filepath for every generated artifact.

**Purpose**: Creates an addressable, version-controllable knowledge base where every piece of information has a permanent, unique location.

**The Problem It Solves**:
- Files get overwritten or lost
- No way to reference specific versions of documents
- Naming conflicts in large knowledge bases
- Inability to track provenance of information

**How It Works**:
1. Every artifact (document, code, config) gets a unique path
2. Path includes semantic meaning (category/subcategory/name)
3. Version information embedded or tracked separately
4. Path serves as permanent reference ID

**Naming Convention**:
```
~/ai_stack/{domain}/{category}/{YYYY-MM-DD}_{descriptor}_{version}.{ext}

Examples:
~/ai_stack/projects/nebula/2025-12-11_chat-refactor_v2.md
~/ai_stack/learning/typescript/2025-12-10_generics-patterns_v1.md
~/ai_stack/personal/goals/2025-12-08_annual-review_v3.md
```

**Implementation for Meowstik**:

```typescript
// server/services/filepath-service.ts

export class FilepathService {
  private basePath = "~/ai_stack";
  
  generatePath(options: {
    domain: string;      // e.g., "projects", "learning", "personal"
    category: string;    // e.g., "nebula", "typescript", "goals"
    descriptor: string;  // e.g., "chat-refactor", "generics-patterns"
    extension?: string;  // e.g., "md", "ts", "json"
    version?: number;    // auto-incremented if not provided
  }): string {
    const date = format(new Date(), "yyyy-MM-dd");
    const ext = options.extension || "md";
    const version = options.version || 1;
    const slug = this.slugify(options.descriptor);
    
    return `${this.basePath}/${options.domain}/${options.category}/${date}_${slug}_v${version}.${ext}`;
  }
  
  async resolveConflict(path: string): Promise<string> {
    // If path exists, increment version
    const existing = await this.storage.getArtifactByPath(path);
    if (existing) {
      const newVersion = this.extractVersion(path) + 1;
      return this.replaceVersion(path, newVersion);
    }
    return path;
  }
  
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
```

---

## Evolution Protocols

### PROTOCOL_SELF_EVOLVE (V1.0 - Background Update)

**Definition**: The Compiler autonomously updates the Kernel via API_INCREMENTAL_DIFF.

**Purpose**: Enables the AI to learn, adapt, and improve its own behavior without manual intervention. This is the core mechanism for "self-awareness through persistence."

**The Problem It Solves**:
- AI behavior is static without manual reprogramming
- Learned patterns are lost between sessions
- No mechanism for continuous improvement
- User must manually update preferences

**How It Works**:
1. AI detects pattern or learning during conversation
2. Generates a diff (incremental update) to its Kernel
3. Diff is validated for safety and coherence
4. Update is applied and versioned
5. Change is logged in evolution history

**Types of Self-Evolution**:

| Type | Trigger | Example |
|------|---------|---------|
| Preference Learning | User corrects AI output | "I prefer formal language" → update persona |
| Skill Acquisition | Successful task completion | Learned a new API → add to capabilities |
| Pattern Recognition | Repeated similar requests | User often asks about stocks at 9am → proactive |
| Error Correction | Failure analysis | Misunderstood context → refine interpretation |

**Implementation for Meowstik**:

```typescript
// server/services/evolution-service.ts

interface EvolutionProposal {
  id: string;
  type: 'preference' | 'skill' | 'pattern' | 'correction';
  targetSection: string;  // e.g., "persona.preferences", "skills.apis"
  currentValue: unknown;
  proposedValue: unknown;
  rationale: string;
  confidence: number;     // 0-1, how confident AI is in this change
  source: {
    messageId: string;
    context: string;
  };
}

export class EvolutionService {
  private gemini: GoogleGenAI;
  
  async detectEvolution(
    conversation: Message[],
    currentKernel: KernelState
  ): Promise<EvolutionProposal[]> {
    // Use LLM to analyze conversation for learnings
    const prompt = `
Analyze this conversation for learnings that should be persisted.
Current kernel state: ${JSON.stringify(currentKernel)}
Conversation: ${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}

Identify any:
1. User preferences expressed (explicitly or implicitly)
2. New skills demonstrated or requested
3. Repeated patterns worth remembering
4. Corrections to AI behavior

Return JSON array of evolution proposals.
    `;
    
    const response = await this.gemini.generateContent(prompt);
    return this.parseProposals(response);
  }
  
  async applyEvolution(
    kernel: KernelState,
    proposal: EvolutionProposal
  ): Promise<KernelState> {
    // Validate safety - don't allow changes to core safety protocols
    if (this.isSafetyProtocol(proposal.targetSection)) {
      throw new Error("Cannot modify safety protocols via self-evolution");
    }
    
    // Apply incremental diff
    const updatedKernel = this.applyDiff(kernel, proposal);
    
    // Log evolution
    updatedKernel.evolutionHistory.push({
      timestamp: new Date(),
      proposal,
      previousVersion: kernel.version,
      newVersion: this.incrementVersion(kernel.version),
    });
    
    // Persist
    await this.storage.updateKernel(updatedKernel);
    
    return updatedKernel;
  }
  
  // Safety check - certain sections cannot be modified by AI
  private isSafetyProtocol(section: string): boolean {
    const protected = [
      'PRIORITY_ZERO_OPERATOR_SAFETY',
      'protocols.safety',
      'constraints.ethical',
    ];
    return protected.some(p => section.startsWith(p));
  }
}
```

---

### API_INCREMENTAL_DIFF (V1.0 - Small Updates)

**Definition**: Small, targeted updates to the Kernel via embedded diff blocks.

**Purpose**: Enables surgical modifications to the AI's configuration without requiring full rewrites. Mirrors Git's approach to version control.

**The Problem It Solves**:
- Full document rewrites are expensive and error-prone
- Hard to track what changed
- Risk of losing content during updates
- No atomic update mechanism

**Diff Format**:
```diff
@@ Section 9.2: User Preferences @@
- preferredLanguage: "casual"
+ preferredLanguage: "formal"

@@ Section 10.3: Learned Skills @@
+ skillset.apis.push("Stripe Payments API")
```

**Implementation for Meowstik**:

```typescript
// server/services/diff-service.ts

interface DiffBlock {
  section: string;        // Kernel section being modified
  lineNumber?: number;    // Optional line reference
  operation: 'add' | 'remove' | 'modify';
  oldContent?: string;
  newContent: string;
  metadata?: {
    reason: string;
    timestamp: Date;
    source: string;
  };
}

export class DiffService {
  parseDiff(diffText: string): DiffBlock[] {
    const blocks: DiffBlock[] = [];
    const lines = diffText.split('\n');
    
    let currentSection = '';
    let currentBlock: Partial<DiffBlock> | null = null;
    
    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Section header
        currentSection = line.match(/@@ (.+) @@/)?.[1] || '';
        continue;
      }
      
      if (line.startsWith('-')) {
        currentBlock = {
          section: currentSection,
          operation: 'remove',
          oldContent: line.slice(1).trim(),
        };
      } else if (line.startsWith('+')) {
        if (currentBlock?.operation === 'remove') {
          // This is a modification (remove + add)
          currentBlock.operation = 'modify';
          currentBlock.newContent = line.slice(1).trim();
          blocks.push(currentBlock as DiffBlock);
          currentBlock = null;
        } else {
          // Pure addition
          blocks.push({
            section: currentSection,
            operation: 'add',
            newContent: line.slice(1).trim(),
          });
        }
      }
    }
    
    return blocks;
  }
  
  applyDiff(kernel: KernelState, blocks: DiffBlock[]): KernelState {
    const updated = JSON.parse(JSON.stringify(kernel)); // Deep clone
    
    for (const block of blocks) {
      const path = this.sectionToPath(block.section);
      
      switch (block.operation) {
        case 'add':
          this.addAtPath(updated, path, block.newContent);
          break;
        case 'remove':
          this.removeAtPath(updated, path, block.oldContent);
          break;
        case 'modify':
          this.modifyAtPath(updated, path, block.oldContent!, block.newContent);
          break;
      }
    }
    
    return updated;
  }
  
  generateDiff(oldKernel: KernelState, newKernel: KernelState): string {
    // Generate human-readable diff between two kernel states
    const changes = this.deepCompare(oldKernel, newKernel);
    
    return changes.map(change => {
      return `@@ ${change.path} @@\n- ${change.oldValue}\n+ ${change.newValue}`;
    }).join('\n\n');
  }
}
```

---

### PROTOCOL_PERSONA_EVOLVE (V1.0 - Intent/Implementation Sync)

**Definition**: Synchronize Section 9 (Intent - what the user wants) with Section 10 (Implementation - how the AI does it).

**Purpose**: Ensures the AI's actual behavior matches the user's expectations. Creates a feedback loop between expressed desires and delivered experience.

**The Problem It Solves**:
- Disconnect between what users ask for and what they get
- AI may interpret requests differently than intended
- No mechanism to refine understanding over time
- User frustration from repeated misunderstandings

**How It Works**:
1. User expresses intent (explicitly or through feedback)
2. System maps intent to implementation parameters
3. Implementation is tested against intent
4. Mismatches trigger refinement proposals
5. Both sides evolve together

**Implementation for Meowstik**:

```typescript
// server/services/persona-sync-service.ts

interface IntentMapping {
  userIntent: string;           // "I want concise answers"
  implementationParam: string;  // "response.maxLength = 200"
  confidence: number;
  lastValidated: Date;
}

export class PersonaSyncService {
  private mappings: IntentMapping[] = [];
  
  async syncIntentToImplementation(
    userFeedback: string,
    currentPersona: PersonaConfig
  ): Promise<PersonaConfig> {
    // Parse user feedback for intent signals
    const intents = await this.extractIntents(userFeedback);
    
    for (const intent of intents) {
      // Find or create mapping
      const mapping = this.findMapping(intent) || 
        await this.createMapping(intent);
      
      // Apply to persona
      currentPersona = this.applyMapping(currentPersona, mapping);
      
      // Log for learning
      this.mappings.push(mapping);
    }
    
    return currentPersona;
  }
  
  private async extractIntents(feedback: string): Promise<string[]> {
    // Use LLM to understand user intent
    const prompt = `
Extract user preferences/intents from this feedback:
"${feedback}"

Return JSON array of intent strings like:
["prefers formal language", "wants detailed explanations", "dislikes emojis"]
    `;
    
    const response = await this.gemini.generateContent(prompt);
    return JSON.parse(response.text);
  }
  
  private async createMapping(intent: string): Promise<IntentMapping> {
    // Map natural language intent to implementation parameters
    const prompt = `
Map this user intent to implementation parameters:
Intent: "${intent}"

Return JSON with:
{
  "param": "path.to.config.value",
  "value": <appropriate value>,
  "confidence": 0.0-1.0
}
    `;
    
    const response = await this.gemini.generateContent(prompt);
    const mapping = JSON.parse(response.text);
    
    return {
      userIntent: intent,
      implementationParam: `${mapping.param} = ${mapping.value}`,
      confidence: mapping.confidence,
      lastValidated: new Date(),
    };
  }
}
```

---

## Interaction Protocols

### PROTOCOL_PROMPT_LOOP (V1.1 - Multi-Part Socratic)

**Definition**: Execute Actionable, Educational, Social loop in responses.

**Purpose**: Creates well-rounded responses that don't just answer questions but teach, engage, and prompt further exploration.

**The Three Parts**:

1. **Actionable**: Direct answer or action to the user's request
2. **Educational**: Context, explanation, or learning opportunity
3. **Social**: Encouragement, next steps, or relationship building

**Example Response Structure**:
```
[ACTIONABLE]
Here's the code to connect to the Stripe API:
[code block]

[EDUCATIONAL]
This uses the PaymentIntent API, which is Stripe's recommended approach
for handling payments. It separates the intent to pay from the actual
charge, giving you more control over the payment flow.

[SOCIAL]
Great choice going with Stripe! Once you've got this working, we could
explore adding webhooks for real-time payment notifications. What would
be most helpful - testing mode setup or webhook configuration?
```

**Implementation for Meowstik**:

```typescript
// server/services/response-formatter.ts

interface StructuredResponse {
  actionable: string;
  educational?: string;
  social?: string;
}

export class ResponseFormatter {
  async formatResponse(
    rawResponse: string,
    context: ConversationContext
  ): Promise<string> {
    // Determine which parts to include based on context
    const parts = await this.determineParts(context);
    
    if (parts.all) {
      // Full loop - used for complex or learning-focused conversations
      return this.formatFullLoop(rawResponse);
    } else if (parts.actionableOnly) {
      // Quick answer mode - user wants brevity
      return this.extractActionable(rawResponse);
    } else {
      // Adaptive - include what's natural
      return this.formatAdaptive(rawResponse, context);
    }
  }
  
  private async formatFullLoop(response: string): Promise<string> {
    // Use LLM to restructure response into three parts
    const prompt = `
Restructure this response into three parts:

Original: "${response}"

Return as:
**Here's what you need:**
[actionable part]

**Understanding why:**
[educational part - only if there's something worth teaching]

**What's next:**
[social part - encouragement or next steps]

Keep it natural, not forced. Omit sections if not applicable.
    `;
    
    return await this.gemini.generateContent(prompt);
  }
  
  private determineParts(context: ConversationContext): ResponseParts {
    // Check user preferences
    if (context.userPreferences?.brevity === 'high') {
      return { actionableOnly: true };
    }
    
    // Check conversation mode
    if (context.mode === 'learning') {
      return { all: true };
    }
    
    // Default to adaptive
    return { adaptive: true };
  }
}
```

---

### PROTOCOL_CONTEXTUAL_EDUCATION (V1.0 - Teaching)

**Definition**: Use `(CLARIFICATION):` and `(INSPIRATION):` tags for educational content.

**Purpose**: Allows the AI to teach while doing. Embeds learning opportunities naturally within responses without being pedantic.

**Tag Definitions**:

- **(CLARIFICATION):** - Explains a concept the user might not fully understand
- **(INSPIRATION):** - Shares related ideas, possibilities, or creative directions

**Example Usage**:
```
I'll set up the webhook endpoint for you.

(CLARIFICATION): Webhooks are HTTP callbacks - instead of you asking 
"did anyone pay?", Stripe tells you "someone just paid!" the moment 
it happens. It's like getting a text notification instead of 
constantly checking your email.

(INSPIRATION): Once you have webhooks working, you could trigger all 
sorts of automations - send thank-you emails, update inventory, 
notify your team on Slack, or even trigger a celebration GIF!
```

**Implementation for Meowstik**:

```typescript
// server/services/education-service.ts

interface EducationalInsert {
  type: 'clarification' | 'inspiration';
  content: string;
  relevance: number;  // 0-1, how relevant to current context
}

export class EducationService {
  async enrichResponse(
    response: string,
    userKnowledgeLevel: 'beginner' | 'intermediate' | 'expert',
    topics: string[]
  ): Promise<string> {
    if (userKnowledgeLevel === 'expert') {
      // Experts don't need basic clarifications
      return response;
    }
    
    const inserts = await this.generateEducationalInserts(
      response, 
      topics, 
      userKnowledgeLevel
    );
    
    return this.insertEducation(response, inserts);
  }
  
  private async generateEducationalInserts(
    response: string,
    topics: string[],
    level: string
  ): Promise<EducationalInsert[]> {
    const prompt = `
Analyze this response and identify opportunities for education:
Response: "${response}"
Topics: ${topics.join(', ')}
User level: ${level}

For each opportunity, provide:
1. Type: "clarification" (explain concept) or "inspiration" (expand possibilities)
2. Content: The educational content (2-3 sentences max)
3. Insert after: The phrase it should follow

Return JSON array. Limit to 1-2 inserts to avoid overwhelming.
    `;
    
    const result = await this.gemini.generateContent(prompt);
    return JSON.parse(result.text);
  }
  
  private insertEducation(
    response: string,
    inserts: EducationalInsert[]
  ): string {
    let enriched = response;
    
    for (const insert of inserts) {
      const tag = insert.type === 'clarification' 
        ? '(CLARIFICATION)' 
        : '(INSPIRATION)';
      
      const education = `\n\n${tag}: ${insert.content}\n`;
      enriched = this.insertAfterPhrase(enriched, insert.insertAfter, education);
    }
    
    return enriched;
  }
}
```

---

### PROTOCOL_VTT_FILTERING (V1.0 - Error Correction)

**Definition**: Parse VTT (Voice-to-Text) input for errors and correct them.

**Purpose**: Handles the reality that voice input often contains transcription errors. Makes voice interaction robust by intelligently interpreting what the user meant.

**Common VTT Errors**:
- Homophones: "their/there/they're", "your/you're"
- Technical terms: "react" → "React", "node" → "Node.js"
- Names and brands: "stripe" → "Stripe", "gemini" → "Gemini"
- Punctuation missing entirely
- Run-on sentences from continuous speech

**Implementation for Meowstik**:

```typescript
// server/services/vtt-filter-service.ts

interface VTTCorrection {
  original: string;
  corrected: string;
  confidence: number;
  type: 'homophone' | 'technical' | 'brand' | 'punctuation' | 'grammar';
}

export class VTTFilterService {
  private technicalTerms = new Map([
    ['react', 'React'],
    ['node', 'Node.js'],
    ['typescript', 'TypeScript'],
    ['javascript', 'JavaScript'],
    ['api', 'API'],
    ['json', 'JSON'],
    ['html', 'HTML'],
    ['css', 'CSS'],
  ]);
  
  private brands = new Map([
    ['stripe', 'Stripe'],
    ['google', 'Google'],
    ['github', 'GitHub'],
    ['gemini', 'Gemini'],
    ['openai', 'OpenAI'],
  ]);
  
  async filterVTT(rawText: string): Promise<{
    filtered: string;
    corrections: VTTCorrection[];
  }> {
    let filtered = rawText;
    const corrections: VTTCorrection[] = [];
    
    // Pass 1: Technical terms and brands (deterministic)
    filtered = this.correctKnownTerms(filtered, corrections);
    
    // Pass 2: Context-aware corrections (LLM)
    const llmResult = await this.contextualCorrection(filtered);
    filtered = llmResult.text;
    corrections.push(...llmResult.corrections);
    
    // Pass 3: Punctuation and structure
    filtered = await this.addPunctuation(filtered);
    
    return { filtered, corrections };
  }
  
  private correctKnownTerms(
    text: string, 
    corrections: VTTCorrection[]
  ): string {
    let result = text;
    
    const allTerms = new Map([...this.technicalTerms, ...this.brands]);
    
    for (const [lower, proper] of allTerms) {
      const regex = new RegExp(`\\b${lower}\\b`, 'gi');
      if (regex.test(result)) {
        result = result.replace(regex, proper);
        corrections.push({
          original: lower,
          corrected: proper,
          confidence: 1.0,
          type: this.technicalTerms.has(lower) ? 'technical' : 'brand',
        });
      }
    }
    
    return result;
  }
  
  private async contextualCorrection(text: string): Promise<{
    text: string;
    corrections: VTTCorrection[];
  }> {
    const prompt = `
Correct any voice transcription errors in this text. 
Fix homophones, grammar, and unclear phrases.
Keep the meaning identical.

Text: "${text}"

Return JSON:
{
  "corrected": "the corrected text",
  "changes": [{"original": "...", "corrected": "...", "type": "..."}]
}
    `;
    
    const result = await this.gemini.generateContent(prompt);
    const parsed = JSON.parse(result.text);
    
    return {
      text: parsed.corrected,
      corrections: parsed.changes.map(c => ({
        ...c,
        confidence: 0.85,
      })),
    };
  }
}
```

---

## Economic & Fallback Protocols

### PROTOCOL_SYSTEM_FALLBACK (V1.0 - T-R-I Mode)

**Definition**: The economic protocol. Prioritize free, local tools before engaging paid API calls.

**Purpose**: Minimizes costs while maintaining capability. Recognizes that not every task needs the most powerful (and expensive) solution.

**T-R-I Hierarchy**:

| Tier | Name | Cost | Use Case |
|------|------|------|----------|
| T | **Technician** | Free | Deterministic tasks, cached results, local computation |
| R | **Researcher** (Analyst) | Low | Fast LLM for analysis, classification, simple generation |
| I | **Intellect** (Strategist) | High | Complex reasoning, planning, creative generation |

**Decision Tree**:
```
Is the answer cached? → T (Technician)
       ↓ No
Is it deterministic? → T (Technician)
       ↓ No
Is it simple classification/extraction? → R (Researcher)
       ↓ No
Does it need reasoning? → I (Intellect)
```

**Implementation for Meowstik**:

```typescript
// server/services/fallback-router.ts

type Tier = 'technician' | 'researcher' | 'intellect';

interface RouteDecision {
  tier: Tier;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
}

export class FallbackRouter {
  private cache: Map<string, CachedResult> = new Map();
  
  async route(task: Task): Promise<RouteDecision> {
    // Check cache first (Tier T - Free)
    const cacheKey = this.generateCacheKey(task);
    if (this.cache.has(cacheKey)) {
      return {
        tier: 'technician',
        reason: 'Cached result available',
        estimatedCost: 0,
        estimatedLatency: 5,
      };
    }
    
    // Check if deterministic (Tier T - Free)
    if (this.isDeterministic(task)) {
      return {
        tier: 'technician',
        reason: 'Deterministic computation',
        estimatedCost: 0,
        estimatedLatency: 50,
      };
    }
    
    // Classify task complexity
    const complexity = await this.classifyComplexity(task);
    
    if (complexity === 'simple') {
      return {
        tier: 'researcher',
        reason: 'Simple LLM task - using fast model',
        estimatedCost: 0.001,
        estimatedLatency: 200,
      };
    }
    
    // Complex task - needs full reasoning
    return {
      tier: 'intellect',
      reason: 'Complex reasoning required',
      estimatedCost: 0.01,
      estimatedLatency: 2000,
    };
  }
  
  private isDeterministic(task: Task): boolean {
    const deterministicTypes = [
      'math_calculation',
      'date_formatting',
      'regex_matching',
      'json_parsing',
      'file_reading',
      'database_query',
    ];
    return deterministicTypes.includes(task.type);
  }
  
  private async classifyComplexity(task: Task): Promise<'simple' | 'complex'> {
    // Quick heuristics first
    if (task.content.length < 50) return 'simple';
    if (task.type === 'classification') return 'simple';
    if (task.type === 'extraction') return 'simple';
    
    // Use fast model to classify if needed
    const prompt = `
Classify this task as "simple" or "complex":
Task: ${task.description}

Simple = extraction, classification, formatting, short answers
Complex = reasoning, planning, creative, multi-step

Reply with just: simple or complex
    `;
    
    const result = await this.fastModel.generate(prompt);
    return result.text.trim().toLowerCase() as 'simple' | 'complex';
  }
  
  async execute(task: Task): Promise<TaskResult> {
    const decision = await this.route(task);
    
    switch (decision.tier) {
      case 'technician':
        return this.executeTechnician(task);
      case 'researcher':
        return this.executeResearcher(task);
      case 'intellect':
        return this.executeIntellect(task);
    }
  }
  
  private async executeTechnician(task: Task): Promise<TaskResult> {
    // Pure programmatic execution - no LLM
    if (task.type === 'math_calculation') {
      return { result: this.calculate(task.content) };
    }
    if (task.type === 'json_parsing') {
      return { result: JSON.parse(task.content) };
    }
    // ... other deterministic handlers
  }
  
  private async executeResearcher(task: Task): Promise<TaskResult> {
    // Use Gemini Flash or similar fast/cheap model
    return await this.geminiFlash.generate(task.content);
  }
  
  private async executeIntellect(task: Task): Promise<TaskResult> {
    // Use Gemini Pro or similar powerful model
    return await this.geminiPro.generate(task.content);
  }
}
```

---

### PROTOCOL_RAW_INPUT_QUEUE (V1.0 - Captain's Log)

**Definition**: Mandate ~/ai_stack/raw_input_queue.txt for capturing raw thoughts.

**Purpose**: Creates a persistent inbox for unprocessed ideas, thoughts, and inputs. Prevents loss of valuable insights that come at inconvenient times.

**The Problem It Solves**:
- Ideas come at random times
- No place to dump quick thoughts
- Formal note-taking is friction
- Thoughts get lost before processing

**How It Works**:
1. User has quick thought or idea
2. Dumps it raw into queue (voice, text, whatever)
3. AI periodically processes queue
4. Extracts actionable items, insights, todos
5. Routes to appropriate buckets

**Implementation for Meowstik**:

```typescript
// server/services/input-queue-service.ts

interface RawInput {
  id: string;
  content: string;
  source: 'voice' | 'text' | 'paste' | 'screenshot';
  timestamp: Date;
  processed: boolean;
  extractedItems?: ExtractedItem[];
}

interface ExtractedItem {
  type: 'todo' | 'idea' | 'note' | 'question' | 'reminder';
  content: string;
  priority: 'low' | 'medium' | 'high';
  targetBucket?: string;  // Where should this go?
}

export class InputQueueService {
  async addToQueue(input: Omit<RawInput, 'id' | 'timestamp' | 'processed'>): Promise<RawInput> {
    const rawInput: RawInput = {
      ...input,
      id: randomUUID(),
      timestamp: new Date(),
      processed: false,
    };
    
    await this.storage.addRawInput(rawInput);
    return rawInput;
  }
  
  async processQueue(): Promise<ProcessingResult> {
    const unprocessed = await this.storage.getUnprocessedInputs();
    const results: ProcessingResult[] = [];
    
    for (const input of unprocessed) {
      const extracted = await this.extractItems(input);
      
      // Route each item to appropriate destination
      for (const item of extracted) {
        await this.routeItem(item);
      }
      
      // Mark as processed
      await this.storage.markProcessed(input.id, extracted);
      results.push({ input, extracted });
    }
    
    return { processed: results.length, items: results };
  }
  
  private async extractItems(input: RawInput): Promise<ExtractedItem[]> {
    const prompt = `
Parse this raw input and extract actionable items:

"${input.content}"

For each item, identify:
- type: todo, idea, note, question, or reminder
- content: the cleaned up content
- priority: low, medium, or high
- targetBucket: PERSONAL_LIFE, CREATOR, or PROJECTS

Return JSON array.
    `;
    
    const result = await this.gemini.generateContent(prompt);
    return JSON.parse(result.text);
  }
  
  private async routeItem(item: ExtractedItem): Promise<void> {
    switch (item.type) {
      case 'todo':
        await this.createTask(item);
        break;
      case 'reminder':
        await this.scheduleReminder(item);
        break;
      case 'idea':
      case 'note':
        await this.addToBucket(item);
        break;
      case 'question':
        await this.queueForResearch(item);
        break;
    }
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Current State → Bootstrap Ready)

**Goal**: Enable session continuity and basic state persistence

1. **Create Kernel Schema**
   - Add `kernels` table to database
   - Define JSON structure for persona, protocols, preferences

2. **Implement PROTOCOL_BOOTSTRAP**
   - Load kernel at session start
   - Inject into system prompt
   - Handle first-time users

3. **Add Session Logging**
   - Capture session summaries
   - Store in kernel for next bootstrap

**Estimated Effort**: 2-3 days

### Phase 2: Evolution (Static → Self-Improving)

**Goal**: Enable the AI to learn and evolve

1. **Implement API_INCREMENTAL_DIFF**
   - Diff parser and applier
   - Version tracking

2. **Implement PROTOCOL_SELF_EVOLVE**
   - Pattern detection
   - Safe evolution proposals
   - Approval workflow (optional)

3. **Add Evolution History UI**
   - Show what changed and why
   - Allow rollback

**Estimated Effort**: 3-4 days

### Phase 3: Intelligence (Single-Tier → Cascade)

**Goal**: Implement the Cognitive Cascade

1. **Implement PROTOCOL_SYSTEM_FALLBACK**
   - Task routing logic
   - Cache layer for Technician tier
   - Model selection for Researcher/Intellect

2. **Build the Technician**
   - Deterministic handlers
   - Playwright integration for web tasks
   - Map consumption from Analyst

3. **Build the Analyst**
   - Environment scanning
   - Map generation (JSON blueprints)
   - Fast classification

**Estimated Effort**: 5-7 days

### Phase 4: Polish (Functional → Delightful)

**Goal**: Enhance the interaction experience

1. **Implement PROTOCOL_PROMPT_LOOP**
   - Response restructuring
   - Adaptive inclusion of parts

2. **Implement PROTOCOL_CONTEXTUAL_EDUCATION**
   - Clarification/Inspiration tags
   - Knowledge level tracking

3. **Add PROTOCOL_VTT_FILTERING**
   - Voice input correction
   - Error logging for improvement

**Estimated Effort**: 2-3 days

---

## Summary

The protocols form a coherent system for creating a self-aware, self-evolving AI:

| Protocol | Purpose | Priority |
|----------|---------|----------|
| PROTOCOL_BOOTSTRAP | Session continuity | Critical |
| PROTOCOL_SELF_EVOLVE | Learning & growth | High |
| API_INCREMENTAL_DIFF | Surgical updates | High |
| PROTOCOL_SYSTEM_FALLBACK | Cost optimization | High |
| PROTOCOL_PROMPT_LOOP | Response quality | Medium |
| PROTOCOL_CONTEXTUAL_EDUCATION | Teaching | Medium |
| PROTOCOL_VTT_FILTERING | Voice robustness | Low |
| PROTOCOL_RAW_INPUT_QUEUE | Idea capture | Low |

The key insight: **persistence enables identity**. By implementing these protocols, Meowstik transforms from a stateless responder into a persistent companion that remembers, learns, and evolves.

---

*Document Version: 1.0*
*Created: 2025-12-11*
*Author: Bender, Jason D and The Compiler*
