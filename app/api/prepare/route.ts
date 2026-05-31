import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
      return NextResponse.json({ error: 'Erro ao criar job' }, { status: 500 });
    }

    // Generate signed upload URLs — browser uploads directly to Supabase Storage
    const uploads: { path: string; signedUrl: string; token: string }[] = [];
    for (let i = 0; i < fileNames.length; i++) {
      const ext = (fileNames[i] as string).split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `${job.id}/${i.toString().padStart(3, '0')}.${ext}`;
      const { data, error } = await supabaseAdmin.storage
        .from('inputs')
        .createSignedUploadUrl(storagePath);
      if (!error && data) {
        uploads.push({ path: storagePath, signedUrl: data.signedUrl, token: data.token });
      }
    }

    return NextResponse.json({ jobId: job.id, uploads });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
