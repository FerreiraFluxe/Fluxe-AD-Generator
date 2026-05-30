'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const cheerio = require('cheerio');
const FirecrawlApp = require('@mendable/firecrawl-js').default;

const SELECTORS = {
  'remax.pt': {
    typology: ['[data-testid="listing-typology"]', '.listing-typology', 'h1', '.property-type'],
    location: ['[data-testid="listing-location"]', '.listing-location', '.location', '.address'],
    price: ['[data-testid="listing-price"]', '.listing-price', '.price', '[class*="price"]'],
    area: ['[data-testid="listing-area"]', '[class*="area"]', '[class*="m2"]', '.feature-area'],
    bedrooms: ['[data-testid="bedrooms"]', '[class*="bedroom"]', '[class*="quarto"]'],
    bathrooms: ['[data-testid="bathrooms"]', '[class*="bathroom"]', '[class*="wc"]', '[class*="casa-de-banho"]'],
    features: ['.amenities li', '.features li', '.characteristics li', '[class*="feature"] li'],
    description: ['.description', '[class*="description"]', '.property-description', 'p.text'],
  },
  'era.pt': {
    typology: ['.property-type', '.typology', 'h1', '[class*="tipolog"]'],
    location: ['.property-location', '.location', '.address', '[class*="local"]'],
    price: ['.property-price', '.price', '[class*="preco"]', '[class*="price"]'],
    area: ['[class*="area"]', '[class*="m2"]', '.property-area'],
    bedrooms: ['[class*="quarto"]', '[class*="bedroom"]', '[class*="t1"]', '[class*="t2"]'],
    bathrooms: ['[class*="wc"]', '[class*="casa-de-banho"]', '[class*="bathroom"]'],
    features: ['.amenities li', '.features li', '.details li'],
    description: ['.description', '.property-description'],
  },
  'idealista.pt': {
    typology: ['[class*="main-info__title"]', 'h1', '.typology'],
    location: ['[class*="main-info__title-minor"]', '.location', '[class*="location"]'],
    price: ['[class*="price-features__primary"]', '[class*="main-info__price"]', '.price'],
    area: ['[class*="feature-detail"]', '[data-testid="surface"]'],
    bedrooms: ['[class*="rooms"]', '[data-testid="rooms"]'],
    bathrooms: ['[class*="bathrooms"]', '[data-testid="bathrooms"]'],
    features: ['.details-property-feature-one li', '.details-property_features li', '[class*="details"] li'],
    description: ['[class*="comment"] p', '.description p'],
  },
  'imovirtual.com': {
    typology: ['[data-cy="ad.top-information.type"]', '[aria-label*="Tipo"]', 'h1', '[class*="css-1juqk9n"]'],
    location: ['[data-cy="ad.top-information.location"]', '[class*="css-ck3e0w"]', '.location'],
    price: ['[data-cy="ad.price"]', '[class*="css-8qi9av"]', '[class*="price"]'],
    area: ['[data-cy="ad.top-information.table"] li', '[aria-label*="m²"]'],
    bedrooms: ['[aria-label*="Quarto"]', '[data-testid*="room"]'],
    bathrooms: ['[aria-label*="Casa de banho"]', '[aria-label*="WC"]'],
    features: ['[data-cy="ad.features"] li', '.features li'],
    description: ['[data-cy="ad.description"] p', '.description p'],
  },
  'casasapo.pt': {
    typology: ['h1', '.property-title', '[class*="title"]'],
    location: ['.property-location', '[class*="location"]', '.address'],
    price: ['.property-price', '[class*="price"]', '[class*="preco"]'],
    area: ['[class*="area"]', '.property-area'],
    bedrooms: ['[class*="quarto"]', '[class*="bedroom"]'],
    bathrooms: ['[class*="wc"]', '[class*="bathroom"]'],
    features: ['.property-features li', '.amenities li'],
    description: ['.property-description', '.description'],
  },
  'supercasa.pt': {
    typology: ['h1', '[class*="title"]', '.property-type'],
    location: ['[class*="location"]', '.address', '.property-location'],
    price: ['[class*="price"]', '.property-price'],
    area: ['[class*="area"]', '.property-area'],
    bedrooms: ['[class*="quarto"]', '[class*="bedroom"]'],
    bathrooms: ['[class*="wc"]', '[class*="bathroom"]'],
    features: ['.property-features li', '.amenities li'],
    description: ['.description', '.property-description'],
  },
};

function detectPortal(url) {
  const hostname = new URL(url).hostname.replace('www.', '');
  for (const portal of Object.keys(SELECTORS)) {
    if (hostname.includes(portal)) return portal;
  }
  return null;
}

function trySelectors($, selectors) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text().trim();
      if (text) return text;
    }
  }
  return null;
}

function extractFeatures($, selectors) {
  for (const sel of selectors) {
    const items = [];
    $(sel).each((_, el) => {
      const t = $(el).text().trim();
      if (t) items.push(t);
    });
    if (items.length) return items.slice(0, 10);
  }
  return [];
}

function cleanPrice(raw) {
  if (!raw) return null;
  return raw.replace(/[^\d.,€]/g, '').trim() || raw.trim();
}

function cleanArea(raw) {
  if (!raw) return null;
  const match = raw.match(/(\d[\d.,]*)\s*m/i);
  return match ? match[1] + ' m²' : raw.trim();
}

// --- Firecrawl parser ---
// Extracts property data from clean markdown returned by Firecrawl

