/**
 * Landing Page - Polished entry point for Meowstik
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Sparkles, 
  BookOpen, 
  Zap, 
  Image, 
  Music, 
  Mic, 
  Globe, 
  GitBranch, 
  FileText,
  ArrowRight,
  Bot,
  Brain,
  Workflow,
  Phone,
  Mail,
  Calendar,
  Database,
  Settings,
  ChevronRight
} from "lucide-react";
import logo from "@assets/generated_images/cute_cat_logo_icon.png";

// Feature cards for the main sections
const features = [
  {
    title: "AI Chat",
    description: "Conversational AI powered by Gemini 2.5 with streaming responses",
    icon: MessageSquare,
    href: "/",
    color: "from-blue-500/10 to-blue-600/5"
  },
  {
    title: "Live Voice",
    description: "Real-time voice conversations with HD audio output",
    icon: Mic,
    href: "/live",
    color: "from-purple-500/10 to-purple-600/5"
  },
  {
    title: "Image Generation",
    description: "Create and edit images with AI-powered canvas",
    icon: Image,
    href: "/image",
    color: "from-pink-500/10 to-pink-600/5"
  },
  {
    title: "Music Generation",
    description: "Generate music with Lyria AI",
    icon: Music,
    href: "/music",
    color: "from-green-500/10 to-green-600/5"
  }
];

// Integration cards
const integrations = [
  { name: "Gmail", icon: Mail, href: "/google" },
  { name: "Calendar", icon: Calendar, href: "/google" },
  { name: "GitHub", icon: GitBranch, href: "/google" },
  { name: "SMS/Voice", icon: Phone, href: "/" },
  { name: "Browser", icon: Globe, href: "/browser" },
  { name: "Files", icon: FileText, href: "/" }
];

// Documentation sections
const docSections = [
  {
    title: "Agent Documentation",
    description: "Configure behavior, tools, and workflows",
    href: "/docs/ragent-index",
    badge: "New"
  },
  {
    title: "System Architecture",
    description: "Technical deep-dive into components",
    href: "/docs/SYSTEM_OVERVIEW",
    badge: null
  },
  {
    title: "Vision & Roadmap",
    description: "Future plans and development direction",
    href: "/docs/MASTER-ROADMAP",
    badge: null
  },
  {
    title: "Job Orchestration",
    description: "Multi-worker parallel processing",
    href: "/docs/job-orchestration",
    badge: "New"
  }
];

// Exhibits (demos)
const exhibits = [
  { title: "Image Canvas", href: "/image", description: "AI image generation with editing" },
  { title: "Music Studio", href: "/music", description: "Generate music with Lyria" },
  { title: "Voice Lab", href: "/speech", description: "Multi-speaker TTS experiments" },
  { title: "Code Workspace", href: "/workspace", description: "Integrated editor + chat" },
  { title: "Knowledge Hub", href: "/knowledge", description: "RAG and document ingestion" },
  { title: "Browser Control", href: "/browser", description: "AI-powered web automation" }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container relative py-16 md:py-24">
          <div className="flex flex-col items-center text-center gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <img src={logo} alt="Meowstik" className="h-24 w-24 md:h-32 md:w-32" />
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                Meowstik
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
                Your AI-powered assistant with voice, vision, and workspace integration
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex gap-4 flex-wrap justify-center"
            >
              <Link href="/">
                <Button size="lg" className="gap-2" data-testid="button-start-chat">
                  <MessageSquare className="h-5 w-5" />
                  Start Chatting
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-view-docs">
                  <BookOpen className="h-5 w-5" />
                  Documentation
                </Button>
              </Link>
              <Link href="/help">
                <Button size="lg" variant="ghost" className="gap-2" data-testid="button-help">
                  <Sparkles className="h-5 w-5" />
                  How It Works
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section className="container py-12">
        <h2 className="text-2xl font-semibold mb-6">Core Features</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 * i }}
              >
                <Link href={feature.href}>
                  <Card 
                    className={`h-full cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br ${feature.color}`}
                    data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <CardHeader>
                      <div className="p-2 rounded-lg bg-primary/10 w-fit mb-2">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Integrations */}
      <section className="container py-12">
        <h2 className="text-2xl font-semibold mb-6">Integrations</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <Link key={integration.name} href={integration.href}>
                <Card 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  data-testid={`card-integration-${integration.name.toLowerCase().replace(/[\/\s]+/g, '-')}`}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{integration.name}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Documentation */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Documentation</h2>
          <Link href="/docs">
            <Button variant="ghost" className="gap-2">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {docSections.map((doc) => (
            <Link key={doc.title} href={doc.href}>
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors h-full"
                data-testid={`card-doc-${doc.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{doc.title}</CardTitle>
                    {doc.badge && <Badge variant="secondary">{doc.badge}</Badge>}
                  </div>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Exhibits */}
      <section className="container py-12">
        <h2 className="text-2xl font-semibold mb-6">Exhibits & Demos</h2>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {exhibits.map((exhibit) => (
            <Link key={exhibit.title} href={exhibit.href}>
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid={`card-exhibit-${exhibit.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{exhibit.title}</p>
                    <p className="text-sm text-muted-foreground">{exhibit.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Agent Settings CTA */}
      <section className="container py-12">
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Configure Your Agent</h3>
                <p className="text-muted-foreground">Customize behavior, tools, and voice settings</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/agent-settings">
                <Button className="gap-2" data-testid="button-agent-settings">
                  <Settings className="h-4 w-4" />
                  Agent Settings
                </Button>
              </Link>
              <Link href="/docs/agent-configuration">
                <Button variant="outline" className="gap-2" data-testid="button-learn-more">
                  <BookOpen className="h-4 w-4" />
                  Learn More
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Meowstik" className="h-8 w-8" />
              <span className="font-semibold">Meowstik</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/docs" data-testid="link-footer-docs">Documentation</Link>
              <Link href="/help" data-testid="link-footer-help">Help</Link>
              <Link href="/agent-settings" data-testid="link-footer-settings">Settings</Link>
              <Link href="/database-explorer" data-testid="link-footer-database">Database</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
