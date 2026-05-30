'use strict';
// Run once to create Supabase buckets and jobs table
// node scripts/setup-supabase.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Setting up Supabase...\n');

  // Create buckets
  for (const id of ['inputs', 'outputs']) {
    const { error } = await sb.storage.createBucket(id, { public: false });
    if (error && !error.message.includes('already exists')) {
      console.error(`  ✗ bucket ${id}:`, error.message);
    } else {
      console.log(`  ✓ bucket "${id}" ready`);
    }
  }

  // Create jobs table via RPC (requires pg_tle or direct SQL)
  // Since PostgREST can't do DDL, test if table exists first
  const { error: tableErr } = await sb.from('jobs').select('id').limit(1);
  if (tableErr && tableErr.code === '42P01') {
    console.log('\n  ⚠ jobs table missing. Run this SQL in Supabase dashboard > SQL Editor:\n');
    console.log(`
create table if not exists jobs (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'pending',
  listing_url text,
  property    jsonb,
  input_paths jsonb,
  output_urls jsonb,
  error       text,
  created_at  timestamptz default now()
);
    `);
  } else {
    console.log('  ✓ jobs table ready');
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Setup error:', e.message); process.exit(1); });
