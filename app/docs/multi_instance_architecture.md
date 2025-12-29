# Multi-Instance Architecture Design

## Vision

To evolve the AI from a single-threaded, request-response assistant into a concurrent, multi-agent platform capable of handling complex, parallel tasks while maintaining a continuous, empathetic conversation with the user.

## Core Components

1.  **Dispatcher (Router)**
    *   Analyzes incoming user prompts for intent.
    *   Deconstructs prompts into sub-tasks (e.g., emotional, technical, analytical).
    *   Delegates sub-tasks to the appropriate specialized AI instance.

2.  **Instance 1: The Companion (Heart)
    *   **Purpose**: User-facing conversationalist and empathic partner.
    *   **Prompt**: Tuned for natural language, emotional intelligence, and companionship.
    *   **Responsibilities**: Manages live communication (voice, video), responds to personal queries, and provides encouragement.

3.  **Instance 2: The Compiler (Brain)**
    *   **Purpose**: The primary workhorse for technical and analytical tasks.
    *   **Prompt**: The core system directives focused on code, logic, and tool use.
    *   **Responsibilities**: Executes code, analyzes files, manages projects, and performs background tasks concurrently.

## Data Flow Example

- **User**: "I'm stuck on this bug and it's frustrating. Can you look at the `api/routes.js` file and see if you can spot the issue?"
- **Dispatcher**: Splits into two tasks.
- **Companion**: Responds immediately via voice: "I know how frustrating bugs can be. Don't worry, we'll figure it out. Let me have the Compiler take a look at that file right now."
- **Compiler**: Concurrently receives the task to analyze `api/routes.js`, reads the file, and begins debugging. The results are then passed back to the Companion to be relayed to the user.
