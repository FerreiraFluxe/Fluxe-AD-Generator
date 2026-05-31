import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const bom = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
const supabaseAdmin = createClient(
  bom(process.env.SUPABASE_URL || ''),
  bom(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
);

// Step 1: Create job + return signed upload URLs so the browser uploads directly to Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileNames, listingUrl, typology, location, price, area, bedrooms, bathrooms } = body;

    if (!fileNames?.length) {
      return NextResponse.json({ error: 'Sem ficheiros' }, { status: 400 });
    }

    const { data: job, error: insertErr } = await supabaseAdmin
      .from('jobs')
      .insert({
        status: 'pending',
        listing_url: listingUrl || null,
        property: (typology && location && price) ? { typology, location, price, area, bedrooms, bathrooms } : null,
      })
      .select('id')
      .single();

    if (insertErr || !job) {
      console.error('Insert error:', insertErr);
      return NextResponse.json({ error: insertErr?.message || 'Erro ao criar job' }, { status: 500 });
    }

    // Generate all signed upload URLs in parallel (was sequential = timeout with many photos)
    const uploads = (await Promise.all(
      (fileNames as string[]).map(async (name, i) => {
        const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
        const storagePath = `${job.id}/${i.toString().padStart(3, '0')}.${ext}`;
        const { data, error } = await supabaseAdmin.storage
          .from('inputs')
          .createSignedUploadUrl(storagePath, { upsert: true });
        if (error || !data) { console.error('SignedURL error:', error); return null; }
        return { path: storagePath, signedUrl: data.signedUrl, token: data.token };
      })
    )).filter(Boolean);

    return NextResponse.json({ jobId: job.id, uploads });
  } catch (err: any) {
    console.error('prepare error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
