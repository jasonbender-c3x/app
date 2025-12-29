import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Watch, Mic, Bell, Calendar, Mail, Heart, Zap, Smartphone, Clock } from "lucide-react";
import { Link } from "wouter";

export default function WatchPage() {
  const features = [
    {
      title: "Voice Commands",
      description: "Talk to Meowstik directly from your wrist. Ask questions, set reminders, or start a conversation without reaching for your phone.",
      icon: Mic
    },
    {
      title: "Smart Notifications",
      description: "Get intelligent alerts for important emails, texts, and calendar events. Meowstik filters the noise and surfaces what matters.",
      icon: Bell
    },
    {
      title: "Calendar Glances",
      description: "See your upcoming events at a glance. Complications show your next meeting, travel time, and daily schedule overview.",
      icon: Calendar
    },
    {
      title: "Quick Replies",
      description: "Respond to messages with AI-suggested replies. Meowstik learns your style and offers contextually appropriate responses.",
      icon: Mail
    },
    {
      title: "Health Integration",
      description: "Connect your health data for personalized insights. Get gentle reminders to move, breathe, or take breaks based on your activity.",
      icon: Heart
    },
    {
      title: "Instant Actions",
      description: "Trigger your most-used Meowstik commands with a tap. Send a text to mom, check your Drive, or start a timer instantly.",
      icon: Zap
    }
  ];

  const specs = [
    { label: "Platform", value: "Wear OS 4+" },
    { label: "Companion App", value: "Android (PWA)" },
    { label: "Voice Support", value: "On-device + Cloud" },
    { label: "Offline Mode", value: "Basic commands" },
    { label: "Battery Impact", value: "< 5% daily" },
    { label: "Languages", value: "English (more coming)" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Watch className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">Meowstik Watch</h1>
          </div>
          <span className="ml-auto px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
            Coming Soon
          </span>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-8">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-background p-8 border border-primary/20">
              <div className="absolute top-4 right-4 opacity-10">
                <Watch className="h-48 w-48" />
              </div>
              <div className="relative z-10 max-w-xl">
                <h2 className="text-2xl font-bold mb-4">Your AI Companion, On Your Wrist</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Meowstik Watch brings the power of your AI assistant to your smartwatch. 
                  Stay connected, get intelligent notifications, and interact with voice commands 
                  — all without pulling out your phone.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Smartphone className="h-4 w-4" />
                    <span>Requires Meowstik phone app</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Q1 2025</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div 
                    key={index} 
                    className="p-5 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/30 transition-colors"
                    data-testid={`watch-feature-${index}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{feature.title}</h4>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl border border-border bg-secondary/20">
                <h3 className="text-xl font-semibold mb-4">Technical Specs</h3>
                <div className="space-y-3">
                  {specs.map((spec, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground">{spec.label}</span>
                      <span className="font-medium">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-xl border border-border bg-gradient-to-br from-orange-500/10 to-red-500/10">
                <h3 className="text-xl font-semibold mb-4">Recommended Watch</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-background/50">
                      <Watch className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-semibold">OnePlus Watch 2R</p>
                      <p className="text-sm text-muted-foreground">$230 - Best value for developers</p>
                    </div>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Snapdragon W5 Gen 1 + 2GB RAM</li>
                    <li>• Wear OS 4 (latest APIs)</li>
                    <li>• Multi-day battery life</li>
                    <li>• Smooth app performance</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border bg-secondary/20">
              <h3 className="text-xl font-semibold mb-4">Development Roadmap</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center shrink-0 text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Phone App PWA</p>
                    <p className="text-sm text-muted-foreground">Progressive Web App with mobile optimization and install prompt</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0 text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium">Google Play Listing (TWA)</p>
                    <p className="text-sm text-muted-foreground">Package as Trusted Web Activity for Play Store distribution</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Wear OS Companion App</p>
                    <p className="text-sm text-muted-foreground">Native Kotlin app with Jetpack Compose for Wear</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center shrink-0 text-sm font-bold">4</div>
                  <div>
                    <p className="font-medium">Tiles & Complications</p>
                    <p className="text-sm text-muted-foreground">Quick-access widgets for watch face and app drawer</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 text-center">
              <h3 className="text-xl font-semibold mb-2">Stay Updated</h3>
              <p className="text-muted-foreground mb-4">
                The Meowstik Watch app is currently in development. Check back soon for beta access!
              </p>
              <Link href="/">
                <Button data-testid="button-back-to-chat">
                  Back to Chat
                </Button>
              </Link>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
