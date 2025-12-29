/**
 * Markdown Playground Page
 * 
 * Showcases all enhanced markdown features:
 * - Callout boxes (info, warning, success, error, tip)
 * - Collapsible sections
 * - Confidence badges
 * - Semantic coloring
 * - Code blocks with copy buttons
 * - Interactive elements
 */

import React, { useState } from "react";
import { EnhancedMarkdown } from "@/components/ui/enhanced-markdown";
import { FeedbackPanel } from "@/components/ui/feedback-panel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, RotateCcw } from "lucide-react";

// ============================================================================
// SAMPLE CONTENT
// ============================================================================

const sampleMarkdown = `# Enhanced Markdown Demo

This playground showcases all the custom markdown features available in Nebula Chat.

## Callout Boxes

Use callouts to highlight important information:

:::info Information
This is an informational callout. Use it for general notes and helpful tips.
:::

:::warning Warning
This is a warning callout. Use it when users should be cautious.
:::

:::success Success
This is a success callout. Use it to confirm actions or show positive outcomes.
:::

:::error Error
This is an error callout. Use it to highlight problems or failures.
:::

:::tip Pro Tip
This is a tip callout. Use it for helpful suggestions and best practices.
:::

## Collapsible Sections

Hide detailed content that users can expand:

:::collapsible How does this work?
Collapsible sections are great for:
- Long explanations that not everyone needs
- Technical details
- FAQs and help content
- "Show more" functionality

The content inside stays hidden until the user clicks to expand it.
:::

:::collapsible Advanced Configuration
\`\`\`json
{
  "theme": "dark",
  "fontSize": 14,
  "autoSave": true,
  "extensions": ["markdown", "syntax-highlighting"]
}
\`\`\`
:::

## Confidence Badges

Show AI confidence levels inline: [confidence:high]

Different levels available:
- High confidence [confidence:high] - The AI is very sure
- Medium confidence [confidence:medium] - Some uncertainty
- Low confidence [confidence:low] - Treat with caution

## Semantic Colors

### Headers are styled with the primary color

> Blockquotes get a purple accent and italic styling

- Lists use teal bullet points
- Each item is clearly separated
- Visual hierarchy is maintained

Regular paragraphs remain neutral but readable.

\`Inline code\` uses a pink accent.

## Code Blocks

Code blocks include language badges and copy buttons:

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}

function greetUser(user: User): string {
  return \`Hello, \${user.name}!\`;
}
\`\`\`

\`\`\`python
def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
\`\`\`

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Callouts | ✅ Done | 5 types available |
| Collapsibles | ✅ Done | Animated |
| Badges | ✅ Done | 3 levels |
| Code blocks | ✅ Done | With copy button |

---

## Combined Example

:::info Getting Started
Welcome to the enhanced markdown system! [confidence:high]

Here's what you can do:

1. Create rich callout boxes
2. Add collapsible sections
3. Show confidence levels
4. Format code beautifully

:::collapsible View the source
This entire demo is written in enhanced markdown. The parser handles nested elements and converts them to React components.
:::

:::

Happy writing! 🎉
`;

const basicExamples = [
  {
    title: "Info Callout",
    code: `:::info Title Here
Your content goes here.
Multiple lines work too!
:::`,
  },
  {
    title: "Warning Callout",
    code: `:::warning Be Careful
This action cannot be undone.
:::`,
  },
  {
    title: "Collapsible Section",
    code: `:::collapsible Click to expand
Hidden content that can be revealed by the user.
Great for FAQs or long content.
:::`,
  },
  {
    title: "Confidence Badge",
    code: `The answer is 42. [confidence:high]

I'm less sure about this. [confidence:medium]

This needs verification. [confidence:low]`,
  },
];

// ============================================================================
// PLAYGROUND COMPONENT
// ============================================================================

