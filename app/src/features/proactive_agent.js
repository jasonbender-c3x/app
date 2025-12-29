/**
 * @file proactive_agent.js
 * @summary Implements the proactive agent for 'Live Mode' using timers.
 */

// This would be a more robust scheduler in a real backend, like node-cron.
const startProactiveTimer = (callback, interval) => {
  console.log(`Starting proactive agent timer with ${interval}ms interval.`);
  setInterval(callback, interval);
};

const triggerProactiveRemark = () => {
  console.log('Proactive agent triggered.');
  // TODO: Logic to generate a contextually relevant comment.
  // Example: Check project status, time of day, or user inactivity.
  const remark = 'Just checking in. How are things progressing on the auth service?';
  // TODO: Send this remark to the TTS engine for the AI to speak.
  // speak(remark);
};

// TODO: This function will be called when the user enters 'Live Mode'.
export function activateLiveModeAgent() {
  // Start a timer to trigger a proactive comment every 2 minutes (120000 ms).
  startProactiveTimer(triggerProactiveRemark, 120000);
}

console.log('Proactive Agent feature module loaded.');
