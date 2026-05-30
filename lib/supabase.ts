import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(url, anonKey);
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
