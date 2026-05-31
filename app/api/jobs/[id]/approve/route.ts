import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const bom = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
const supabaseAdmin = createClient(
  bom(process.env.SUPABASE_URL || ''),
  bom(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as { adIndex?: number; copyApproved?: boolean };

  const { data: job } = await supabaseAdmin.from('jobs').select('approvals').eq('id', id).single();
  const approvals = (job?.approvals as Record<string, unknown>) ?? {};

  if (body.adIndex !== undefined) {
    const key = `ad_${body.adIndex}`;
    approvals[key] = approvals[key] === 'approved' ? 'rejected' : 'approved';
  }
  if (body.copyApproved !== undefined) {
    approvals['copy'] = body.copyApproved ? 'approved' : 'rejected';
  }

  const { error } = await supabaseAdmin.from('jobs').update({ approvals }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ approvals });
}
