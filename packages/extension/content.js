(function() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  function interceptConsole(level, originalFn) {
    return function(...args) {
      try {
        chrome.runtime.sendMessage({
          type: 'CONSOLE_LOG',
          data: {
            level,
            message: args.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
              } catch {
                return String(arg);
              }
            }).join(' '),
            timestamp: Date.now(),
            url: window.location.href,
          },
        });
      } catch (e) {}
      return originalFn.apply(console, args);
    };
  }

  console.log = interceptConsole('log', originalLog);
  console.warn = interceptConsole('warn', originalWarn);
  console.error = interceptConsole('error', originalError);

  window.addEventListener('error', (event) => {
    try {
      chrome.runtime.sendMessage({
        type: 'CONSOLE_LOG',
        data: {
          level: 'error',
          message: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
          timestamp: Date.now(),
          url: window.location.href,
        },
      });
    } catch (e) {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      chrome.runtime.sendMessage({
        type: 'CONSOLE_LOG',
        data: {
          level: 'error',
          message: `Unhandled Promise Rejection: ${event.reason}`,
          timestamp: Date.now(),
          url: window.location.href,
        },
      });
    } catch (e) {}
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_CONTENT') {
      const content = {
        text: document.body.innerText,
        html: document.documentElement.outerHTML,
        title: document.title,
        url: window.location.href,
        links: Array.from(document.querySelectorAll('a')).slice(0, 50).map(a => ({
          text: a.innerText.trim(),
          href: a.href,
        })),
        images: Array.from(document.querySelectorAll('img')).slice(0, 20).map(img => ({
          src: img.src,
          alt: img.alt,
        })),
        forms: Array.from(document.querySelectorAll('form')).slice(0, 10).map(form => ({
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
            name: input.name,
            type: input.type,
            placeholder: input.placeholder,
          })),
        })),
      };
      sendResponse(content);
    }

    if (message.type === 'HIGHLIGHT_ELEMENT') {
      const { selector } = message;
      const element = document.querySelector(selector);
      if (element) {
        element.style.outline = '3px solid #4285f4';
        element.style.outlineOffset = '2px';
        setTimeout(() => {
          element.style.outline = '';
          element.style.outlineOffset = '';
        }, 3000);
      }
    }

    if (message.type === 'CLICK_ELEMENT') {
      const { selector } = message;
      const element = document.querySelector(selector);
      if (element) {
        element.click();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Element not found' });
      }
    }

    if (message.type === 'TYPE_TEXT') {
      const { selector, text } = message;
      const element = document.querySelector(selector);
      if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
        element.focus();
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Element not found or not an input' });
      }
    }

    return true;
  });
})();
