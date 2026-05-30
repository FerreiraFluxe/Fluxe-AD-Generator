import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
