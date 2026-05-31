import { task } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function classifyPhotos(photoPaths: string[]): Promise<{
  exterior: string;
  ext2?: string;
  int1: string;
  int2: string;
  rest: string[];
}> {
  const sharp = require('sharp');
  const scored: Array<{ path: string; score: number }> = [];

  for (const p of photoPaths) {
    try {
      const meta = await sharp(p).metadata();
      const ratio = (meta.width || 1) / (meta.height || 1);
      // Wide landscape photos more likely exterior; portrait/square more likely interior
      const { data } = await sharp(p).resize(50, 50).raw().toBuffer({ resolveWithObject: true });
      let brightness = 0;
      for (let i = 0; i < data.length; i += 3) brightness += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      brightness /= (data.length / 3);
      // Higher score = more exterior-like (bright + wide)
      scored.push({ path: p, score: ratio * 0.6 + (brightness / 255) * 0.4 });
    } catch {
      scored.push({ path: p, score: 0 });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const [ext, int1, int2, ext2candidate, ...rest] = scored.map(s => s.path);

  return {
    exterior: ext || photoPaths[0],
    ext2: ext2candidate,
    int1: int1 || photoPaths[1] || photoPaths[0],
    int2: int2 || photoPaths[2] || photoPaths[0],
    rest: rest || [],
  };
}

export const generateAdsTask = task({
  id: 'generate-ads',
  maxDuration: 300,
  machine: { preset: 'large-1x' },
  run: async (payload: { jobId: string }) => {
    const { jobId } = payload;

    // Mark processing
    await supabaseAdmin.from('jobs').update({ status: 'processing' }).eq('id', jobId);

    // Load job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs').select('*').eq('id', jobId).single();
    if (jobErr || !job) throw new Error('Job not found: ' + jobId);

    const tmpDir = path.join(os.tmpdir(), jobId);
    const outDir = path.join(tmpDir, 'outputs');
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    try {
      // Download input photos from Supabase Storage
      const photoPaths: string[] = [];
      for (const storagePath of (job.input_paths as string[])) {
        const { data: signedUrl } = await supabaseAdmin.storage
          .from('inputs').createSignedUrl(storagePath, 300);
        if (!signedUrl?.signedUrl) continue;
        const localPath = path.join(tmpDir, path.basename(storagePath));
        await downloadFile(signedUrl.signedUrl, localPath);
        photoPaths.push(localPath);
      }

      // Scrape listing if URL provided
      let property = job.property;
      if (!property && job.listing_url) {
        const { scrapeListing } = require('../scripts/scrape-listing');
        const scraped = await scrapeListing(job.listing_url);
        property = {
          typology: scraped.typology || 'Apartamento',
          location: scraped.location || '',
          price: scraped.price || '',
          area: scraped.area || '',
          bedrooms: scraped.bedrooms || '',
          bathrooms: scraped.bathrooms || '',
        };
        await supabaseAdmin.from('jobs').update({ property }).eq('id', jobId);
      }

      if (!property) throw new Error('No property data available');

      // Classify photos
      const classified = await classifyPhotos(photoPaths);

      // Build 5 job configs: mix single-top and dual-top
      const data = {
        typology: property.typology,
        location: property.location,
        price: property.price,
        area: property.area,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
      };

      const { generateAd } = require('../scripts/generate-ad');

      const jobs = [
        // 1 single-top: exterior hero
        { photos: { exterior: classified.exterior, int1: classified.int1, int2: classified.int2 }, outputName: 'ad-01' },
        // 2 dual-top: exterior + ext2
        { photos: { exterior: classified.exterior, ext2: classified.ext2 || classified.int1, int1: classified.int1, int2: classified.int2 }, outputName: 'ad-02' },
        // 3 single-top: int1 as hero
        { photos: { exterior: classified.int1, int1: classified.int2, int2: classified.ext2 || classified.exterior }, outputName: 'ad-03' },
        // 4 dual-top: int1 + int2
        { photos: { exterior: classified.int1, ext2: classified.int2, int1: classified.exterior, int2: classified.ext2 || classified.int1 }, outputName: 'ad-04' },
        // 5 single-top: ext2 or int2 hero
        { photos: { exterior: classified.ext2 || classified.int2, int1: classified.int1, int2: classified.exterior }, outputName: 'ad-05' },
      ];

      // Generate ads sequentially — parallel crashes (5 Chrome × 300MB = OOM)
      const generatedPaths: string[] = [];
      for (const adJob of jobs) {
        const r = await generateAd({ ...adJob, data, amiNumber: null, outDir });
        generatedPaths.push(r.square, r.story);
      }

      // Upload all outputs in parallel
      const outputUrls = (await Promise.all(
        generatedPaths.map(async (filePath: string) => {
          const fileName = path.basename(filePath);
          const storagePath = `${jobId}/${fileName}`;
          const fileBuffer = fs.readFileSync(filePath);
          await supabaseAdmin.storage.from('outputs').upload(storagePath, fileBuffer, {
            contentType: 'image/png',
            upsert: true,
          });
          const { data: signed } = await supabaseAdmin.storage
            .from('outputs').createSignedUrl(storagePath, 7 * 24 * 60 * 60);
          return signed?.signedUrl ?? null;
        })
      )).filter(Boolean) as string[];

      await supabaseAdmin.from('jobs').update({ status: 'done', output_urls: outputUrls }).eq('id', jobId);

    } catch (err: any) {
      await supabaseAdmin.from('jobs').update({ status: 'error', error: err.message }).eq('id', jobId);
      throw err;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
});
