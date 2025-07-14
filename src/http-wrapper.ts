import express, { Request, Response } from 'express';
import { createTools } from './tools.js';

const app = express().use(express.json());

let tools: ReturnType<typeof createTools>;

try {
  tools = createTools();
} catch (error) {
  console.error('Failed to initialize tools:', error);
  process.exit(1);
}

app.post('/mcp/:tool', async (req: Request, res: Response) => {
  try {
    const toolName = req.params.tool as keyof typeof tools;
    const args = req.body;
    
    const tool = tools[toolName];
    if (!tool) {
      return res.status(404).json({ error: `Tool '${toolName}' not found` });
    }
    
    const validatedArgs = tool.schema.parse(args);
    const result = await (tool.handler as any)(validatedArgs);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', tools: Object.keys(tools) });
});

const port = Number(process.env.PORT || 10000);
app.listen(port, () => console.log(`HTTP adapter running on port ${port}`));