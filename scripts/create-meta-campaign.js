'use strict';

const META_API_VERSION = process.env.META_EDGE_MARKETING_API_VERSION || 'v23.0';
const BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const PORTFOLIO_TOKENS = [
  process.env.META_EDGE_PORTFOLIO_1_TOKEN,
  process.env.META_EDGE_PORTFOLIO_2_TOKEN,
].filter(Boolean);

async function metaGet(path, token) {
  const url = `${BASE}/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url);
  return res.json();
}

async function metaPost(path, token, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  return res.json();
}

// Try each portfolio token until one works for this ad account
async function resolveToken(adAccountId) {
  for (const token of PORTFOLIO_TOKENS) {
    const res = await metaGet(`act_${adAccountId}?fields=id,name`, token);
    if (res.id) return token;
  }
  throw new Error(`No portfolio token has access to ad account ${adAccountId}`);
}

// Get the first page associated with this ad account's business
async function getPageId(adAccountId, token) {
  try {
    const account = await metaGet(`act_${adAccountId}?fields=business`, token);
    const businessId = account.business?.id;
    if (!businessId) return null;
    const pages = await metaGet(`${businessId}/owned_pages?fields=id,name&limit=1`, token);
    return pages.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// Upload image to Meta via URL (returns hash)
async function uploadImageUrl(adAccountId, token, imageUrl, filename) {
  const data = await metaPost(`act_${adAccountId}/adimages`, token, {
    url: imageUrl,
    filename: filename,
  });
  if (data.error) throw new Error(`Image upload failed: ${JSON.stringify(data.error)}`);
  // Response: { images: { [filename]: { hash, url, ... } } }
  const images = data.images || {};
  const key = Object.keys(images)[0];
  return images[key]?.hash ?? null;
}

async function createCampaign(adAccountId, token, property) {
  const name = `${property.typology} ${property.location} - Fluxe ${new Date().toISOString().slice(0, 10)}`;
  const data = await metaPost(`act_${adAccountId}/campaigns`, token, {
    name,
    objective: 'OUTCOME_LEADS',
    special_ad_categories: ['HOUSING'],
    status: 'PAUSED',
  });
  if (data.error) throw new Error(`Campaign creation failed: ${JSON.stringify(data.error)}`);
  return data.id;
}

async function createAdSet(adAccountId, token, campaignId, pageId, destinationUrl) {
  const data = await metaPost(`act_${adAccountId}/adsets`, token, {
    name: 'Ad Set - Fluxe',
    campaign_id: campaignId,
    status: 'PAUSED',
    // HOUSING category requires no age/gender restrictions
    targeting: {
      geo_locations: { countries: ['PT'] },
    },
    optimization_goal: 'LEAD_GENERATION',
    billing_event: 'IMPRESSIONS',
    daily_budget: 500, // €5 placeholder — user adjusts before publishing
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    ...(pageId ? { promoted_object: { page_id: pageId } } : {}),
    ...(destinationUrl ? { destination_type: 'WEBSITE' } : {}),
  });
  if (data.error) throw new Error(`Ad set creation failed: ${JSON.stringify(data.error)}`);
  return data.id;
}

async function createAdCreative(adAccountId, token, pageId, imageHash, copyBody, copyTitle, destinationUrl) {
  const linkUrl = destinationUrl || 'https://fluxe.pt';
  const data = await metaPost(`act_${adAccountId}/adcreatives`, token, {
    name: `Creative - ${copyTitle || 'Fluxe Ad'}`,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        image_hash: imageHash,
        link: linkUrl,
        message: copyBody,
        name: copyTitle || '',
        call_to_action: { type: 'LEARN_MORE', value: { link: linkUrl } },
      },
    },
  });
  if (data.error) throw new Error(`Creative creation failed: ${JSON.stringify(data.error)}`);
  return data.id;
}

async function createAd(adAccountId, token, adSetId, creativeId, name) {
  const data = await metaPost(`act_${adAccountId}/ads`, token, {
    name: name || 'Fluxe Ad',
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  });
  if (data.error) throw new Error(`Ad creation failed: ${JSON.stringify(data.error)}`);
  return data.id;
}

/**
 * Creates the full campaign structure in Meta Ads Manager (all PAUSED).
 * Returns { campaignId, adSetId, adIds, pageId, portfolioUsed }
 */
async function createMetaCampaign({ adAccountId, property, copy, squareImageUrls, destinationUrl }) {
  if (!adAccountId) throw new Error('adAccountId is required');

  const token = await resolveToken(adAccountId);
  const pageId = await getPageId(adAccountId, token);

  // Upload all square images in parallel
  const imageHashes = await Promise.all(
    squareImageUrls.map((url, i) => uploadImageUrl(adAccountId, token, url, `ad-${String(i + 1).padStart(2, '0')}.png`))
  );

  const campaignId = await createCampaign(adAccountId, token, property);
  const adSetId = await createAdSet(adAccountId, token, campaignId, pageId, destinationUrl);

  const adIds = [];

  if (pageId) {
    // Create one creative + ad per image (up to 5)
    const titles = copy?.titles ?? [];
    for (let i = 0; i < imageHashes.length; i++) {
      const hash = imageHashes[i];
      if (!hash) continue;
      try {
        const title = titles[i] || titles[0] || `${property.typology} ${property.location}`;
        const creativeId = await createAdCreative(
          adAccountId, token, pageId, hash,
          copy?.body || '', title, destinationUrl
        );
        const adId = await createAd(adAccountId, token, adSetId, creativeId, `Ad ${i + 1} - ${title}`);
        adIds.push(adId);
      } catch (err) {
        console.error(`Ad ${i + 1} creation failed (skipping):`, err.message);
      }
    }
  }

  return {
    campaignId,
    adSetId,
    adIds,
    pageId,
    portfolioUsed: PORTFOLIO_TOKENS.indexOf(token) + 1,
  };
}

module.exports = { createMetaCampaign };
