import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tasks } from '@trigger.dev/sdk/v3';
import type { generateAdsTask } from '../../../trigger/generateAds';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll('photos') as File[];
    const listingUrl = form.get('listing_url') as string | null;
    const typology = form.get('typology') as string | null;
    const location = form.get('location') as string | null;
    const price = form.get('price') as string | null;
    const area = form.get('area') as string | null;
    const bedrooms = form.get('bedrooms') as string | null;
    const bathrooms = form.get('bathrooms') as string | null;

    if (!files.length) {
      return NextResponse.json({ error: 'Nenhuma foto enviada' }, { status: 400 });
    }

    // Create job row first to get the ID
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

    // Upload photos to Supabase Storage
    const inputPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `${job.id}/${i.toString().padStart(3, '0')}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('inputs')
        .upload(storagePath, buffer, { contentType: file.type || 'image/jpeg', upsert: true });
      if (!uploadErr) inputPaths.push(storagePath);
    }

    // Save input paths
    await supabaseAdmin.from('jobs').update({ input_paths: inputPaths }).eq('id', job.id);

    // Trigger the background job
    await tasks.trigger<typeof generateAdsTask>('generate-ads', { jobId: job.id });

    return NextResponse.json({ jobId: job.id });
  } catch (err: any) {
    console.error('POST /api/jobs error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
