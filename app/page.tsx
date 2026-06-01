'use client';
import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

interface Client {
  id: string;
  name: string;
  adAccountId: string | null;
}

export default function Home() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [listingUrl, setListingUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ typology: '', location: '', price: '', area: '', bedrooms: '', bathrooms: '' });
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then((data: Client[]) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(f => f.type.startsWith('image/'));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function clean(s: string) {
    return Array.from(s).filter(c => c.charCodeAt(0) !== 0xFEFF).join('').trim();
  }

  function xhrPut(url: string, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.onload = () => xhr.status < 400 ? resolve() : reject(new Error(`Upload ${xhr.status}: ${file.name}`));
      xhr.onerror = () => reject(new Error(`Upload network error: ${file.name}`));
      xhr.send(file);
    });
  }

  async function submit() {
    if (!files.length) { setError('Adiciona pelo menos uma foto.'); return; }
    if (!listingUrl && !manual.typology) { setError('Adiciona o link do anúncio ou preenche os dados manualmente.'); return; }
    setLoading(true); setError(''); setUploadProgress(0);
    try {
      setError('A preparar...');
      const prepRes = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileNames: files.map(f => f.name),
          listingUrl: listingUrl ? clean(listingUrl) : undefined,
          clientId: selectedClientId || undefined,
          clientName: selectedClient?.name || undefined,
          adAccountId: selectedClient?.adAccountId || undefined,
          destinationUrl: destinationUrl ? clean(destinationUrl) : undefined,
          ...(showManual ? manual : {}),
        }),
      });
      const prep = await prepRes.json();
      if (!prepRes.ok) throw new Error('Prepare: ' + (prep.error || prepRes.status));

      setError('A enviar fotos...');
      await Promise.all(prep.uploads.map(async (u: { signedUrl: string }, i: number) => {
        await xhrPut(clean(u.signedUrl), files[i]);
        setUploadProgress(p => p + 1);
      }));

      setError('A iniciar geração...');
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: prep.jobId, inputPaths: prep.uploads.map((u: { path: string }) => u.path) }),
      });
      const job = await jobRes.json();
      if (!jobRes.ok) throw new Error('Jobs: ' + (job.error || jobRes.status));

      setError('');
      router.push(`/job/${job.jobId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Fluxe Ad Generator</h1>
          <p className="text-gray-500 mt-1 text-sm">Gera 5 anúncios Meta prontos a publicar</p>
        </div>

        {/* Client selector */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Cliente <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 bg-white">
            <option value="">— Seleccionar cliente —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.adAccountId ? '' : ' (sem Meta)'}
              </option>
            ))}
          </select>
          {selectedClient?.adAccountId && (
            <p className="text-xs text-green-600 mt-1">Ad Account: {selectedClient.adAccountId} · campanha criada automaticamente</p>
          )}
        </div>

        {/* Destination URL — shown when client with ad account is selected */}
        {selectedClient?.adAccountId && (
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Landing page <span className="font-normal text-gray-400">(URL de destino dos anúncios)</span>
            </label>
            <input
              type="url"
              value={destinationUrl}
              onChange={e => setDestinationUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400"
            />
          </div>
        )}

        {/* Photo drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white hover:border-red-400'}`}
        >
          <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)} />
          {files.length === 0 ? (
            <>
              <div className="text-4xl mb-3">🖼️</div>
              <p className="font-semibold text-gray-700">Arrasta as fotos aqui</p>
              <p className="text-xs text-gray-400 mt-1">ou clica para seleccionar · JPG/PNG</p>
            </>
          ) : (
            <>
              <div className="text-2xl mb-1">✅</div>
              <p className="font-semibold text-gray-700">{files.length} foto{files.length !== 1 ? 's' : ''} seleccionada{files.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-gray-400 mt-1 truncate">{files.map(f => f.name).join(', ')}</p>
              <button type="button" onClick={e => { e.stopPropagation(); setFiles([]); }}
                className="mt-3 text-xs text-red-500 underline">Limpar</button>
            </>
          )}
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {files.slice(0, 5).map((f, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" loading="lazy" />
                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-0 right-0 bg-black/60 text-white text-xs w-5 h-5 flex items-center justify-center rounded-bl-lg">×</button>
              </div>
            ))}
            {files.length > 5 && (
              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                +{files.length - 5}
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Link do anúncio <span className="font-normal text-gray-400">(Idealista, Century21, etc.)</span>
          </label>
          <input type="url" value={listingUrl} onChange={e => setListingUrl(e.target.value)}
            placeholder="https://www.idealista.pt/imovel/..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
        </div>

        <button type="button" onClick={() => setShowManual(v => !v)}
          className="mt-3 text-xs text-gray-500 underline">
          {showManual ? '▲ Esconder dados manuais' : '▼ Preencher dados manualmente (sem link)'}
        </button>

        {showManual && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {([
              { key: 'typology', label: 'Tipologia', placeholder: 'Apartamento T3' },
              { key: 'location', label: 'Localização', placeholder: 'Cova da Piedade, Almada' },
              { key: 'price', label: 'Preço', placeholder: '298.000€' },
              { key: 'area', label: 'Área', placeholder: '91m²' },
              { key: 'bedrooms', label: 'Quartos', placeholder: '3' },
              { key: 'bathrooms', label: 'WC', placeholder: '1' },
            ] as const).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                <input type="text" value={manual[key]}
                  onChange={e => setManual(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600 font-medium">{error}</p>}

        <button onClick={submit} disabled={loading}
          className="mt-6 w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-base transition-colors">
          {loading
            ? uploadProgress < files.length && files.length > 0
              ? `A enviar fotos... ${uploadProgress}/${files.length}`
              : 'A iniciar geração...'
            : selectedClient?.adAccountId
              ? `Gerar 5 Anúncios + Criar Campanha Meta →`
              : 'Gerar 5 Anúncios →'}
        </button>

        {loading && files.length > 0 && uploadProgress < files.length && (
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-300 rounded-full"
              style={{ width: `${(uploadProgress / files.length) * 100}%` }}
            />
          </div>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Leva cerca de 60–90s · 5 square + 5 story = 10 ficheiros PNG
          {selectedClient?.adAccountId ? ' · campanha Meta criada automaticamente' : ''}
        </p>
      </div>
    </main>
  );
}
