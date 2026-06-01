import { NextResponse } from 'next/server';

const bom = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;

export interface NotionClient {
  id: string;
  name: string;
  adAccountId: string | null;
}

export async function GET() {
  const apiKey = bom(process.env.NOTION_API_KEY || '');
  const dbId = bom(process.env.NOTION_CLIENTS_DATABASE_ID || '');

  if (!apiKey || !dbId) {
    return NextResponse.json({ error: 'NOTION_API_KEY ou NOTION_CLIENTS_DATABASE_ID em falta' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: 'Ativo?', status: { equals: 'Sim' } },
          ],
        },
        sorts: [{ property: 'Nome do Cliente', direction: 'ascending' }],
        page_size: 100,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Notion ${res.status}: ${err}` }, { status: 500 });
    }

    const data = await res.json() as { results: NotionPage[] };

    const clients: NotionClient[] = data.results.map((page) => {
      const name = page.properties['Nome do Cliente']?.title?.[0]?.plain_text ?? '';
      const adAccountId = page.properties['Ad Account ID']?.rich_text?.[0]?.plain_text ?? null;
      return { id: page.id, name, adAccountId };
    }).filter(c => c.name);

    return NextResponse.json(clients);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

interface NotionPage {
  id: string;
  properties: {
    'Nome do Cliente'?: { title: Array<{ plain_text: string }> };
    'Ad Account ID'?: { rich_text: Array<{ plain_text: string }> };
    'Ativo?'?: { status: { name: string } };
  };
}
