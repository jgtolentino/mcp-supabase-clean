# MCP Supabase Clean

Clean, production-safe MCP server for Supabase integration that follows all MCP best practices.

## Features

- **Stdio-only MCP server** for Claude Desktop & Pulser
- **HTTP wrapper** for ChatGPT plugin compatibility  
- **Safe query builder** (no raw SQL, RLS respected)
- **Schema validation** with Zod
- **Multi-stage Docker build** for minimal runtime

## Environment Variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SEARCH_PATH=public                    # optional, defaults to 'public'
PORT=10000                           # only for HTTP mode
```

## Usage

### Claude Desktop / Pulser (stdio)
```bash
npm run start        # or node dist/index.js
```

### ChatGPT Plugin (HTTP)
```bash
npm run start:http   # or node dist/http-wrapper.js
```

### Development
```bash
npm run dev          # stdio mode
npm run dev:http     # HTTP mode
```

## Tools

- `select` - Run filtered SELECT queries
- `insert` - Insert data into tables  
- `update` - Update data with filters

## Example Pulser Commands

```bash
:fin.select table=invoices columns='["id","amount"]' filter='{"status":"paid"}' limit=10
:fin.insert table=customers data='{"name":"ACME Corp","email":"acme@example.com"}'
:fin.update table=invoices data='{"status":"paid"}' filter='{"id":"123"}'
```

## Example ChatGPT API Calls

```bash
curl -X POST https://your-app.onrender.com/mcp/select \
  -H "Content-Type: application/json" \
  -d '{"table":"invoices","columns":["id","amount"],"limit":5}'
```

## Deployment

### Render
1. Connect GitHub repo
2. Set environment variables  
3. Deploy - HTTP wrapper runs automatically

### Claude Desktop
```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["/path/to/mcp-supabase-clean/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

## Integration Matrix

| Channel | Transport | Command | Status |
|---------|-----------|---------|--------|
| Claude Desktop | stdio | `node dist/index.js` | ✅ |
| Pulser CLI | stdio | `:fin.select ...` | ✅ |
| ChatGPT Plugin | HTTP | `POST /mcp/select` | ✅ |
| Supabase CLI | direct | `supabase db push` | ✅ |