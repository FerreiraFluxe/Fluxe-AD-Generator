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

async function resolveToken(adAccountId) {
  for (const token of PORTFOLIO_TOKENS) {
    const res = await metaGet(`act_${adAccountId}?fields=id,name`, token);
    if (res.id) return token;
  }
  throw new Error(`No portfolio token has access to ad account ${adAccountId}`);
}

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

// Upload image to Meta as base64 bytes (avoids URL permission issues)
async function uploadImageFile(adAccountId, token, filePath, filename) {
  const fs = require('fs');
  const bytes = fs.readFileSync(filePath).toString('base64');
  const data = await metaPost(`act_${adAccountId}/adimages`, token, {
    bytes,
    filename,
  });
  if (data.error) throw new Error(`Image upload failed: ${JSON.stringify(data.error)}`);
  const images = data.images || {};
  const key = Object.keys(images)[0];
  return images[key]?.hash ?? null;
}

// Search Meta's geo database for a city key (for radius targeting)
async function findCityKey(locationString, token) {
  const cityName = locationString.split(',')[0].trim();
  try {
    const res = await metaGet(
      `search?type=adgeolocation&q=${encodeURIComponent(cityName)}&country_code=PT&location_types=city&limit=5`,
      token
    );
    if (res.data && res.data.length > 0) {
      const exact = res.data.find(l => l.name.toLowerCase() === cityName.toLowerCase());
      return (exact || res.data[0]).key;
    }
  } catch {}
  return null;
}

// Creates the Meta Instant Lead Form using AI-generated copy
async function createLeadForm(pageId, token, copy, property, destinationUrl) {
  const city = property.location.split(',')[0].trim().toUpperCase();
  const formName = `Fluxe Form - ${property.typology} ${city}`;
  const formTitle = copy?.form_title || `${property.typology} em ${property.location}`;
  const formDesc = copy?.form_description || '';
  const bullets = formDesc.split('\n').map(l => l.trim()).filter(Boolean);

  const data = await metaPost(`${pageId}/leadgen_forms`, token, {
    name: formName,
    questions: [
      { type: 'FULL_NAME' },
      { type: 'EMAIL' },
      { type: 'PHONE' },
    ],
    context_card: {
      style: 'LIST_STYLE',
      title: formTitle,
      content: bullets.length > 0 ? bullets : [formTitle],
      button_text: 'Continuar',
    },
    privacy_policy: {
      url: 'https://fluxe.pt/privacidade',
      link_caption: 'Política de Privacidade',
    },
    thank_you_page: {
      title: 'Obrigado pelo teu interesse!',
      body: 'Entraremos em contacto brevemente para agendar a tua visita.',
      website_url: destinationUrl || 'https://fluxe.pt',
    },
    locale: 'pt_PT',
    block_display_for_non_targeted_viewer: false,
  });
  if (data.error) throw new Error(`Lead form creation failed: ${JSON.stringify(data.error)}`);
  return data.id;
}

// Campaign with CBO: budget lives here, not on the ad set
async function createCampaign(adAccountId, token, property) {
  const name = `${property.typology} ${property.location} - Fluxe ${new Date().toISOString().slice(0, 10)}`;
  const data = await metaPost(`act_${adAccountId}/campaigns`, token, {
    name,
    objective: 'OUTCOME_LEADS',
    special_ad_categories: ['HOUSING'],
    status: 'PAUSED',
    daily_budget: 500, // €5 placeholder — user adjusts before publishing
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
  });
  if (data.error) throw new Error(`Campaign creation failed: ${JSON.stringify(data.error)}`);
  return data.id;
}

// Ad set — no budget (CBO), city radius targeting, FB+IG placements
async function createAdSet(adAccountId, token, campaignId, pageId, cityKey) {
  const data = await metaPost(`act_${adAccountId}/adsets`, token, {
    name: 'Ad Set - Fluxe',
    campaign_id: campaignId,
    status: 'PAUSED',
    targeting: {
      geo_locations: cityKey
        ? { cities: [{ key: cityKey, radius: 17, distance_unit: 'kilometer' }] }
        : { countries: ['PT'] },
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'story'],
      instagram_positions: ['stream', 'story', 'reels'],
    },
    optimization_goal: 'LEAD_GENERATION',
    billing_event: 'IMPRESSIONS',
    destination_type: 'ON_AD',
    ...(pageId ? { promoted_object: { page_id: pageId } } : {}),
  });
  if (data.error) throw new Error(`Ad set creation failed: ${JSON.stringify(data.error)}`);
  return data.id;
}

async function createAdCreative(adAccountId, token, pageId, imageHash, copyBody, copyTitle, leadFormId) {
  const data = await metaPost(`act_${adAccountId}/adcreatives`, token, {
    name: `Creative - ${copyTitle || 'Fluxe Ad'}`,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        image_hash: imageHash,
        message: copyBody,
        name: copyTitle || '',
        description: copyBody,
        call_to_action: {
          type: 'LEARN_MORE',
          value: leadFormId ? { lead_gen_form_id: leadFormId } : {},
        },
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
 * Returns { campaignId, adSetId, adIds, pageId, leadFormId, portfolioUsed }
 */
async function createMetaCampaign({ adAccountId, property, copy, squareImagePaths }) {
  if (!adAccountId) throw new Error('adAccountId is required');

  const token = await resolveToken(adAccountId);
  const [pageId, cityKey] = await Promise.all([
    getPageId(adAccountId, token),
    findCityKey(property.location, token),
  ]);

  // Upload images as bytes — avoids token permission issues with URL fetching
  const imageHashes = await Promise.all(
    squareImagePaths.map((filePath, i) =>
      uploadImageFile(adAccountId, token, filePath, `ad-${String(i + 1).padStart(2, '0')}.png`)
    )
  );

  const campaignId = await createCampaign(adAccountId, token, property);
  const adSetId = await createAdSet(adAccountId, token, campaignId, pageId, cityKey);

  const adIds = [];
  let leadFormId = null;

  if (pageId) {
    // One form shared across all 5 ads
    try {
      leadFormId = await createLeadForm(pageId, token, copy, property, null);
    } catch (err) {
      console.error('Lead form creation failed (continuing without form):', err.message);
    }

    const titles = copy?.titles ?? [];
    for (let i = 0; i < imageHashes.length; i++) {
      const hash = imageHashes[i];
      if (!hash) continue;
      try {
        const title = titles[i] || titles[0] || `${property.typology} ${property.location}`;
        const creativeId = await createAdCreative(
          adAccountId, token, pageId, hash,
          copy?.body || '', title, leadFormId
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
    leadFormId,
    portfolioUsed: PORTFOLIO_TOKENS.indexOf(token) + 1,
  };
}

module.exports = { createMetaCampaign };
