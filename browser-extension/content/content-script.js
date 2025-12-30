/**
 * Meowstik Browser Extension - Content Script
 * 
 * Injected into every page to provide:
 * - Page content extraction
 * - Element selection for AI analysis
 * - DOM manipulation commands from AI
 * - Console/network log capture
 * - Full page screenshot support
 */

(function() {
  'use strict';

  let isSelecting = false;
  let highlightedElement = null;
  let overlay = null;

  function init() {
    setupMessageListener();
    setupConsoleInterceptor();
    injectStyles();
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sendResponse);
      return true;
    });
  }

  function handleMessage(message, sendResponse) {
    switch (message.type) {
      case 'get_page_content':
        sendResponse(getPageContent());
        break;

      case 'start_element_selection':
        startElementSelection();
        sendResponse({ success: true });
        break;

      case 'capture_full_page':
        captureFullPage().then(dataUrl => {
          sendResponse({ dataUrl });
        });
        return;

      case 'execute_command':
        executeCommand(message.command, message.params).then(result => {
          sendResponse(result);
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return;

      case 'highlight_element':
        highlightElement(message.selector);
        sendResponse({ success: true });
        break;

      case 'get_elements':
        sendResponse({ elements: getInteractiveElements() });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  function getPageContent() {
    const content = {
      url: window.location.href,
      title: document.title,
      content: document.body?.innerText?.substring(0, 50000) || '',
      html: document.documentElement.outerHTML.substring(0, 100000),
      meta: getMetaData(),
      links: getLinks(),
      forms: getForms(),
      headings: getHeadings()
    };

    return content;
  }

  function getMetaData() {
    const meta = {};
    document.querySelectorAll('meta').forEach(el => {
      const name = el.getAttribute('name') || el.getAttribute('property');
      const content = el.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });
    return meta;
  }

  function getLinks() {
    const links = [];
    document.querySelectorAll('a[href]').forEach(el => {
      links.push({
        text: el.innerText?.substring(0, 100) || '',
        href: el.href,
        title: el.title
      });
    });
    return links.slice(0, 100);
  }

  function getForms() {
    const forms = [];
    document.querySelectorAll('form').forEach((form, index) => {
      const fields = [];
      form.querySelectorAll('input, select, textarea').forEach(field => {
        fields.push({
          type: field.type || field.tagName.toLowerCase(),
          name: field.name,
          id: field.id,
          placeholder: field.placeholder,
          required: field.required
        });
      });
      forms.push({
        index,
        action: form.action,
        method: form.method,
        fields
      });
    });
    return forms;
  }

  function getHeadings() {
    const headings = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      headings.push({
        level: parseInt(h.tagName[1]),
        text: h.innerText?.substring(0, 200) || ''
      });
    });
    return headings;
  }

  function getInteractiveElements() {
    const elements = [];
    const selectors = 'a, button, input, select, textarea, [role="button"], [onclick]';
    
    document.querySelectorAll(selectors).forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        elements.push({
          index,
          tag: el.tagName.toLowerCase(),
          type: el.type,
          text: el.innerText?.substring(0, 50) || el.value?.substring(0, 50) || '',
          href: el.href,
          name: el.name,
          id: el.id,
          class: el.className,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      }
    });

    return elements.slice(0, 200);
  }

  function startElementSelection() {
    if (isSelecting) return;
    
    isSelecting = true;
    document.body.style.cursor = 'crosshair';

    overlay = document.createElement('div');
    overlay.id = 'meowstik-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999998;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);
  }

  function stopElementSelection() {
    isSelecting = false;
    document.body.style.cursor = '';

    if (overlay) {
      overlay.remove();
      overlay = null;
    }

    if (highlightedElement) {
      highlightedElement.style.outline = '';
      highlightedElement = null;
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown);
  }

  function handleMouseMove(e) {
    if (!isSelecting) return;

    const element = document.elementFromPoint(e.clientX, e.clientY);
    
    if (element && element !== highlightedElement && element !== overlay) {
      if (highlightedElement) {
        highlightedElement.style.outline = '';
      }
      
      highlightedElement = element;
      highlightedElement.style.outline = '2px solid #e94560';
    }
  }

  function handleClick(e) {
    if (!isSelecting) return;

    e.preventDefault();
    e.stopPropagation();

    const element = highlightedElement;
    stopElementSelection();

    if (element) {
      const elementInfo = {
        tag: element.tagName.toLowerCase(),
        id: element.id,
        class: element.className,
        text: element.innerText?.substring(0, 500) || '',
        html: element.outerHTML.substring(0, 2000),
        rect: element.getBoundingClientRect().toJSON(),
        attributes: getElementAttributes(element)
      };

      chrome.runtime.sendMessage({
        type: 'element_selected',
        element: elementInfo
      });
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      stopElementSelection();
    }
  }

  function getElementAttributes(element) {
    const attrs = {};
    Array.from(element.attributes).forEach(attr => {
      attrs[attr.name] = attr.value;
    });
    return attrs;
  }

  function highlightElement(selector) {
    const elements = document.querySelectorAll('.meowstik-highlight');
    elements.forEach(el => el.classList.remove('meowstik-highlight'));

    if (selector) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          element.classList.add('meowstik-highlight');
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (e) {
        console.error('Invalid selector:', selector);
      }
    }
  }

  async function captureFullPage() {
    const originalScrollPos = window.scrollY;
    const totalHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const canvas = document.createElement('canvas');
    canvas.width = viewportWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    let currentY = 0;

    while (currentY < totalHeight) {
      window.scrollTo(0, currentY);
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const response = await chrome.runtime.sendMessage({ 
          type: 'capture_visible_for_scroll' 
        });
        
        if (response?.dataUrl) {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = response.dataUrl;
          });
          
          ctx.drawImage(img, 0, currentY);
        }
      } catch (e) {
        console.error('Capture segment failed:', e);
      }

      currentY += viewportHeight;
    }

    window.scrollTo(0, originalScrollPos);
    return canvas.toDataURL('image/png');
  }

  async function executeCommand(command, params) {
    switch (command) {
      case 'click':
        return clickElement(params);

      case 'type':
        return typeText(params);

      case 'scroll':
        return scrollPage(params);

      case 'wait':
        return waitFor(params);

      case 'get_element':
        return getElementInfo(params);

      case 'fill_form':
        return fillForm(params);

      case 'submit_form':
        return submitForm(params);

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async function clickElement({ selector, x, y }) {
    let element;

    if (selector) {
      element = document.querySelector(selector);
    } else if (x !== undefined && y !== undefined) {
      element = document.elementFromPoint(x, y);
    }

    if (!element) {
      throw new Error('Element not found');
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 200));

    element.click();

    return { success: true, clicked: selector || `(${x}, ${y})` };
  }

  async function typeText({ selector, text, clear }) {
    const element = document.querySelector(selector);
    
    if (!element) {
      throw new Error('Element not found');
    }

    element.focus();
    
    if (clear) {
      element.value = '';
    }

    element.value += text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return { success: true, typed: text.length };
  }

  async function scrollPage({ direction, amount, selector }) {
    if (selector) {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      const scrollAmount = amount || 500;
      
      switch (direction) {
        case 'down':
          window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
          break;
        case 'up':
          window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
          break;
        case 'bottom':
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          break;
        case 'top':
          window.scrollTo({ top: 0, behavior: 'smooth' });
          break;
      }
    }

    return { success: true };
  }

  async function waitFor({ selector, timeout = 10000 }) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        const element = document.querySelector(selector);
        
        if (element) {
          resolve({ success: true, found: true });
          return;
        }

        if (Date.now() - startTime > timeout) {
          resolve({ success: true, found: false, timedOut: true });
          return;
        }

        requestAnimationFrame(check);
      };

      check();
    });
  }

  function getElementInfo({ selector }) {
    const element = document.querySelector(selector);
    
    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    return {
      success: true,
      element: {
        tag: element.tagName.toLowerCase(),
        id: element.id,
        class: element.className,
        text: element.innerText?.substring(0, 500) || '',
        value: element.value,
        href: element.href,
        src: element.src,
        rect: element.getBoundingClientRect().toJSON(),
        visible: isElementVisible(element)
      }
    };
  }

  function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }

  async function fillForm({ selector, data }) {
    const form = selector ? document.querySelector(selector) : document.querySelector('form');
    
    if (!form) {
      throw new Error('Form not found');
    }

    const filled = [];

    for (const [fieldName, value] of Object.entries(data)) {
      const selectors = [
        `[name="${fieldName}"]`,
        `#${fieldName}`,
        `[id="${fieldName}"]`,
        `[placeholder*="${fieldName}" i]`
      ];

      for (const sel of selectors) {
        try {
          const field = form.querySelector(sel);
          if (field) {
            field.value = String(value);
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            filled.push(fieldName);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    return { success: true, filled };
  }

  async function submitForm({ selector }) {
    const form = selector ? document.querySelector(selector) : document.querySelector('form');
    
    if (!form) {
      throw new Error('Form not found');
    }

    const submitButton = form.querySelector('[type="submit"]') || 
                         form.querySelector('button:not([type])');

    if (submitButton) {
      submitButton.click();
    } else {
      form.submit();
    }

    return { success: true };
  }

  function setupConsoleInterceptor() {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    ['log', 'warn', 'error', 'info'].forEach(level => {
      console[level] = function(...args) {
        originalConsole[level].apply(console, args);
        
        try {
          chrome.runtime.sendMessage({
            type: 'console_log',
            level,
            args: args.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
              } catch {
                return String(arg);
              }
            })
          });
        } catch (e) {
        }
      };
    });
  }

  function injectStyles() {
    if (document.getElementById('meowstik-styles')) return;

    const style = document.createElement('style');
    style.id = 'meowstik-styles';
    style.textContent = `
      .meowstik-highlight {
        outline: 3px solid #e94560 !important;
        outline-offset: 2px !important;
      }
      
      #meowstik-overlay {
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
