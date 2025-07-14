#!/usr/bin/env node

// HTTP-to-stdio proxy for Claude Desktop MCP
const readline = require('readline');
const axios = require('axios');

const API_URL = process.env.MCP_API_URL || 'http://localhost:8000';
const API_TOKEN = process.env.MCP_AUTH_TOKEN || 'your-secret-token';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// MCP protocol handler
async function handleRequest(request) {
  const { method, params } = request;
  
  try {
    switch (method) {
      case 'tools/list':
        return {
          tools: [
            { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
            { name: 'write_file', description: 'Write a file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
            { name: 'list_files', description: 'List files', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
            { name: 'sql_query', description: 'Execute SQL', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }
          ]
        };
        
      case 'tools/call':
        const { name, arguments: args } = params;
        const headers = { Authorization: `Bearer ${API_TOKEN}` };
        
        switch (name) {
          case 'read_file':
            const readRes = await axios.get(`${API_URL}/read/${args.path}`, { headers });
            return { content: [{ type: 'text', text: readRes.data.content }] };
            
          case 'write_file':
            const writeRes = await axios.post(`${API_URL}/write`, { filename: args.path, content: args.content }, { headers });
            return { content: [{ type: 'text', text: `Written to ${writeRes.data.path}` }] };
            
          case 'list_files':
            const listRes = await axios.get(`${API_URL}/files`, { params: { path: args.path || '' }, headers });
            return { content: [{ type: 'text', text: listRes.data.files.join('\n') }] };
            
          case 'sql_query':
            const sqlRes = await axios.post(`${API_URL}/sql`, { query: args.query }, { headers });
            return { content: [{ type: 'text', text: JSON.stringify(sqlRes.data.result, null, 2) }] };
        }
    }
  } catch (error) {
    return { error: { code: -32603, message: error.message } };
  }
}

// Main message loop
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    const response = {
      jsonrpc: '2.0',
      id: request.id,
      result: await handleRequest(request)
    };
    console.log(JSON.stringify(response));
  } catch (error) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: request?.id || null,
      error: { code: -32700, message: 'Parse error' }
    }));
  }
});

// Initialize
console.log(JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialized',
  params: { capabilities: {} }
}));