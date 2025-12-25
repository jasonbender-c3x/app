// Create a DevTools panel
chrome.devtools.panels.create(
  'Meowstik',
  'icons/icon16.png',
  'devtools-panel.html',
  (panel) => {
    console.log('Meowstik DevTools panel created');
  }
);

// Access network requests when DevTools is open
chrome.devtools.network.onRequestFinished.addListener((request) => {
  // Forward network data to panel if needed
  request.getContent((content, encoding) => {
    // Could send to background for storage
  });
});
