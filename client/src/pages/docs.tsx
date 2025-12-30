/**
 * Documentation Page - Renders markdown docs as beautiful web pages
 */

import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, FileText, FolderOpen, Home, ExternalLink } from "lucide-react";

// Documentation structure
const docCategories = [
  {
    name: "Roadmap",
    icon: "🗺️",
    docs: [
      { slug: "MASTER-ROADMAP", title: "Master Roadmap", path: "v2-roadmap/MASTER-ROADMAP.md" },
      { slug: "TODO-FEATURES", title: "TODO Features", path: "v2-roadmap/TODO-FEATURES.md" },
      { slug: "VISIONS_OF_THE_FUTURE", title: "Visions of the Future", path: "v2-roadmap/VISIONS_OF_THE_FUTURE.md" },
    ]
  },
  {
    name: "Architecture",
    icon: "🏗️",
    docs: [
      { slug: "SYSTEM_OVERVIEW", title: "System Overview", path: "SYSTEM_OVERVIEW.md" },
      { slug: "RAG_PIPELINE", title: "RAG Pipeline", path: "RAG_PIPELINE.md" },
      { slug: "KNOWLEDGE_INGESTION_ARCHITECTURE", title: "Knowledge Ingestion", path: "v2-roadmap/KNOWLEDGE_INGESTION_ARCHITECTURE.md" },
      { slug: "KERNEL_IMPLEMENTATION_PROPOSAL", title: "Kernel Implementation", path: "v2-roadmap/KERNEL_IMPLEMENTATION_PROPOSAL.md" },
    ]
  },
  {
    name: "Vision",
    icon: "✨",
    docs: [
      { slug: "COMPREHENSIVE_VISION", title: "Comprehensive Vision", path: "idea-extraction/COMPREHENSIVE_VISION.md" },
      { slug: "VISION_BLOG_POST", title: "Vision Blog Post", path: "idea-extraction/VISION_BLOG_POST.md" },
    ]
  },
  {
    name: "Technical",
    icon: "⚙️",
    docs: [
      { slug: "FEATURES", title: "Features", path: "FEATURES.md" },
      { slug: "database-schemas", title: "Database Schemas", path: "01-database-schemas.md" },
      { slug: "ui-architecture", title: "UI Architecture", path: "02-ui-architecture.md" },
      { slug: "prompt-lifecycle", title: "Prompt Lifecycle", path: "03-prompt-lifecycle.md" },
      { slug: "llm-output-processing-pipeline", title: "LLM Output Processing", path: "llm-output-processing-pipeline.md" },
    ]
  },
  {
    name: "Reference",
    icon: "📚",
    docs: [
      { slug: "PROTOCOL_ANALYSIS", title: "Protocol Analysis", path: "PROTOCOL_ANALYSIS.md" },
      { slug: "MARKDOWN_EMBEDDING_GUIDE", title: "Markdown Embedding Guide", path: "MARKDOWN_EMBEDDING_GUIDE.md" },
      { slug: "LIVE_MODE_EVALUATION", title: "Live Mode Evaluation", path: "LIVE_MODE_EVALUATION.md" },
    ]
  }
];

// Flatten for lookup
const allDocs = docCategories.flatMap(cat => cat.docs);

export default function DocsPage() {
  const [, params] = useRoute("/docs/:slug");
  const slug = params?.slug;
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentDoc = slug ? allDocs.find(d => d.slug === slug) : null;

  useEffect(() => {
    if (currentDoc) {
      setLoading(true);
      setError(null);
      fetch(`/api/documentation/${encodeURIComponent(currentDoc.path)}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to load document");
          return res.text();
        })
        .then(text => {
          setContent(text);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [currentDoc]);

  return (
    <div className="flex h-screen bg-background" data-testid="docs-page">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 border-r border-border bg-card overflow-hidden`}>
        <ScrollArea className="h-full">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-home">
                  <Home className="h-4 w-4" />
                  Meowstik
                </Button>
              </Link>
            </div>
            
            <h2 className="text-lg font-semibold mb-4">Documentation</h2>
            
            {/* Categories */}
            {docCategories.map((category) => (
              <div key={category.name} className="mb-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <span>{category.icon}</span>
                  {category.name}
                </h3>
                <ul className="space-y-1">
                  {category.docs.map((doc) => (
                    <li key={doc.slug}>
                      <Link href={`/docs/${doc.slug}`}>
                        <button
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                            slug === doc.slug
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                          data-testid={`doc-link-${doc.slug}`}
                        >
                          {doc.title}
                        </button>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto p-8">
            {!slug ? (
              // Landing page
              <div className="text-center py-16">
                <h1 className="text-4xl font-bold mb-4">Meowstik Documentation</h1>
                <p className="text-xl text-muted-foreground mb-8">
                  Explore the architecture, roadmap, and vision behind Meowstik.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docCategories.map((category) => (
                    <div key={category.name} className="p-6 bg-card border rounded-xl">
                      <div className="text-3xl mb-2">{category.icon}</div>
                      <h3 className="font-semibold mb-2">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {category.docs.length} documents
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <article className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
