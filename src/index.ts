#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTools } from './tools.js';

const tools = createTools();

export const server = new Server({
  name: 'mcp-supabase-clean',
  version: '1.0.0',
});

import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'select',
      description: 'Select data from a Supabase table using safe query builder',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Table name to query' },
          columns: { 
            type: 'array', 
            items: { type: 'string' },
            minItems: 1,
            description: 'Columns to fetch' 
          },
          filter: { 
            type: 'object',
            additionalProperties: true,
            description: 'Exact-match filters' 
          },
          limit: { 
            type: 'number', 
            minimum: 1, 
            maximum: 1000, 
            default: 100,
            description: 'Maximum rows to return' 
          },
        },
        required: ['table', 'columns'],
      },
    },
    {
      name: 'insert',
      description: 'Insert data into a Supabase table',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Table name to insert into' },
          data: {
            oneOf: [
              { type: 'object', description: 'Single object to insert' },
              { type: 'array', items: { type: 'object' }, description: 'Array of objects to insert' }
            ]
          },
        },
        required: ['table', 'data'],
      },
    },
    {
      name: 'update',
      description: 'Update data in a Supabase table',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Table name to update' },
          data: { type: 'object', description: 'Data to update' },
          filter: { 
            type: 'object',
            additionalProperties: true,
            description: 'Filter to identify rows to update' 
          },
        },
        required: ['table', 'data', 'filter'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools[request.params.name as keyof typeof tools];
  if (!tool) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${request.params.name}`
    );
  }
  
  try {
    const args = tool.schema.parse(request.params.arguments);
    const result = await (tool.handler as any)(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 MCP Supabase server running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}