function parseMarkdown(markdown, metadata) {
  const result = { typology: null, location: null, price: null, area: null, bedrooms: null, bathrooms: null, features: [], description: null };
  const text = markdown || '';

  // Price: 244.000€ / 244 000 € / 244,000€
  const priceMatch = text.match(/\b(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?)\s*€/);
  if (priceMatch) result.price = priceMatch[1].replace(/\s/g, '.') + '€';

  // Area: 73 m² / 73m2 / 73 m2
  const areaMatch = text.match(/\b(\d+)\s*m[²2]/i);
  if (areaMatch) result.area = areaMatch[1] + ' m²';

  // Typology: T1/T2/T3/T4/T5
  const typoMatch = text.match(/\b(T[0-9](?:\+\d)?)\b/i);
  if (typoMatch) result.typology = typoMatch[1].toUpperCase();

  // Bedrooms from explicit text
  const bedroomMatch = text.match(/(\d+)\s*[Qq]uartos?/);
  if (bedroomMatch) result.bedrooms = bedroomMatch[1];
  else if (result.typology) {
    const n = parseInt(result.typology.replace(/\D/g, ''), 10);
    if (!isNaN(n)) result.bedrooms = String(n);
  }

  // Bathrooms: 1 WC / 2 casas de banho
  const bathMatch = text.match(/(\d+)\s*(?:WC|wc|[Cc]asa[s]?\s+de\s+[Bb]anho)/);
  if (bathMatch) result.bathrooms = bathMatch[1];

  // Location from metadata title / og:title, strip price/typology noise
  const titleRaw = (metadata && (metadata['og:title'] || metadata.title)) || '';
  if (titleRaw) {
    // Try to extract location: strip price/typology patterns, grab location-like segment
    const locMatch = titleRaw.match(/(?:em|in)\s+([^,|–\-]+)/i) ||
                     titleRaw.match(/[-–,]\s*([A-ZÁÉÍÓÚÃÕÂÊÔÇÀ][^,|–\-]{3,})/);
    result.location = locMatch ? locMatch[1].trim() : titleRaw.split(/[-–,|]/)[0].trim();
  }

  // Description: first substantial paragraph (>60 chars)
  const paragraphs = text.split(/\n+/).filter(l => l.length > 60 && !l.startsWith('#'));
  if (paragraphs.length) result.description = paragraphs[0].trim();

  // Features: lines starting with bullet markers
  const bullets = text.match(/^[\-\*•]\s+.+/gm) || [];
  result.features = bullets.slice(0, 10).map(b => b.replace(/^[\-\*•]\s+/, '').trim());

  return result;
}

async function scrapeWithFirecrawl(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  try {
    const app = new FirecrawlApp({ apiKey });
    const res = await app.v1.scrapeUrl(url, { formats: ['markdown'] });
    if (!res || !res.markdown) return null;
    const parsed = parseMarkdown(res.markdown, res.metadata || {});
    console.log('[Firecrawl] scrape succeeded');
    return parsed;
  } catch (e) {
    console.error('[Firecrawl] error:', e.message);
    return null;
  }
}

async function scrapeWithCheerio(url) {
  const result = { typology: null, location: null, price: null, area: null, bedrooms: null, bathrooms: null, features: [], description: null };

  let html;
  try {
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    html = resp.data;
  } catch (e) {
    console.error('[Cheerio] fetch error:', e.message);
    return result;
  }

  const $ = cheerio.load(html);
  const portal = detectPortal(url);
  const sels = portal ? SELECTORS[portal] : Object.values(SELECTORS)[0];

  result.typology = trySelectors($, sels.typology);
  result.location = trySelectors($, sels.location);
  result.price = cleanPrice(trySelectors($, sels.price));
  result.area = cleanArea(trySelectors($, sels.area));
  result.bedrooms = trySelectors($, sels.bedrooms);
  result.bathrooms = trySelectors($, sels.bathrooms);
  result.features = extractFeatures($, sels.features);
  result.description = trySelectors($, sels.description);

  if (!result.price) {
    const metaPrice = $('meta[property="product:price:amount"]').attr('content') || $('meta[itemprop="price"]').attr('content');
    if (metaPrice) result.price = metaPrice;
  }
  if (!result.location) {
    result.location = $('meta[property="og:title"]').attr('content') || null;
  }

  return result;
}

// Merge two result objects: prefer non-null values from primary, fill gaps from secondary
function mergeResults(primary, secondary) {
  const merged = { ...secondary };
  for (const key of Object.keys(primary)) {
    if (key === 'features') {
      merged.features = primary.features.length ? primary.features : secondary.features;
    } else if (primary[key] !== null && primary[key] !== undefined) {
      merged[key] = primary[key];
    }
  }
  return merged;
}

async function scrapeListing(url) {
  // Try Firecrawl first (handles JS-rendered pages, bot protection, clean output)
  const firecrawlResult = await scrapeWithFirecrawl(url);

  // Always also run cheerio for structured field extraction as complement
  const cheerioResult = await scrapeWithCheerio(url);

  if (firecrawlResult) {
    // Firecrawl is primary; cheerio fills any gaps Firecrawl missed
    return mergeResults(firecrawlResult, cheerioResult);
  }

  console.log('[Scraper] Firecrawl unavailable, using cheerio only');
  return cheerioResult;
}

if (require.main === module) {
  const url = process.argv[2];
  if (!url) { console.error('Usage: node scrape-listing.js <URL>'); process.exit(1); }
  scrapeListing(url).then(data => console.log(JSON.stringify(data, null, 2)));
}

module.exports = { scrapeListing };