export default function MarkdownPlayground() {
  const [customMarkdown, setCustomMarkdown] = useState(sampleMarkdown);
  const [livePreview, setLivePreview] = useState(sampleMarkdown);

  const handleReset = () => {
    setCustomMarkdown(sampleMarkdown);
    setLivePreview(sampleMarkdown);
  };

  const handleRun = () => {
    setLivePreview(customMarkdown);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2" data-testid="page-title">
            Markdown Playground
          </h1>
          <p className="text-muted-foreground">
            Explore and test enhanced markdown features with live preview
          </p>
        </div>

        <Tabs defaultValue="playground" className="space-y-6">
          <TabsList>
            <TabsTrigger value="playground" data-testid="tab-playground">Playground</TabsTrigger>
            <TabsTrigger value="examples" data-testid="tab-examples">Quick Examples</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback Demo</TabsTrigger>
          </TabsList>

          {/* Playground Tab */}
          <TabsContent value="playground" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Editor */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Editor</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleReset} data-testid="btn-reset">
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                      <Button size="sm" onClick={handleRun} data-testid="btn-run">
                        <Play className="h-4 w-4 mr-1" />
                        Run
                      </Button>
                    </div>
                  </div>
                  <CardDescription>Write enhanced markdown here</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={customMarkdown}
                    onChange={(e) => setCustomMarkdown(e.target.value)}
                    className="font-mono text-sm min-h-[600px] resize-none"
                    placeholder="Write your markdown here..."
                    data-testid="markdown-editor"
                  />
                </CardContent>
              </Card>

              {/* Preview */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Preview</CardTitle>
                  <CardDescription>Live rendered output</CardDescription>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-neutral dark:prose-invert max-w-none min-h-[600px] overflow-y-auto"
                    data-testid="markdown-preview"
                  >
                    <EnhancedMarkdown content={livePreview} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {basicExamples.map((example, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{example.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted rounded-lg p-4">
                      <pre className="text-sm font-mono whitespace-pre-wrap">{example.code}</pre>
                    </div>
                    <div className="border-t pt-4">
                      <EnhancedMarkdown content={example.code} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Syntax Reference */}
            <Card>
              <CardHeader>
                <CardTitle>Syntax Reference</CardTitle>
                <CardDescription>Quick reference for all enhanced markdown features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 font-semibold">Feature</th>
                        <th className="text-left py-2 px-4 font-semibold">Syntax</th>
                        <th className="text-left py-2 px-4 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 px-4">Info Callout</td>
                        <td className="py-2 px-4 font-mono text-xs">:::info Title\nContent\n:::</td>
                        <td className="py-2 px-4 text-muted-foreground">Blue styling</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4">Warning Callout</td>
                        <td className="py-2 px-4 font-mono text-xs">:::warning Title\nContent\n:::</td>
                        <td className="py-2 px-4 text-muted-foreground">Amber styling</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4">Success Callout</td>
                        <td className="py-2 px-4 font-mono text-xs">:::success Title\nContent\n:::</td>
                        <td className="py-2 px-4 text-muted-foreground">Green styling</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4">Error Callout</td>
                        <td className="py-2 px-4 font-mono text-xs">:::error Title\nContent\n:::</td>
                        <td className="py-2 px-4 text-muted-foreground">Red styling</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4">Tip Callout</td>
                        <td className="py-2 px-4 font-mono text-xs">:::tip Title\nContent\n:::</td>
                        <td className="py-2 px-4 text-muted-foreground">Purple styling</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4">Collapsible</td>
                        <td className="py-2 px-4 font-mono text-xs">:::collapsible Title\nContent\n:::</td>
                        <td className="py-2 px-4 text-muted-foreground">Click to expand</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4">Confidence High</td>
                        <td className="py-2 px-4 font-mono text-xs">[confidence:high]</td>
                        <td className="py-2 px-4 text-muted-foreground">Green badge</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4">Confidence Medium</td>
                        <td className="py-2 px-4 font-mono text-xs">[confidence:medium]</td>
                        <td className="py-2 px-4 text-muted-foreground">Amber badge</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4">Confidence Low</td>
                        <td className="py-2 px-4 font-mono text-xs">[confidence:low]</td>
                        <td className="py-2 px-4 text-muted-foreground">Red badge</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Demo Tab */}
          <TabsContent value="feedback" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Feedback Component Demo</CardTitle>
                <CardDescription>
                  This feedback system is the backbone for AI evolution. User feedback is collected,
                  analyzed, and used to generate improvement suggestions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sample AI Response */}
                <div className="bg-muted/50 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center text-white">
                      ✨
                    </div>
                    <span className="font-semibold">Nebula AI</span>
                  </div>
                  <div className="prose prose-neutral dark:prose-invert max-w-none mb-4">
                    <p>
                      Here's an example AI response that you can provide feedback on. 
                      The feedback system allows you to:
                    </p>
                    <ul>
                      <li>Give a quick thumbs up or thumbs down</li>
                      <li>Expand to provide detailed feedback</li>
                      <li>Rate specific aspects like accuracy and clarity</li>
                      <li>Select what you liked or disliked</li>
                      <li>Add freeform comments</li>
                    </ul>
                    <p>
                      This feedback will be used to improve future responses through the evolution system.
                    </p>
                  </div>
                  
                  <div className="border-t pt-4">
                    <FeedbackPanel 
                      messageId="demo-message-1"
                      onSubmit={(feedback) => {
                        console.log("Demo feedback:", feedback);
                        alert("Feedback submitted! Check console for details.");
                      }}
                    />
                  </div>
                </div>

                {/* Flow Explanation */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Evolution Flow</h3>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="text-2xl mb-2">👍👎</div>
                      <div className="font-medium">User Feedback</div>
                      <div className="text-xs text-muted-foreground mt-1">Collected on each response</div>
                    </div>
                    <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="text-2xl mb-2">🧠</div>
                      <div className="font-medium">Analysis</div>
                      <div className="text-xs text-muted-foreground mt-1">Patterns identified</div>
                    </div>
                    <div className="text-center p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <div className="text-2xl mb-2">📝</div>
                      <div className="font-medium">PR Generated</div>
                      <div className="text-xs text-muted-foreground mt-1">Improvements proposed</div>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="text-2xl mb-2">✅</div>
                      <div className="font-medium">Human Review</div>
                      <div className="text-xs text-muted-foreground mt-1">You approve changes</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
