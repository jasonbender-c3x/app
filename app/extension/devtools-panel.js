// DevTools Panel Script

const output = document.getElementById('output');

function log(message) {
  output.textContent = typeof message === 'object' 
    ? JSON.stringify(message, null, 2) 
    : message;
}

// Export HAR
document.getElementById('captureHAR').addEventListener('click', () => {
  chrome.devtools.network.getHAR((harLog) => {
    log(`HAR captured with ${harLog.entries.length} requests`);
    
    // Create download
    const blob = new Blob([JSON.stringify(harLog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meowstik-har-${Date.now()}.har`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

// Analyze Errors
document.getElementById('analyzeErrors').addEventListener('click', () => {
  chrome.devtools.network.getHAR((harLog) => {
    const errors = harLog.entries.filter(e => e.response.status >= 400);
    if (errors.length === 0) {
      log('No HTTP errors found in captured requests.');
    } else {
      const summary = errors.map(e => ({
        url: e.request.url.substring(0, 80),
        status: e.response.status,
        statusText: e.response.statusText
      }));
      log({ errorCount: errors.length, errors: summary });
    }
  });
});

// Performance Analysis
document.getElementById('inspectPerf').addEventListener('click', () => {
  chrome.devtools.network.getHAR((harLog) => {
    const stats = {
      totalRequests: harLog.entries.length,
      totalSize: 0,
      totalTime: 0,
      byType: {}
    };

    harLog.entries.forEach(entry => {
      stats.totalSize += entry.response.bodySize || 0;
      stats.totalTime += entry.time || 0;
      
      const type = entry.response.content.mimeType?.split('/')[0] || 'other';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    stats.totalSizeMB = (stats.totalSize / 1024 / 1024).toFixed(2) + ' MB';
    stats.avgTimeMs = (stats.totalTime / stats.totalRequests).toFixed(0) + ' ms';

    log(stats);
  });
});

// Send to Meowstik Chat
document.getElementById('sendToChat').addEventListener('click', async () => {
  const { apiBase } = await chrome.storage.local.get(['apiBase']);
  const baseUrl = apiBase || 'https://meowstik.replit.app';

  chrome.devtools.network.getHAR(async (harLog) => {
    try {
      const response = await fetch(`${baseUrl}/api/extension/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_har',
          har: {
            totalRequests: harLog.entries.length,
            entries: harLog.entries.slice(0, 50).map(e => ({
              url: e.request.url,
              method: e.request.method,
              status: e.response.status,
              time: e.time,
              size: e.response.bodySize
            }))
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        log(result.message || 'Sent to Meowstik!');
      }
    } catch (e) {
      log('Error: ' + e.message);
    }
  });
});

// Ask question
document.getElementById('ask').addEventListener('click', async () => {
  const question = document.getElementById('question').value.trim();
  if (!question) return;

  const { apiBase } = await chrome.storage.local.get(['apiBase']);
  const baseUrl = apiBase || 'https://meowstik.replit.app';

  log('Thinking...');

  chrome.devtools.network.getHAR(async (harLog) => {
    try {
      const response = await fetch(`${baseUrl}/api/extension/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'devtools_question',
          question: question,
          context: {
            totalRequests: harLog.entries.length,
            recentRequests: harLog.entries.slice(-20).map(e => ({
              url: e.request.url,
              method: e.request.method,
              status: e.response.status,
              time: e.time
            }))
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        log(result.message || 'No response');
      }
    } catch (e) {
      log('Error: ' + e.message);
    }
  });
});
