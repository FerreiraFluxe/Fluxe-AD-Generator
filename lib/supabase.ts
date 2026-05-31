import { createClient } from '@supabase/supabase-js';

// Strip U+FEFF BOM — PowerShell pipes add it to env var values on Windows
const stripBom = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;

const url = stripBom(process.env.SUPABASE_URL || '');
const serviceKey = stripBom(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

export const supabaseAdmin = createClient(url, serviceKey);

export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface Job {
  id: string;
  status: JobStatus;
  listing_url: string | null;
  property: {
    typology: string;
    location: string;
    price: string;
    area: string;
    bedrooms: string;
    bathrooms: string;
  } | null;
  input_paths: string[] | null;
  output_urls: string[] | null;
  error: string | null;
  created_at: string;
}
