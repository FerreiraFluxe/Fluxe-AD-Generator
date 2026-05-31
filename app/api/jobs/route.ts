import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tasks } from '@trigger.dev/sdk/v3';
import type { generateAdsTask } from '../../../trigger/generateAds';

const bom = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
const supabaseAdmin = createClient(
  bom(process.env.SUPABASE_URL || ''),
  bom(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

// Step 2: called after browser has uploaded all photos directly to Supabase
export async function POST(req: NextRequest) {
  try {
    const { jobId, inputPaths } = await req.json();

    if (!jobId || !inputPaths?.length) {
      return NextResponse.json({ error: 'jobId e inputPaths obrigatórios' }, { status: 400 });
    }

    await supabaseAdmin.from('jobs').update({ input_paths: inputPaths }).eq('id', jobId);
    await tasks.trigger<typeof generateAdsTask>('generate-ads', { jobId });

    return NextResponse.json({ jobId });
  } catch (err: any) {
    console.error('POST /api/jobs error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
