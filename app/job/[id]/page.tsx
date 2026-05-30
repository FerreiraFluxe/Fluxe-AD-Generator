'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Job {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  property: { typology: string; location: string; price: string } | null;
  output_urls: string[] | null;
  error: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'A preparar...',
  processing: 'A gerar anúncios...',
  done: 'Pronto!',
  error: 'Erro',
};

async function downloadAllAsZip(urls: string[], jobId: string) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  await Promise.all(urls.map(async (url, i) => {
    const isStory = url.includes('-story');
    const num = Math.floor(i / 2) + 1;
    const name = isStory ? `ad-${String(num).padStart(2,'0')}-story.png` : `ad-${String(num).padStart(2,'0')}.png`;
    const res = await fetch(url);
    const blob = await res.blob();
    zip.file(name, blob);
  }));
  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `fluxe-ads-${jobId.slice(0, 8)}.zip`;
  a.click();
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    async function poll() {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const data: Job = await res.json();
      setJob(data);
      if (data.status === 'done' || data.status === 'error') clearInterval(interval);
    }
    poll();
    interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [id]);

  const squareUrls = job?.output_urls?.filter(u => !u.includes('-story')) ?? [];
  const storyUrls = job?.output_urls?.filter(u => u.includes('-story')) ?? [];

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-3xl">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-6 inline-block">← Novo anúncio</Link>

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3">
            {job?.status === 'done' ? (
              <span className="text-2xl">🎉</span>
            ) : job?.status === 'error' ? (
              <span className="text-2xl">❌</span>
            ) : (
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            )}
            <div>
              <p className="font-bold text-gray-900 text-lg">
                {job ? STATUS_LABELS[job.status] : 'A carregar...'}
              </p>
              {job?.property && (
                <p className="text-sm text-gray-500">
                  {job.property.typology} · {job.property.location} · {job.property.price}
                </p>
              )}
              {job?.status === 'error' && job.error && (
                <p className="text-sm text-red-600 mt-1">{job.error}</p>
              )}
            </div>
          </div>

          {job?.status === 'processing' && (
            <div className="mt-4">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}
        </div>

        {job?.status === 'done' && job.output_urls && (
          <>
            <div className="flex gap-3 mb-6">
              <button
                onClick={async () => { setDownloading(true); await downloadAllAsZip(job.output_urls!, id); setDownloading(false); }}
                disabled={downloading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
                {downloading ? 'A criar ZIP...' : '⬇ Descarregar ZIP (10 ficheiros)'}
              </button>
            </div>

            <h2 className="text-sm font-semibold text-gray-600 mb-3">Square (1080×1080)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              {squareUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <img src={url} alt={`Ad ${i + 1}`} className="w-full aspect-square object-cover" />
                  <div className="text-xs text-center py-1 text-gray-400 bg-white">ad-{String(i+1).padStart(2,'0')}.png</div>
                </a>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-gray-600 mb-3">Story (1080×1920)</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {storyUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <img src={url} alt={`Story ${i + 1}`} className="w-full aspect-[9/16] object-cover" />
                  <div className="text-xs text-center py-1 text-gray-400 bg-white">story-{i+1}.png</div>
                </a>
              ))}
            </div>
          </>
        )}

        {job?.status === 'error' && (
          <Link href="/" className="inline-block bg-gray-900 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-gray-700">
            Tentar de novo →
          </Link>
        )}
      </div>
    </main>
  );
}
