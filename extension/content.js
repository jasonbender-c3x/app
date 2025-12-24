// Meowstik Content Script
// Runs on every page to capture console logs, DOM info, and handle interactions

(function() {
  'use strict';

  // Store for captured console logs
  const consoleLogs = [];
  const MAX_LOGS = 200;

  // Inject console interceptor
  function injectConsoleInterceptor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Listen for console logs from injected script
  window.addEventListener('meowstik-console', (event) => {
    const log = event.detail;
    consoleLogs.push({
      type: log.type,
      message: log.message,
      timestamp: log.timestamp,
      stack: log.stack
    });

    // Limit stored logs
    if (consoleLogs.length > MAX_LOGS) {
      consoleLogs.shift();
    }
  });

  // Extract page content
  function getPageContent() {
    const content = {
      url: window.location.href,
      title: document.title,
      text: '',
      html: '',
      meta: {},
      links: [],
      images: [],
      forms: [],
      headings: []
    };

    // Get main text content
    const bodyClone = document.body.cloneNode(true);
    // Remove scripts and styles
    bodyClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    content.text = bodyClone.innerText.substring(0, 50000); // Limit size

    // Get simplified HTML structure
    content.html = document.documentElement.outerHTML.substring(0, 100000);

    // Meta tags
    document.querySelectorAll('meta').forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const value = meta.getAttribute('content');
      if (name && value) {
        content.meta[name] = value;
      }
    });

    // Links (first 50)
    document.querySelectorAll('a[href]').forEach((a, i) => {
      if (i < 50) {
        content.links.push({
          text: a.innerText.trim().substring(0, 100),
          href: a.href
        });
      }
    });

    // Images (first 20)
    document.querySelectorAll('img').forEach((img, i) => {
      if (i < 20) {
        content.images.push({
          src: img.src,
          alt: img.alt,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      }
    });

    // Forms
    document.querySelectorAll('form').forEach((form, i) => {
      if (i < 10) {
        const inputs = [];
        form.querySelectorAll('input, textarea, select').forEach(input => {
          inputs.push({
            type: input.type || input.tagName.toLowerCase(),
            name: input.name,
            id: input.id,
            placeholder: input.placeholder
          });
        });
        content.forms.push({
          action: form.action,
          method: form.method,
          inputs: inputs
        });
      }
    });

    // Headings
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h, i) => {
      if (i < 30) {
        content.headings.push({
          level: parseInt(h.tagName.substring(1)),
          text: h.innerText.trim().substring(0, 200)
        });
      }
    });

    return content;
  }

  // Get selected text
  function getSelection() {
    return window.getSelection().toString();
  }

  // Click element by selector
  function clickElement(selector) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        element.click();
        return { success: true };
      }
      return { success: false, error: 'Element not found' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Type text into element
  function typeText(selector, text) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        element.focus();
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }
      return { success: false, error: 'Element not found' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Get element info at point
  function getElementAtPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      text: element.innerText?.substring(0, 200),
      attributes: Array.from(element.attributes).map(a => ({
        name: a.name,
        value: a.value
      })),
      computedStyle: {
        display: getComputedStyle(element).display,
        position: getComputedStyle(element).position,
        color: getComputedStyle(element).color,
        backgroundColor: getComputedStyle(element).backgroundColor
      },
      rect: element.getBoundingClientRect()
    };
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'getConsoleLogs':
        sendResponse(consoleLogs);
        break;

      case 'getPageContent':
        sendResponse(getPageContent());
        break;

      case 'getSelection':
        sendResponse(getSelection());
        break;

      case 'click':
        sendResponse(clickElement(message.selector));
        break;

      case 'type':
        sendResponse(typeText(message.selector, message.text));
        break;

      case 'getElementAt':
        sendResponse(getElementAtPoint(message.x, message.y));
        break;

      case 'executeScript':
        try {
          const result = eval(message.script);
          sendResponse({ success: true, result });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        break;

      case 'highlight':
        try {
          const el = document.querySelector(message.selector);
          if (el) {
            el.style.outline = '3px solid #667eea';
            el.style.outlineOffset = '2px';
            setTimeout(() => {
              el.style.outline = '';
              el.style.outlineOffset = '';
            }, 3000);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Element not found' });
          }
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true; // Keep channel open for async response
  });

  // Inject console interceptor when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectConsoleInterceptor);
  } else {
    injectConsoleInterceptor();
  }

  console.log('Meowstik content script loaded');
})();
