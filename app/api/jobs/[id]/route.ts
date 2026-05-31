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
