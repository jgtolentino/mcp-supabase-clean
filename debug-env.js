// Debug environment variables for Render deployment
console.log('=== Environment Debug ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING');
console.log('SEARCH_PATH:', process.env.SEARCH_PATH || 'NOT SET');
console.log('PORT:', process.env.PORT || 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

// List all env vars that start with SUPABASE
console.log('\n=== All SUPABASE env vars ===');
Object.keys(process.env)
  .filter(key => key.startsWith('SUPABASE'))
  .forEach(key => {
    console.log(`${key}: ${process.env[key] ? 'SET' : 'MISSING'}`);
  });

console.log('\n=== Render-specific env vars ===');
console.log('RENDER:', process.env.RENDER ? 'SET' : 'MISSING');
console.log('RENDER_SERVICE_ID:', process.env.RENDER_SERVICE_ID ? 'SET' : 'MISSING');

process.exit(0);