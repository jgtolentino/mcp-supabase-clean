// Background service worker for MCP Bridge
let ws = null;
let wsReconnectTimer = null;
const pendingRequests = new Map();

// Configuration
const WS_URL = 'ws://localhost:8000/ws';
let AUTH_TOKEN = 'your-secret-token'; // Will be loaded from storage

// WebSocket connection management
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  
  console.log('Connecting to MCP server...');
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('MCP WebSocket connected');
    clearTimeout(wsReconnectTimer);
    
    // Send auth token
    ws.send(JSON.stringify({
      type: 'auth',
      token: AUTH_TOKEN
    }));
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received from MCP:', data);
      
      if (data.requestId && pendingRequests.has(data.requestId)) {
        const { tabId } = pendingRequests.get(data.requestId);
        chrome.tabs.sendMessage(tabId, {
          type: 'mcp-response',
          requestId: data.requestId,
          result: data.result,
          error: data.error
        });
        pendingRequests.delete(data.requestId);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting in 5s...');
    ws = null;
    wsReconnectTimer = setTimeout(connectWebSocket, 5000);
  };
}

// Message handler from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.type === 'mcp-request') {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
      sendResponse({ error: 'MCP server not connected. Retrying...' });
      return;
    }
    
    // Store request info for response routing
    pendingRequests.set(message.requestId, {
      tabId: sender.tab.id,
      timestamp: Date.now()
    });
    
    // Forward to MCP server
    ws.send(JSON.stringify({
      requestId: message.requestId,
      action: message.action,
      params: message.params
    }));
    
    sendResponse({ status: 'sent' });
  }
  
  else if (message.type === 'check-connection') {
    sendResponse({
      connected: ws && ws.readyState === WebSocket.OPEN
    });
  }
  
  return true; // Keep message channel open for async response
});

// Load auth token and initialize connection
chrome.storage.local.get(['authToken'], (result) => {
  if (result.authToken) {
    AUTH_TOKEN = result.authToken;
  }
  connectWebSocket();
});

// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'update-settings' && message.authToken) {
    AUTH_TOKEN = message.authToken;
    // Reconnect with new token
    if (ws) {
      ws.close();
    }
    connectWebSocket();
  }
});

// Clean up old pending requests periodically
setInterval(() => {
  const now = Date.now();
  for (const [requestId, info] of pendingRequests.entries()) {
    if (now - info.timestamp > 30000) { // 30 second timeout
      pendingRequests.delete(requestId);
    }
  }
}, 60000);