import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, HelpCircle, MessageSquare, Keyboard, Sparkles, FileText, Mail, Calendar, FolderOpen } from "lucide-react";
import { Link } from "wouter";

export default function HelpPage() {
  const faqs = [
    {
      question: "How do I start a new conversation?",
      answer: "Click the 'New chat' button in the sidebar or simply start typing in the input area at the bottom of the screen. It's as easy as a cat finding a sunny spot!",
      icon: MessageSquare
    },
    {
      question: "What can Meowstic help me with?",
      answer: "This clever cat can assist with writing, coding, analysis, brainstorming, answering questions, and integrating with Google Workspace services like Drive, Gmail, Calendar, Docs, Sheets, and Tasks. Purrfect for any task!",
      icon: Sparkles
    },
    {
      question: "How do I access Google services?",
      answer: "Click on the Google services link in the sidebar or navigate to /google. You can connect your Google account to access Drive, Gmail, Calendar, and more. Even cats love organized files!",
      icon: FolderOpen
    },
    {
      question: "Can I attach files to my messages?",
      answer: "Yes! You can attach images and documents using the attachment button in the input area. Meowstic can analyze and discuss the content of your files like a curious cat inspecting something new.",
      icon: FileText
    },
    {
      question: "How do I use the code editor?",
      answer: "Navigate to /editor to access the built-in HTML/CSS/JS code editor. You can write code and see live previews of your work. Hunt those bugs like a cat stalking prey!",
      icon: Keyboard
    },
    {
      question: "Is my conversation history saved?",
      answer: "Yes, all your conversations are automatically saved and organized in the sidebar. You can access past chats at any time by clicking on them. We never forget, just like cats remember where you hide the treats!",
      icon: MessageSquare
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">Help & FAQ</h1>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-6">
            <p className="text-muted-foreground text-lg">
              Welcome to Meowstic! 🐱 Here you'll find answers to common questions and guidance on how to get the most out of your purrfect AI assistant.
            </p>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div 
                  key={index} 
                  className="p-6 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/30 transition-colors"
                  data-testid={`faq-item-${index}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <faq.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/10">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Need More Help?
              </h2>
              <p className="text-muted-foreground">
                If you have additional questions or need personalized assistance, feel free to ask Meowstic directly in the chat. This curious cat is designed to help you with a wide range of tasks and questions. Just say "meow"! 🐾
              </p>
            </div>

            <div className="mt-6 p-6 rounded-xl border border-border bg-secondary/20">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between items-center p-2 rounded bg-background/50">
                  <span>Send message</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground">Enter</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-background/50">
                  <span>New line</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground">Shift + Enter</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-background/50">
                  <span>New chat</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground">Ctrl + N</kbd>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-background/50">
                  <span>Toggle sidebar</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground">Ctrl + B</kbd>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
