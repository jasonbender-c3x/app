/**
 * Enhanced Markdown Renderer
 * 
 * Extends standard markdown with rich components:
 * - Callout boxes (info, warning, success, error)
 * - Collapsible sections
 * - Confidence badges
 * - Semantic coloring for headers, quotes, lists
 * - Action buttons
 * 
 * Custom syntax:
 * :::info Title
 * Content here
 * :::
 * 
 * :::warning Title
 * Content here
 * :::
 * 
 * :::collapsible Title
 * Hidden content
 * :::
 * 
 * [confidence:high] or [confidence:medium] or [confidence:low]
 * [button:Label](action)
 */

import React, { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Info, AlertTriangle, CheckCircle, XCircle, Lightbulb, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// CALLOUT COMPONENT
// ============================================================================

type CalloutType = "info" | "warning" | "success" | "error" | "tip";

const calloutConfig: Record<CalloutType, { icon: React.ReactNode; className: string; titleClass: string }> = {
  info: {
    icon: <Info className="h-5 w-5" />,
    className: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
    titleClass: "text-blue-800 dark:text-blue-200",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    className: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
    titleClass: "text-amber-800 dark:text-amber-200",
  },
  success: {
    icon: <CheckCircle className="h-5 w-5" />,
    className: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
    titleClass: "text-green-800 dark:text-green-200",
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    className: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
    titleClass: "text-red-800 dark:text-red-200",
  },
  tip: {
    icon: <Lightbulb className="h-5 w-5" />,
    className: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300",
    titleClass: "text-purple-800 dark:text-purple-200",
  },
};

interface CalloutProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type, title, children }: CalloutProps) {
  const config = calloutConfig[type];
  
