# MCP Bridge Extension for Claude Web

This Chrome extension enables file system and database access in Claude.ai web interface by connecting to your local MCP server.

## 🚀 Quick Start

### 1. Start the MCP Server

```bash
# In the mcp-chatgpt-server directory
cd ../mcp-chatgpt-server

# Run with the WebSocket-enabled version
cp main_with_websocket.py main.py

# Start with Docker
docker-compose up

# Or run locally
pip install -r requirements.txt
uvicorn main:app --reload
```

### 2. Install the Extension

1. Open Chrome/Edge and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `mcp-bridge-extension` folder
5. The MCP Bridge icon should appear in your toolbar

### 3. Configure the Extension

1. Click the MCP Bridge icon in toolbar
2. Enter your authentication token (must match server's `MCP_AUTH_TOKEN`)
3. Click "Save Settings"
4. Check that "Server Connection" shows green

### 4. Use in Claude.ai

Type commands directly in Claude's chat:

```
:fs.read package.json
:fs.write test.txt Hello from Claude!
:fs.list src/
:sql SELECT * FROM users LIMIT 5;
:search machine learning concepts
:help
```

## 📝 Available Commands

### File Operations
- `:fs.read <filepath>` - Read a file from workspace
- `:fs.write <filepath> <content>` - Write content to a file
- `:fs.list [directory]` - List files in directory
- `:fs.upload <filepath>` - Upload a file (coming soon)

### Database Operations
- `:sql <query>` - Execute PostgreSQL query
- `:sql.query <query>` - Alternative SQL syntax

### Vector Search
- `:embed id=<id> <content>` - Add document to vector store
- `:search <query>` - Search embedded documents

### Help
- `:help` - Show all available commands

## 🔒 Security

- All commands require authentication token
- Server only accepts connections from localhost
- Extension only runs on claude.ai domain
- File access is restricted to workspace directory

## 🛠️ Development

### Project Structure
```
mcp-bridge-extension/
├── manifest.json         # Extension configuration
├── src/
│   ├── background.js    # WebSocket connection manager
│   ├── content.js       # Command detection and UI integration
│   ├── popup.html       # Extension popup UI
│   ├── popup.js         # Popup functionality
│   └── styles.css       # Visual styles
└── icons/              # Extension icons
```

### Testing Commands

1. Basic file read:
   ```
   :fs.read README.md
   ```

2. Create and read file:
   ```
   :fs.write hello.txt This is a test file
   :fs.read hello.txt
   ```

3. SQL query:
   ```
   :sql CREATE TABLE test (id INT, name TEXT);
   :sql INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob');
   :sql SELECT * FROM test;
   ```

4. Vector search:
   ```
   :embed id=doc1 The quick brown fox jumps over the lazy dog
   :embed id=doc2 Machine learning is a subset of artificial intelligence
   :search fox jumping
   ```

## 🐛 Troubleshooting

### Extension not working?
1. Check server is running: `http://localhost:8000/health`
2. Verify auth token matches in extension and server
3. Check browser console for errors (F12)
4. Ensure you're on claude.ai website

### Commands not recognized?
1. Commands must start with `:` character
2. Use exact syntax (e.g., `:fs.read` not `:read`)
3. Check connection indicator (bottom right)

### Connection issues?
1. Restart the MCP server
2. Reload the extension
3. Clear browser cache and reload claude.ai

## 🔄 How It Works

1. **Command Detection**: Content script monitors Claude's input for command patterns
2. **WebSocket Bridge**: Background script maintains persistent connection to MCP server
3. **Action Processing**: Server executes file/database operations with full permissions
4. **Response Injection**: Results are formatted and inserted back into Claude's chat

## 🚧 Limitations

- Commands must be typed exactly as shown
- Large file uploads not yet supported
- Some Claude UI updates may break command detection
- WebSocket reconnection may take a few seconds

## 📊 Architecture

```
Claude.ai Web UI
      ↓
Content Script (command detection)
      ↓
Background Script (WebSocket client)
      ↓
FastAPI MCP Server (localhost:8000)
      ↓
PostgreSQL + File System + ChromaDB
```

## 🤝 Contributing

Pull requests welcome! Areas for improvement:
- File upload support
- Syntax highlighting for responses
- Command autocomplete
- Better error messages
- Multi-file operations