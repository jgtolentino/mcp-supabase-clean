const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://chat.openai.com', 'https://claude.ai'],
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});
app.use('/mcp', limiter);

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Operation handlers
const operations = {
  // Original operations
  select: async (params) => {
    const { table, filters, columns, limit } = params;
    let query = supabase.from(table).select(columns?.join(',') || '*');
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    if (limit) query = query.limit(limit);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  
  insert: async (params) => {
    const { table, data } = params;
    const { data: result, error } = await supabase.from(table).insert(data).select();
    if (error) throw error;
    return result;
  },
  
  update: async (params) => {
    const { table, data, filters } = params;
    let query = supabase.from(table).update(data);
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    const { data: result, error } = await query.select();
    if (error) throw error;
    return result;
  },
  
  // NEW: List tables
  list_tables: async (params) => {
    try {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (error) throw error;
      return data;
    } catch (e) {
      // Fallback
      return { message: "Table listing requires appropriate permissions" };
    }
  },
  
  // NEW: Execute SQL (simplified)
  execute_sql: async (params) => {
    return { 
      message: "Direct SQL execution requires additional setup",
      suggestion: "Use 'select' operation for queries"
    };
  },
  
  // NEW: Generate dashboard
  generate_dashboard: async (params) => {
    const { table, title = 'Dashboard', columns, filters } = params;
    
    // Fetch data
    let query = supabase.from(table).select(columns?.join(',') || '*');
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Generate simple HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Total records: ${data?.length || 0}</p>
  <table>
    <thead>
      <tr>
        ${data && data.length > 0 ? 
          Object.keys(data[0]).map(key => `<th>${key}</th>`).join('') : 
          '<th>No data</th>'
        }
      </tr>
    </thead>
    <tbody>
      ${data && data.length > 0 ?
        data.map(row => `
          <tr>
            ${Object.values(row).map(val => 
              `<td>${val !== null ? val : '-'}</td>`
            ).join('')}
          </tr>
        `).join('') :
        '<tr><td>No records found</td></tr>'
      }
    </tbody>
  </table>
</body>
</html>`;
    
    return { html, recordCount: data?.length || 0 };
  }
};

// Main execution endpoint
app.post('/mcp/execute', async (req, res) => {
  try {
    const { operation, params = {} } = req.body;
    
    if (!operation || !operations[operation]) {
      return res.status(400).json({
        success: false,
        error: `Unknown operation: ${operation}`
      });
    }
    
    const result = await operations[operation](params);
    
    res.json({
      success: true,
      operation,
      result,
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Operation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Operation failed'
    });
  }
});

// Legacy endpoints
app.post('/mcp/:operation', async (req, res) => {
  req.body = { operation: req.params.operation, params: req.body };
  return app._router.handle(req, res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    capabilities: Object.keys(operations)
  });
});

// OpenAPI spec
app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'MCP Supabase Bridge',
      version: '2.0.0'
    },
    servers: [
      { url: `https://${req.get('host')}` }
    ],
    paths: {
      '/mcp/execute': {
        post: {
          summary: 'Execute operations',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    operation: {
                      type: 'string',
                      enum: Object.keys(operations)
                    },
                    params: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Success' }
          }
        }
      }
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP Bridge running on port ${PORT}`);
  console.log(`Available operations: ${Object.keys(operations).join(', ')}`);
});
