-- Run this in Supabase SQL editor

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

-- Storage buckets (run manually in Supabase dashboard or via API)
-- inputs: private, 24h TTL
-- outputs: private, 7-day signed URLs
