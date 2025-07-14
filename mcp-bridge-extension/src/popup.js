// Popup script for MCP Bridge extension

// Check connection status
function checkConnection() {
  chrome.runtime.sendMessage({ type: 'check-connection' }, (response) => {
    const statusIndicator = document.getElementById('server-status');
    if (response?.connected) {
      statusIndicator.classList.add('connected');
    } else {
      statusIndicator.classList.remove('connected');
    }
  });
}

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(['authToken'], (result) => {
    if (result.authToken) {
      document.getElementById('auth-token').value = result.authToken;
    }
  });
}

// Save settings
document.getElementById('save-settings').addEventListener('click', () => {
  const authToken = document.getElementById('auth-token').value;
  
  chrome.storage.local.set({ authToken }, () => {
    // Update background script with new token
    chrome.runtime.sendMessage({
      type: 'update-settings',
      authToken
    });
    
    // Show feedback
    const button = document.getElementById('save-settings');
    const originalText = button.textContent;
    button.textContent = 'Saved!';
    button.style.background = '#28a745';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '#1a1a1a';
    }, 2000);
  });
});

// Initialize
checkConnection();
loadSettings();

// Refresh status every 2 seconds
setInterval(checkConnection, 2000);