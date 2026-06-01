'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface CopyBlock {
  body: string;
  titles: string[];
  form_title: string;
  form_description: string;
  email_subject: string;
  email_body: string;
}

interface MetaResult {
  campaignId?: string;
  adSetId?: string;
  adIds?: string[];
  pageId?: string;
  leadFormId?: string;
  portfolioUsed?: number;
  error?: string;
}

interface Job {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  property: { typology: string; location: string; price: string } | null;
  output_urls: string[] | null;
  error: string | null;
  copy: CopyBlock | null;
  approvals: Record<string, string> | null;
  meta_result: MetaResult | null;
  client_name: string | null;
  ad_account_id: string | null;
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

function CopySection({ copy, approvals, jobId, onApprovalsChange }: {
  copy: CopyBlock;
  approvals: Record<string, string>;
  jobId: string;
  onApprovalsChange: (a: Record<string, string>) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleCopyApproval = async () => {
    const current = approvals['copy'];
    const copyApproved = current !== 'approved';
    const res = await fetch(`/api/jobs/${jobId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copyApproved }),
    });
    const data = await res.json() as { approvals: Record<string, string> };
    onApprovalsChange(data.approvals);
  };

  const isApproved = approvals['copy'] === 'approved';

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">Copy META</h2>
        <button
          onClick={toggleCopyApproval}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            isApproved
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {isApproved ? '✓ Aprovado' : 'Aprovar copy'}
        </button>
      </div>

      {/* Body */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Anúncio</span>
          <button onClick={() => copyToClipboard(copy.body, 'body')}
            className="text-xs text-blue-500 hover:text-blue-700">
            {copied === 'body' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans border border-gray-100">
          {copy.body}
        </pre>
      </div>

      {/* Titles */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Títulos A/B (5)</span>
          <button onClick={() => copyToClipboard(copy.titles.join('\n'), 'titles')}
            className="text-xs text-blue-500 hover:text-blue-700">
            {copied === 'titles' ? '✓ Copiado' : 'Copiar todos'}
          </button>
        </div>
        <div className="space-y-1.5">
          {copy.titles.map((t, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm border border-gray-100">
              <span className="text-gray-800 flex-1">{t}</span>
              <button onClick={() => copyToClipboard(t, `title${i}`)}
                className="text-xs text-blue-400 hover:text-blue-600 shrink-0">
                {copied === `title${i}` ? '✓' : 'Copiar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Formulário META</span>
          <button onClick={() => copyToClipboard(`${copy.form_title}\n${copy.form_description}`, 'form')}
            className="text-xs text-blue-500 hover:text-blue-700">
            {copied === 'form' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans border border-gray-100">
          {copy.form_title}{'\n'}{copy.form_description}
        </pre>
      </div>

      {/* Email */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email GHL</span>
          <button onClick={() => copyToClipboard(`Assunto: ${copy.email_subject}\n\n${copy.email_body}`, 'email')}
            className="text-xs text-blue-500 hover:text-blue-700">
            {copied === 'email' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 border border-gray-100">
          <p className="font-semibold mb-2">Assunto: {copy.email_subject}</p>
          <pre className="whitespace-pre-wrap font-sans">{copy.email_body}</pre>
        </div>
      </div>
    </div>
  );
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [approvals, setApprovals] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    async function poll() {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const data: Job = await res.json();
      setJob(data);
      setApprovals(data.approvals ?? {});
      if (data.status === 'done' || data.status === 'error') clearInterval(interval);
    }
    poll();
    interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [id]);

  const toggleAdApproval = useCallback(async (adIndex: number) => {
    const res = await fetch(`/api/jobs/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adIndex }),
    });
    const data = await res.json() as { approvals: Record<string, string> };
    setApprovals(data.approvals);
  }, [id]);

  const deleteSession = useCallback(async () => {
    if (!confirm('Apagar todas as imagens e dados desta sessão?')) return;
    setDeleting(true);
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
    router.push('/');
  }, [id, router]);

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
            <div className="flex gap-3 mb-6 flex-wrap">
              <button
                onClick={async () => { setDownloading(true); await downloadAllAsZip(job.output_urls!, id); setDownloading(false); }}
                disabled={downloading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
                {downloading ? 'A criar ZIP...' : '⬇ Descarregar ZIP (10 ficheiros)'}
              </button>
              <button
                onClick={deleteSession}
                disabled={deleting}
                className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 font-semibold px-4 py-3 rounded-xl text-sm transition-colors">
                {deleting ? 'A apagar...' : '🗑 Apagar sessão'}
              </button>
            </div>

            {/* Meta campaign result */}
            {job.meta_result && (
              <div className={`rounded-2xl p-4 mb-6 text-sm ${job.meta_result.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                {job.meta_result.error ? (
                  <p className="text-red-700 font-medium">Meta: {job.meta_result.error}</p>
                ) : (
                  <div className="flex flex-wrap gap-4 items-center">
                    <span className="text-green-700 font-semibold">✓ Campanha criada (PAUSED) · Portfolio {job.meta_result.portfolioUsed}</span>
                    <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${job.ad_account_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-blue-700">
                      Abrir no Ads Manager →
                    </a>
                    <span className="text-green-600 text-xs">{job.meta_result.adIds?.length ?? 0} ads · {job.meta_result.leadFormId ? '1 formulário criado' : 'sem formulário'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Copy block */}
            {job.copy && (
              <CopySection
                copy={job.copy}
                approvals={approvals}
                jobId={id}
                onApprovalsChange={setApprovals}
              />
            )}

            {/* Square ads */}
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Square (1080×1080)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              {squareUrls.map((url, i) => {
                const key = `ad_${i}`;
                const status = approvals[key];
                return (
                  <div key={i} className="flex flex-col rounded-xl overflow-hidden shadow-sm">
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="block hover:opacity-95 transition-opacity">
                      <img src={url} alt={`Ad ${i + 1}`} className="w-full aspect-square object-cover" />
                    </a>
                    <div className="bg-white px-2 py-1.5 flex items-center justify-between">
                      <span className="text-xs text-gray-400">ad-{String(i+1).padStart(2,'0')}.png</span>
                      <button
                        onClick={() => toggleAdApproval(i)}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold transition-colors ${
                          status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : status === 'rejected'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {status === 'approved' ? '✓' : status === 'rejected' ? '✗' : '·'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Story ads */}
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
