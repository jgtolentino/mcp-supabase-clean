import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

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

function createTools() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_ANON_KEY!;
  const searchPath = process.env.SEARCH_PATH ?? 'public';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase env vars missing; aborting.');
  }

  const db = createClient(supabaseUrl, supabaseKey, { 
    db: { schema: searchPath }
  });

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

  return {
    select: { schema: selectInputSchema, handler: handleSelect as any },
    insert: { schema: insertInputSchema, handler: handleInsert as any },
    update: { schema: updateInputSchema, handler: handleUpdate as any },
  };
}

export { createTools, selectInputSchema, insertInputSchema, updateInputSchema };
export type { SelectInput, InsertInput, UpdateInput };