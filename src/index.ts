#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const supabaseUrl   = process.env.SUPABASE_URL!;
const supabaseKey   = process.env.SUPABASE_ANON_KEY!;
const searchPath    = process.env.SEARCH_PATH ?? 'public';

if (!supabaseUrl || !supabaseKey)
  throw new Error('Supabase env vars missing; aborting.');

const db = createClient(supabaseUrl, supabaseKey, { 
  db: { schema: searchPath }
});

const selectInputSchema = z.object({
  table: z.string().describe('Table name to query'),
  columns: z.array(z.string()).min(1).describe('Columns to fetch'),
  filter: z.record(z.union([z.string(), z.number(), z.boolean()]))
    .optional().describe('Exact-match filters'),
  limit: z.number().min(1).max(1000).default(100).describe('Maximum rows to return'),
});

const insertInputSchema = z.object({
  table: z.string().describe('Table name to insert into'),
  data: z.union([
    z.record(z.any()),
    z.array(z.record(z.any()))
  ]).describe('Data to insert (single object or array of objects)'),
});

const updateInputSchema = z.object({
  table: z.string().describe('Table name to update'),
  data: z.record(z.any()).describe('Data to update'),
  filter: z.record(z.union([z.string(), z.number(), z.boolean()]))
    .describe('Filter to identify rows to update'),
});

type SelectInput = z.infer<typeof selectInputSchema>;
type InsertInput = z.infer<typeof insertInputSchema>;
type UpdateInput = z.infer<typeof updateInputSchema>;

async function handleSelect(args: SelectInput) {
  const { table, columns, filter, limit } = args;
  let query = db.from(table).select(columns.join(','), { count: 'exact' }).limit(limit);
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data, count };
}

async function handleInsert(args: InsertInput) {
  const { table, data } = args;
  const { data: result, error } = await db.from(table).insert(data).select();
  if (error) throw new Error(error.message);
  return { inserted: result };
}

async function handleUpdate(args: UpdateInput) {
  const { table, data, filter } = args;
  let query = db.from(table).update(data);
  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { data: result, error } = await query.select();
  if (error) throw new Error(error.message);
  return { updated: result };
}

export const tools = {
  select: { schema: selectInputSchema, handler: handleSelect as any },
  insert: { schema: insertInputSchema, handler: handleInsert as any },
  update: { schema: updateInputSchema, handler: handleUpdate as any },
};

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