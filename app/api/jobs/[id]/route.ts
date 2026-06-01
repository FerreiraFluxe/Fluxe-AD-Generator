import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const bom = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
const supabaseAdmin = createClient(
  bom(process.env.SUPABASE_URL || ''),
  bom(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: job, error } = await supabaseAdmin
    .from('jobs').select('*').eq('id', id).single();
  if (error || !job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(job);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Delete storage files from both buckets
  for (const bucket of ['inputs', 'outputs']) {
    const { data: files } = await supabaseAdmin.storage.from(bucket).list(id);
    if (files?.length) {
      await supabaseAdmin.storage.from(bucket).remove(files.map(f => `${id}/${f.name}`));
    }
  }

  await supabaseAdmin.from('jobs').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
