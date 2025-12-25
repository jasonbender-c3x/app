// Injected script to intercept console methods
// This runs in the page context, not the extension context

(function() {
  'use strict';

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };

  function formatArgs(args) {
    return args.map(arg => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  }

  function captureLog(type, args) {
    try {
      const log = {
        type: type,
        message: formatArgs(Array.from(args)),
        timestamp: Date.now(),
        stack: new Error().stack
      };

      window.dispatchEvent(new CustomEvent('meowstik-console', {
        detail: log
      }));
    } catch (e) {
      // Silently fail to avoid infinite loops
    }
  }

  // Override console methods
  console.log = function(...args) {
    captureLog('log', args);
    originalConsole.log.apply(console, args);
  };

  console.warn = function(...args) {
    captureLog('warn', args);
    originalConsole.warn.apply(console, args);
  };

  console.error = function(...args) {
    captureLog('error', args);
    originalConsole.error.apply(console, args);
  };

  console.info = function(...args) {
    captureLog('info', args);
    originalConsole.info.apply(console, args);
  };

  console.debug = function(...args) {
    captureLog('debug', args);
    originalConsole.debug.apply(console, args);
  };

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    captureLog('error', [
      `Uncaught ${event.error?.name || 'Error'}: ${event.message}`,
      `at ${event.filename}:${event.lineno}:${event.colno}`
    ]);
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    captureLog('error', [
      'Unhandled Promise Rejection:',
      event.reason?.message || event.reason || 'Unknown reason'
    ]);
  });
})();
