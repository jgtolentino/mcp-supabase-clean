# Update Instructions for WebSocket Support

To enable the Chrome extension bridge for Claude.ai, you need to use the WebSocket-enabled version of the server.

## Quick Update

```bash
# Backup current main.py
cp main.py main_original.py

# Use the WebSocket version
cp main_with_websocket.py main.py

# Restart your server
# If using Docker:
docker-compose restart

# If running locally:
# Ctrl+C to stop, then:
uvicorn main:app --reload
```

## What's New

1. **WebSocket endpoint** at `/ws` for real-time communication
2. **CORS support** for browser extension
3. **Unified action processing** - same logic for REST and WebSocket
4. **Connection management** for multiple clients
5. **Token authentication** over WebSocket

## Testing WebSocket

```bash
# Check health endpoint (shows WebSocket client count)
curl http://localhost:8000/health
```

## Architecture

```
ChatGPT Custom GPT ──REST API──┐
                               │
                               ├── FastAPI Server
                               │   (PostgreSQL + Files)
Claude.ai Extension ──WebSocket┘
```

Both clients share the same backend and authentication!