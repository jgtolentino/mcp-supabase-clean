# MCP ChatGPT Server

Full-featured MCP server for ChatGPT with PostgreSQL backend, providing read/write file access and database operations equivalent to Claude Desktop's MCP capabilities.

## Features

- **File Operations**: Upload, write, read, and list files
- **PostgreSQL Access**: Full read/write database access
- **Vector Search**: ChromaDB integration for semantic search
- **Secure**: Token-based authentication
- **Logging**: All operations logged to PostgreSQL

## Quick Start

### 1. Local Development

```bash
# Clone and setup
cd mcp-chatgpt-server
cp .env.example .env

# Edit .env with your settings
# MCP_AUTH_TOKEN=your-secure-token

# Run with Docker Compose
docker-compose up

# Or run directly
pip install -r requirements.txt
uvicorn main:app --reload
```

### 2. Expose to ChatGPT

**Option A: Ngrok (Quick)**
```bash
ngrok http 8000
# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

**Option B: Deploy to Render**
```bash
# Push to GitHub
git init
git add .
git commit -m "Initial MCP ChatGPT server"
git remote add origin YOUR_GITHUB_REPO
git push -u origin main

# Deploy on Render with environment variables:
# DATABASE_URL = your-postgres-url
# MCP_AUTH_TOKEN = your-secret-token
```

### 3. Configure ChatGPT

1. Go to ChatGPT > Settings > Custom GPTs
2. Create new GPT
3. Add Actions > Import OpenAPI schema
4. Paste contents of `openapi.yaml`
5. Set server URL to your ngrok/Render URL
6. Add authentication header: `Authorization: Bearer YOUR_TOKEN`

## API Endpoints

### File Operations
- `POST /upload` - Upload files
- `POST /write` - Write file content
- `GET /read/{filename}` - Read files
- `GET /files` - List workspace files

### Database Operations
- `POST /sql` - Execute PostgreSQL queries with full R/W access

### Vector Search
- `POST /embed` - Add documents to vector store
- `POST /search` - Semantic search

## Example Usage in ChatGPT

```
User: "Create a Python script that analyzes sales data"

ChatGPT: [Uses /write endpoint to create analyze_sales.py]

User: "Now create a SQL table for storing results"

ChatGPT: [Uses /sql endpoint to CREATE TABLE sales_analysis]

User: "Run the script and save results to the database"

ChatGPT: [Reads file, processes data, writes to PostgreSQL]
```

## Security

- All endpoints require Bearer token authentication
- PostgreSQL credentials should be kept secure
- Use HTTPS in production (Render/Ngrok provide this)

## Architecture

```
ChatGPT <--> HTTPS <--> FastAPI Server
                            |
                            ├── PostgreSQL (full R/W)
                            ├── File System (workspace/)
                            └── ChromaDB (vector search)
```

## Comparison with Claude Desktop MCP

| Feature | Claude Desktop | ChatGPT + This Server |
|---------|----------------|----------------------|
| File R/W | ✅ Native | ✅ Via API |
| Database | ✅ SQLite | ✅ PostgreSQL |
| Vector Search | ❌ | ✅ ChromaDB |
| Auth | Local only | Token-based |
| Deployment | Desktop app | Cloud/Local |

## Troubleshooting

1. **Connection refused**: Check PostgreSQL is running
2. **Auth errors**: Verify MCP_AUTH_TOKEN matches
3. **File not found**: Files are relative to workspace/
4. **SQL errors**: Check query syntax and permissions

## Development

```bash
# Run tests
pytest

# Format code
black .

# Type checking
mypy .
```

## License

MIT