# Deployment Guide

## Render Deployment

### 1. Update Start Command
In Render dashboard, set the **Start Command** to:
```bash
node dist/http-wrapper.js
```

### 2. Environment Variables
Set these in Render or via KeyKey secrets:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SEARCH_PATH=public                    # optional, defaults to 'public'
PORT=10000                           # automatically set by Render
```

### 3. Verification
After deployment, test the HTTP endpoint:
```bash
curl https://your-app.onrender.com/health
curl https://your-app.onrender.com/mcp/select \
  -H "Content-Type: application/json" \
  -d '{"table":"your_table","columns":["id"],"limit":1}'
```

## Local Development

### Stdio Mode (Claude Desktop/Pulser)
```bash
npm run dev
```

### HTTP Mode (ChatGPT Plugin)
```bash
npm run dev:http
```

## Pulser Agent Configuration

Create a Pulser agent YAML file (if using Pulser):

```yaml
name: supabase_reader
codename: fin
endpoint: stdio
command: ["node", "/path/to/mcp-supabase-clean/dist/index.js"]
env:
  SUPABASE_URL: "https://your-project.supabase.co"
  SUPABASE_ANON_KEY: "your-anon-key"
  SEARCH_PATH: "your_schema"
tools:
  - name: select
  - name: insert  
  - name: update
```

Usage:
```bash
:fin.select table=invoices columns='["id","amount"]' limit=10
```

## ChatGPT Plugin Configuration

If creating a ChatGPT plugin, create an OpenAPI manifest:

```yaml
# openapi/chatgpt.yaml
openapi: 3.0.1
info:
  title: Supabase MCP Integration
  description: Clean MCP server for Supabase operations
  version: 1.0.1
servers:
  - url: https://your-app.onrender.com
paths:
  /mcp/select:
    post:
      summary: Select data from Supabase table
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                table:
                  type: string
                columns:
                  type: array
                  items:
                    type: string
                filter:
                  type: object
                limit:
                  type: number
                  maximum: 1000
```

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["/path/to/mcp-supabase-clean/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "SEARCH_PATH": "your_schema"
      }
    }
  }
}
```

## Integration Status

| Channel | Transport | Endpoint | Status |
|---------|-----------|----------|--------|
| Claude Desktop | stdio | `node dist/index.js` | ✅ |
| Pulser CLI | stdio | `:fin.select ...` | ✅ |
| ChatGPT Plugin | HTTP | `POST /mcp/select` | ✅ |
| Supabase CLI | direct | `supabase db push` | ✅ |