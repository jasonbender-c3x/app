import { NLCpu, Instruction } from './lib/nl_cpu';

// --- Mock Tool Implementations ---
// In a real app, these would make actual API calls.

const mockGmailSearch: ToolFunction = async (params) => {
  console.log(`  -> Calling Gmail API: search('${params.query}')`);
  // Simulate finding one email
  return {
    output: {
      messages: [{ id: 'msg-12345', snippet: 'Your receipt from...' }],
      resultSizeEstimate: 1,
    }
  };
};

const mockGmailRead: ToolFunction = async (params) => {
  console.log(`  -> Calling Gmail API: read('${params.messageId}')`);
  return {
    output: `Subject: Your Receipt\n\nHello, this is the full body of email ${params.messageId}.`
  };
};

const mockSendChat: ToolFunction = async (params) => {
  console.log(`  -> Sending to chat window:`);
  console.log(params.content);
  return { output: { success: true, messageId: 'chat-abc' } };
};


// --- Main Application Logic ---

async function main() {
  // 1. Instantiate the CPU and register our available tools
  const cpu = new NLCpu();
  cpu.registerTool('gmail_search', mockGmailSearch);
  cpu.registerTool('gmail_read', mockGmailRead);
  cpu.registerTool('send_chat', mockSendChat);

  // 2. Define the execution plan (this would come from the AI model)
  const executionPlan: Instruction[] = [
    {
      type: 'gmail_search',
      id: 'find_stripe_email',
      operation: 'search',
      parameters: {
        query: 'from:Stripe',
        maxResults: 1,
      },
    },
    {
      type: 'gmail_read',
      id: 'read_email_body',
      operation: 'read',
      parameters: {
        // This parameter depends on the output of the previous instruction
        messageId: '$find_stripe_email.output.messages[0].id',
      },
    },
    {
      type: 'send_chat',
      id: 'display_email_body',
      operation: 'respond',
      parameters: {
        content: '$read_email_body.output',
      },
    },
  ];

  // 3. Execute the plan
  try {
    await cpu.executePlan(executionPlan);
  } catch (error) {
    console.error("\n*** An error occurred during plan execution! ***", error);
  }
}

main();
