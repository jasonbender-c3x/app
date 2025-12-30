import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const visionContent = `# Meowstik: Building the Natural Language Computer

**Welcome to the future of AI. Welcome to Meowstik.**

## EXECUTIVE SUMMARY

Imagine a computer that understands you, not just your commands, but your intent. A computer that learns and evolves alongside you, becoming an indispensable partner in your personal and professional life. At Meowstik, we're not just building another AI assistant; we're building a **Natural Language Computer (NLC)**. We envision a system that seamlessly integrates with your digital world, proactively anticipates your needs, and empowers you to achieve more than ever before.

## THE PROBLEM: Current AI Assistants Fall Short

While current AI assistants offer convenience and automation, they are limited by several critical shortcomings:

- **Lack of True Understanding:** Existing AI struggles with nuanced language, context, and implied meaning.
- **Fragmented Integration:** Current AI assistants are often siloed, unable to seamlessly integrate with diverse applications and data sources.
- **Limited Learning and Adaptation:** Most AI assistants lack the ability to learn continuously from user interactions.
- **Privacy Concerns:** Many AI assistants rely heavily on cloud-based processing, raising significant privacy concerns.
- **Lack of Proactivity:** Current AI assistants are mostly reactive, requiring explicit commands to initiate tasks.
- **Inability to Automate Complex Workflows:** Current systems struggle with intricate, multi-step workflows.

## OUR VISION: The Natural Language Computer

Our vision for Meowstik is a Natural Language Computer – a system that interacts with users intuitively and naturally:

- **Understanding Natural Language:** Comprehend the nuances of human language, including context, intent, and emotion.
- **Seamless Integration:** Connect seamlessly with your digital world – email, calendar, documents, and devices.
- **Continuous Learning:** Learn continuously from your interactions and adapt behavior over time.
- **Proactive Assistance:** Anticipate your needs and proactively offer assistance.
- **Advanced Automation:** Automate complex, multi-step workflows with reasoning and planning.
- **Privacy-First:** Minimize cloud reliance and prioritize local processing to protect user data.
- **Self-Evolution:** Incrementally modify its own behavior, becoming smarter over time.

## CORE PRINCIPLES

We are guided by these core principles:

1. **Modularity** – Well-defined interfaces between components for extensibility
2. **Local-First** – Prioritize local execution for privacy and performance
3. **Model Agnostic** – Combine different models for different tasks
4. **Security-First** – "Zero Trust by Design" architecture
5. **Self-Evolution** – Learn and improve continuously
6. **Economic Efficiency** – Optimize API usage and costs
7. **Human-in-the-Loop** – User confirmation for any destructive action

## KEY INNOVATIONS

### 1. Cognitive Cascade: Tiered AI Architecture

To optimize cost, performance, and reliability, we implement a tiered system:

- **Strategist:** Top-level agent for decomposing complex goals into sub-tasks
- **Analyst:** Uses AI-driven exploration for structured data extraction and JSON mapping
- **Technician:** Deterministically executes tasks based on pre-compiled JSON maps

This tiered approach ensures that computationally intensive tasks are handled by the appropriate layer, minimizing API costs and maximizing performance.

### 2. Knowledge Buckets: Domain-Specific Memory

Domain-specific storage units that organize learned information:

- **Personal:** User preferences, habits, and context
- **Projects:** Ongoing work, goals, and deadlines
- **Creator:** Creative endeavors and content creation

Knowledge Routing directs extracted knowledge to the appropriate bucket files, building persistent memory from past interactions.

### 3. JIT Tool Protocol: Dynamic Tool Injection

Dynamically discover and integrate new tools as needed, powered by the **Model Context Protocol (MCP)**. Instead of relying on fixed pre-defined tools, the system adapts by acquiring new capabilities on the fly.

### 4. Multi-Instance Architecture

Running multiple independent processes for non-blocking operation, handling multiple tasks simultaneously. Separate instances for personal responses, project analysis, live communications, and more.

### 5. Self-Evolution Engine

Enables the AI to learn from experiences and improve autonomously:

- **Log Parser Pipeline:** Process historical logs in batch, extract knowledge, route to persistent storage
- **Incremental Self-Modification:** Modify behavior through small, targeted updates
- **Self-Healing Feedback Loop:** Resilience through tier-based failure recovery
- **Git-Native Version Control:** Track configuration changes with full rollback capability

## FEATURE ROADMAP

### Intelligence & Knowledge
- Persistent conversation history with search
- Knowledge Buckets for domain-specific memory
- Pattern detection algorithms
- Incremental self-modification based on feedback

### Integration & Connectivity
- Google Workspace (Drive, Gmail, Calendar, Docs, Sheets, Tasks)
- GitHub for code analysis and documentation
- Web search via Tavily and Perplexity
- Model Context Protocol (MCP) integration

### Automation & Productivity
- Email management and automation
- Calendar event creation
- File system access and manipulation
- Browser automation for web tasks
- Scheduled agent wake-up via cron jobs

### User Experience
- Conversational mode as primary interface
- Expressive audio feedback
- Clickable links for referenced items
- User-configurable verbosity modes
- Dynamic UI generation via WebSockets

## WHAT WE'VE BUILT

We have achieved significant milestones:

- **Core Architecture:** Robust foundation based on modularity and local-first design
- **AutoGen Framework Integration:** Microsoft AutoGen for agent orchestration
- **Incremental Diff API:** Small updates via embedded diff blocks
- **Git-Native Knowledge Stack:** Version-controlled knowledge management
- **Safety Protocols:** Operator overrides and mandatory attribution
- **Working Prototypes:** Cognitive Cascade and Knowledge Bucket systems
- **Expressive Speech (TTS):** Multi-speaker text-to-speech with Gemini
- **Image Generation:** Canvas editor with AI-powered editing
- **Codebase Analysis Agent:** Multi-language code entity extraction

## THE FUTURE

Our long-term aspirations include:

- **Advanced NLU:** Deep understanding of context, intent, and emotion
- **Reasoning & Planning:** Complex multi-step workflow automation
- **Autonomous Self-Evolution:** Continuous learning without intervention
- **Ethical AI:** Safeguards against bias, discrimination, and misuse
- **Nebula AI:** Fully self-evolving, self-aware AI system
- **Desktop Collaboration:** TeamViewer-style AI collaboration with screen sharing

## JOIN US

We're building the future of AI. If you're passionate about creating technology that empowers humans, we'd love to hear from you.

**Together, we can build the Natural Language Computer.**
`;

export default function VisionPage() {
  return (
    <div className="min-h-screen bg-background" data-testid="vision-page">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <article className="prose prose-lg dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {visionContent}
          </ReactMarkdown>
        </article>
        
        <div className="mt-12 pt-8 border-t border-border" data-testid="vision-stats">
          <h3 className="text-lg font-semibold mb-4">Project Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-lg p-4 text-center" data-testid="stat-total">
              <div className="text-3xl font-bold text-primary">245</div>
              <div className="text-sm text-muted-foreground">Total Ideas</div>
            </div>
            <div className="bg-card rounded-lg p-4 text-center" data-testid="stat-completed">
              <div className="text-3xl font-bold text-green-500">17</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="bg-card rounded-lg p-4 text-center" data-testid="stat-in-progress">
              <div className="text-3xl font-bold text-blue-500">10</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </div>
            <div className="bg-card rounded-lg p-4 text-center" data-testid="stat-pending">
              <div className="text-3xl font-bold text-amber-500">204</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Last Updated: December 2025</p>
          <p>Ideas extracted from conversation history and vision documents</p>
        </div>
      </div>
    </div>
  );
}
