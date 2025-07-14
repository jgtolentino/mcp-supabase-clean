// Content script for Claude.ai MCP integration
console.log('MCP Bridge content script loaded');

// Command patterns
const COMMANDS = {
  // File operations
  ':fs.read': /^:fs\.read\s+(.+)$/,
  ':fs.write': /^:fs\.write\s+([^\s]+)\s+(.+)$/s,
  ':fs.list': /^:fs\.list\s*(.*)$/,
  ':fs.upload': /^:fs\.upload\s+(.+)$/,
  
  // SQL operations
  ':sql': /^:sql\s+(.+)$/s,
  ':sql.query': /^:sql\.query\s+(.+)$/s,
  
  // Vector search
  ':embed': /^:embed\s+id=([^\s]+)\s+(.+)$/s,
  ':search': /^:search\s+(.+)$/,
  
  // Help
  ':help': /^:help$/
};

// Help text
const HELP_TEXT = `
**MCP Bridge Commands:**

**File Operations:**
- \`:fs.read <filepath>\` - Read a file
- \`:fs.write <filepath> <content>\` - Write to a file
- \`:fs.list [directory]\` - List files in directory
- \`:fs.upload <filepath>\` - Upload a file

**Database Operations:**
- \`:sql <query>\` - Execute SQL query
- \`:sql.query <query>\` - Same as :sql

**Vector Search:**
- \`:embed id=<id> <content>\` - Embed document
- \`:search <query>\` - Search documents

**Other:**
- \`:help\` - Show this help message
`;

// Parse commands from text
function parseCommand(text) {
  const trimmed = text.trim();
  
  for (const [cmdName, pattern] of Object.entries(COMMANDS)) {
    const match = trimmed.match(pattern);
    if (match) {
      switch (cmdName) {
        case ':fs.read':
          return { action: 'read', params: { filepath: match[1].trim() } };
          
        case ':fs.write':
          return { action: 'write', params: { 
            filepath: match[1].trim(), 
            content: match[2].trim() 
          }};
          
        case ':fs.list':
          return { action: 'list', params: { path: match[1].trim() || '' } };
          
        case ':fs.upload':
          return { action: 'upload', params: { filepath: match[1].trim() } };
          
        case ':sql':
        case ':sql.query':
          return { action: 'sql', params: { query: match[1].trim() } };
          
        case ':embed':
          return { action: 'embed', params: { 
            id: match[1].trim(), 
            content: match[2].trim() 
          }};
          
        case ':search':
          return { action: 'search', params: { query: match[1].trim() } };
          
        case ':help':
          return { action: 'help' };
      }
    }
  }
  
  return null;
}

// Format response for display
function formatResponse(result, action) {
  if (action === 'help') {
    return HELP_TEXT;
  }
  
  if (result.error) {
    return `**Error:** ${result.error}`;
  }
  
  switch (action) {
    case 'read':
      return `\`\`\`\n${result.content || ''}\n\`\`\``;
      
    case 'write':
      return `✅ File written: \`${result.filename}\``;
      
    case 'list':
      const files = result.files || [];
      return files.length ? 
        '**Files:**\n' + files.map(f => `- ${f}`).join('\n') : 
        '*No files found*';
      
    case 'sql':
      const rows = result.result || [];
      if (Array.isArray(rows) && rows.length > 0) {
        return '```json\n' + JSON.stringify(rows, null, 2) + '\n```';
      }
      return `✅ Query executed: ${result.result}`;
      
    case 'embed':
      return `✅ Document embedded with ID: \`${result.id}\``;
      
    case 'search':
      const results = result.results || [];
      if (results.length === 0) return '*No results found*';
      
      return '**Search Results:**\n' + results.map((r, i) => 
        `${i + 1}. **${r.id}** (score: ${r.distance?.toFixed(3)})\n   ${r.content.substring(0, 100)}...`
      ).join('\n\n');
      
    default:
      return '```json\n' + JSON.stringify(result, null, 2) + '\n```';
  }
}

// Find the chat input textarea
function getChatInput() {
  // Claude's textarea selector (may need updates if UI changes)
  return document.querySelector('div[contenteditable="true"]') || 
         document.querySelector('textarea');
}

// Submit the current input
function submitInput() {
  const input = getChatInput();
  if (!input) return;
  
  // Find and click the submit button
  const submitButton = input.closest('form')?.querySelector('button[type="submit"]') ||
                      document.querySelector('button[aria-label*="Send"]') ||
                      document.querySelector('button:has(svg)'); // Send icon button
  
  if (submitButton && !submitButton.disabled) {
    submitButton.click();
  } else {
    // Fallback: simulate Enter key
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  }
}

// Set text in the input
function setInputText(text) {
  const input = getChatInput();
  if (!input) return;
  
  if (input.tagName === 'TEXTAREA') {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // For contenteditable divs
    input.textContent = text;
    input.innerHTML = text.replace(/\n/g, '<br>');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Intercept Enter key to check for commands
let isProcessingCommand = false;

document.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !isProcessingCommand) {
    const input = getChatInput();
    if (!input || !input.matches(':focus')) return;
    
    const text = input.tagName === 'TEXTAREA' ? input.value : input.textContent;
    const command = parseCommand(text);
    
    if (command) {
      event.preventDefault();
      event.stopPropagation();
      isProcessingCommand = true;
      
      // Show processing state
      setInputText('⏳ Processing MCP command...');
      
      if (command.action === 'help') {
        // Handle help locally
        setInputText(formatResponse({}, 'help'));
        setTimeout(() => {
          submitInput();
          isProcessingCommand = false;
        }, 100);
        return;
      }
      
      // Generate request ID
      const requestId = crypto.randomUUID();
      
      // Send to background script
      chrome.runtime.sendMessage({
        type: 'mcp-request',
        requestId,
        action: command.action,
        params: command.params
      });
      
      // Store command info for response handling
      window.mcpPendingCommand = { requestId, action: command.action };
    }
  }
}, true);

// Listen for responses from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'mcp-response' && window.mcpPendingCommand?.requestId === message.requestId) {
    const { action } = window.mcpPendingCommand;
    const formattedResponse = formatResponse(message.result || message, action);
    
    setInputText(formattedResponse);
    
    // Auto-submit after a short delay
    setTimeout(() => {
      submitInput();
      isProcessingCommand = false;
      window.mcpPendingCommand = null;
    }, 100);
  }
});

// Add visual indicator when connected
function updateConnectionStatus() {
  chrome.runtime.sendMessage({ type: 'check-connection' }, (response) => {
    const indicator = document.getElementById('mcp-status-indicator') || createStatusIndicator();
    if (response?.connected) {
      indicator.classList.add('connected');
      indicator.title = 'MCP Bridge Connected';
    } else {
      indicator.classList.remove('connected');
      indicator.title = 'MCP Bridge Disconnected';
    }
  });
}

// Create status indicator
function createStatusIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'mcp-status-indicator';
  indicator.className = 'mcp-status-indicator';
  indicator.title = 'MCP Bridge Status';
  document.body.appendChild(indicator);
  return indicator;
}

// Check connection status periodically
setInterval(updateConnectionStatus, 5000);
updateConnectionStatus();