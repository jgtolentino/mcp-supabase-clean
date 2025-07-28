const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Scout-specific operations for the new schema
const scoutOperations = {
  // Get executive summary
  scout_summary: async (params) => {
    const { data, error } = await supabase
      .from('summary')
      .select('*')
      .eq('schema_name', 'scout')
      .single();
    
    if (error) throw error;
    return data || {
      total_transactions: 0,
      active_stores: 0,
      unique_customers: 0,
      total_revenue: 0,
      tbwa_brand_share_pct: 0
    };
  },

  // Get recent activity
  scout_activity: async (params) => {
    const { limit = 50 } = params;
    
    const query = `
      SELECT 
        id,
        timestamp,
        brand_name,
        peso_value,
        location,
        is_tbwa_client,
        handshake_score
      FROM scout.transactions
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
    
    try {
      const { data, error } = await supabase.rpc('execute_sql', {
        query_string: query
      });
      if (error) throw error;
      return data;
    } catch (e) {
      // Fallback
      return [];
    }
  },

  // Get brand performance
  scout_brands: async (params) => {
    const { tbwa_only = false, limit = 20 } = params;
    
    const query = `
      SELECT * FROM scout.competitive_dashboard
      ${tbwa_only ? "WHERE is_tbwa_client = true" : ""}
      ORDER BY total_revenue DESC
      LIMIT ${limit}
    `;
    
    try {
      const { data, error } = await supabase.rpc('execute_sql', {
        query_string: query
      });
      if (error) throw error;
      return data;
    } catch (e) {
      return [];
    }
  },

  // Get store analytics
  scout_stores: async (params) => {
    const { date = new Date().toISOString().split('T')[0], limit = 10 } = params;
    
    const query = `
      SELECT 
        sa.*,
        ms.store_name,
        ms.city,
        ms.region
      FROM scout.store_analytics sa
      JOIN public.master_stores ms ON sa.store_id = ms.store_id
      WHERE sa.date = '${date}'
      ORDER BY sa.total_revenue DESC
      LIMIT ${limit}
    `;
    
    try {
      const { data, error } = await supabase.rpc('execute_sql', {
        query_string: query
      });
      if (error) throw error;
      return data;
    } catch (e) {
      return [];
    }
  },

  // Generate Scout dashboard
  scout_dashboard: async (params) => {
    const { type = 'executive' } = params;
    
    // Fetch all necessary data
    const [summary, activity, brands] = await Promise.all([
      scoutOperations.scout_summary({}),
      scoutOperations.scout_activity({ limit: 20 }),
      scoutOperations.scout_brands({ limit: 10 })
    ]);
    
    // Generate HTML dashboard
    const html = generateScoutDashboard({
      type,
      summary,
      activity,
      brands,
      generated_at: new Date().toISOString()
    });
    
    return { html, data: { summary, activity, brands } };
  }
};

// Helper function to generate Scout dashboard HTML
function generateScoutDashboard(data) {
  const { summary, activity, brands, generated_at } = data;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Scout Analytics Dashboard</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: #f0f2f5; 
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      text-align: center;
    }
    .metric-value {
      font-size: 2.5em;
      font-weight: bold;
      color: #667eea;
      margin: 10px 0;
    }
    .metric-label {
      color: #718096;
      font-size: 0.9em;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    th {
      background: #f7fafc;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #4a5568;
    }
    td {
      padding: 15px;
      border-bottom: 1px solid #e2e8f0;
    }
    .tbwa-badge {
      background: #48bb78;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Scout Analytics Dashboard</h1>
    <p>Real-time insights • Generated: ${new Date(generated_at).toLocaleString()}</p>
  </div>

  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-label">Total Transactions</div>
      <div class="metric-value">${(summary.total_transactions || 0).toLocaleString()}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Active Stores</div>
      <div class="metric-value">${(summary.active_stores || 0).toLocaleString()}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Revenue</div>
      <div class="metric-value">₱${(summary.total_revenue || 0).toLocaleString()}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">TBWA Share</div>
      <div class="metric-value">${(summary.tbwa_brand_share_pct || 0).toFixed(1)}%</div>
    </div>
  </div>

  <h2>Top Brands</h2>
  <table>
    <thead>
      <tr>
        <th>Brand</th>
        <th>Status</th>
        <th>Revenue</th>
        <th>Transactions</th>
      </tr>
    </thead>
    <tbody>
      ${(brands || []).map(brand => `
        <tr>
          <td>${brand.brand_name || 'Unknown'}</td>
          <td>${brand.is_tbwa_client ? '<span class="tbwa-badge">TBWA</span>' : 'Other'}</td>
          <td>₱${(brand.total_revenue || 0).toLocaleString()}</td>
          <td>${(brand.transaction_count || 0).toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
}

module.exports = scoutOperations;
