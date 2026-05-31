import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const bom = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
const supabaseAdmin = createClient(
  bom(process.env.SUPABASE_URL || ''),
  bom(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

async function triggerJob(jobId: string) {
  const apiKey = bom(process.env.TRIGGER_SECRET_KEY || '');
  const res = await fetch('https://api.trigger.dev/api/v1/tasks/generate-ads/trigger', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payload: { jobId } }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Trigger.dev ${res.status}: ${err}`);
  }
}

// Step 2: called after browser has uploaded all photos directly to Supabase
export async function POST(req: NextRequest) {
  try {
    const { jobId, inputPaths } = await req.json();

    if (!jobId || !inputPaths?.length) {
      return NextResponse.json({ error: 'jobId e inputPaths obrigatórios' }, { status: 400 });
    }

    await supabaseAdmin.from('jobs').update({ input_paths: inputPaths }).eq('id', jobId);
    await triggerJob(jobId);

    return NextResponse.json({ jobId });
  } catch (err: any) {
    console.error('POST /api/jobs error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