  return (
    <div className={cn("rounded-lg border p-4 my-4", config.className)} data-testid={`callout-${type}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          {title && (
            <div className={cn("font-semibold mb-1", config.titleClass)}>{title}</div>
          )}
          <div className="text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COLLAPSIBLE COMPONENT
// ============================================================================

interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg my-4 overflow-hidden" data-testid="collapsible-section">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
        data-testid="collapsible-toggle"
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-4 w-4" />
        </motion.div>
        <span className="font-medium">{title}</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 py-3 border-t">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CONFIDENCE BADGE
// ============================================================================

type ConfidenceLevel = "high" | "medium" | "low";

const confidenceConfig: Record<ConfidenceLevel, { color: string; label: string; emoji: string }> = {
  high: { color: "bg-green-500", label: "High confidence", emoji: "🟢" },
  medium: { color: "bg-amber-500", label: "Medium confidence", emoji: "🟡" },
  low: { color: "bg-red-500", label: "Low confidence", emoji: "🔴" },
};

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const config = confidenceConfig[level];
  
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted"
      title={config.label}
      data-testid={`confidence-${level}`}
    >
      <span className={cn("w-2 h-2 rounded-full", config.color)} />
      {config.label}
    </span>
  );
}

// ============================================================================
// CODE BLOCK WITH COPY BUTTON
// ============================================================================

interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4" data-testid="code-block">
      {language && (
        <div className="absolute top-0 left-0 px-3 py-1 text-xs font-medium bg-muted rounded-tl-lg rounded-br-lg text-muted-foreground">
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid="copy-code-button"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className={cn(
        "p-4 rounded-lg bg-neutral-900 dark:bg-neutral-950 text-neutral-100 overflow-x-auto",
        language && "pt-8"
      )}>
        <code className="text-sm font-mono">{children}</code>
      </pre>
    </div>
  );
}

// ============================================================================
// PARSER - Extract custom blocks from markdown
// ============================================================================

interface ParsedBlock {
  type: "markdown" | "callout" | "collapsible";
  content: string;
  calloutType?: CalloutType;
  title?: string;
}

function parseCustomBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split('\n');
  let currentBlock: ParsedBlock | null = null;
  let blockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for block start: :::type Title
    const startMatch = line.match(/^:::(info|warning|success|error|tip|collapsible)\s*(.*)?$/);
    if (startMatch) {
      // Save previous markdown content
      if (blockContent.length > 0) {
        blocks.push({ type: "markdown", content: blockContent.join('\n') });
        blockContent = [];
      }
      
      const blockType = startMatch[1];
      const title = startMatch[2]?.trim() || undefined;
      
      if (blockType === "collapsible") {
        currentBlock = { type: "collapsible", content: "", title };
      } else {
        currentBlock = { type: "callout", content: "", calloutType: blockType as CalloutType, title };
      }
      continue;
    }
    
    // Check for block end: :::
    if (line.trim() === ":::" && currentBlock) {
      currentBlock.content = blockContent.join('\n');
      blocks.push(currentBlock);
      currentBlock = null;
      blockContent = [];
      continue;
    }
    
    // Add line to current content
    blockContent.push(line);
  }
  
  // Don't forget remaining content
  if (blockContent.length > 0) {
    if (currentBlock) {
      currentBlock.content = blockContent.join('\n');
      blocks.push(currentBlock);
    } else {
      blocks.push({ type: "markdown", content: blockContent.join('\n') });
    }
  }
  
  return blocks;
}

// ============================================================================
// INLINE PARSER - Parse confidence badges and buttons inline
// ============================================================================

function parseInlineElements(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;

  // Confidence badge: [confidence:high]
  const confidenceRegex = /\[confidence:(high|medium|low)\]/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = confidenceRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    // Add badge
    elements.push(<ConfidenceBadge key={`conf-${keyCounter++}`} level={match[1] as ConfidenceLevel} />);
    lastIndex = confidenceRegex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }
  
  return elements.length > 0 ? elements : [text];
}

// ============================================================================
// MAIN ENHANCED MARKDOWN COMPONENT
// ============================================================================

interface EnhancedMarkdownProps {
  content: string;
  className?: string;
}

export function EnhancedMarkdown({ content, className }: EnhancedMarkdownProps) {
  const blocks = useMemo(() => parseCustomBlocks(content), [content]);

  return (
    <div className={cn("enhanced-markdown", className)}>
      {blocks.map((block, index) => {
        if (block.type === "callout" && block.calloutType) {
          return (
            <Callout key={index} type={block.calloutType} title={block.title}>
              <EnhancedMarkdown content={block.content} />
            </Callout>
          );
        }
        
        if (block.type === "collapsible") {
          return (
            <Collapsible key={index} title={block.title || "Details"}>
              <EnhancedMarkdown content={block.content} />
            </Collapsible>
          );
        }
        
        // Standard markdown with semantic styling
        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              // Semantic colored headers
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-primary mt-6 mb-4">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold text-primary/90 mt-5 mb-3">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-semibold text-primary/80 mt-4 mb-2">{children}</h3>
              ),
              
              // Colored blockquotes
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-purple-400 pl-4 py-2 my-4 bg-purple-500/5 italic text-purple-700 dark:text-purple-300">
                  {children}
                </blockquote>
              ),
              
              // Styled lists
              ul: ({ children }) => (
                <ul className="list-none space-y-1 my-3">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="flex gap-2 items-start">
                  <span className="text-teal-500 mt-1">•</span>
                  <span>{children}</span>
                </li>
              ),
              
              // Links with accent color
              a: ({ href, children }) => (
                <a 
                  href={href} 
                  className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              
              // Inline code
              code: ({ className, children, ...props }) => {
                const isCodeBlock = className?.includes("language-");
                if (isCodeBlock) {
                  const language = className?.replace("language-", "");
                  return <CodeBlock language={language}>{String(children)}</CodeBlock>;
                }
                return (
                  <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-pink-600 dark:text-pink-400" {...props}>
                    {children}
                  </code>
                );
              },
              
              // Pre block wrapper
              pre: ({ children }) => <>{children}</>,
              
              // Parse inline elements in paragraphs
              p: ({ children }) => {
                const processedChildren = React.Children.map(children, (child) => {
                  if (typeof child === 'string') {
                    return parseInlineElements(child);
                  }
                  return child;
                });
                return <p className="my-3 leading-7">{processedChildren}</p>;
              },
              
              // Styled tables
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto rounded-lg border">
                  <table className="w-full border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-muted/50">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2 text-left font-semibold border-b">{children}</th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2 border-b">{children}</td>
              ),
              
              // Horizontal rule
              hr: () => (
                <hr className="my-6 border-t-2 border-muted" />
              ),
            }}
          >
            {block.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

export default EnhancedMarkdown;
