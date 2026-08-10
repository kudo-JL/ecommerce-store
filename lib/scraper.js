/**
 * Product URL scraper.
 *
 * Strategy (in order):
 *  1. JSON-LD  <script type="application/ld+json">  (schema.org/Product)
 *  2. Open Graph + Twitter card meta tags
 *  3. Microdata (itemprop="name|description|image|price")
 *  4. Heuristic CSS selectors (Amazon / AliExpress / generic)
 *
 * Returns: { ok, source_url, source_domain, name, description, image, price, currency, gallery, raw }
 *          { ok: false, error } on failure.
 */
const cheerio = require('cheerio');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

function safeUrl(maybeUrl, base) {
  if (!maybeUrl) return '';
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return '';
  }
}

function extractHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function asNumber(x) {
  if (x == null) return null;
  if (typeof x === 'number') return x;
  const s = String(x).replace(/[^\d.,-]/g, '').replace(/,(\d{2})$/, '.$1').replace(/,(?=\d{3}\b)/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function findJsonLdProduct(obj) {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    for (const o of obj) {
      const r = findJsonLdProduct(o);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj !== 'object') return null;

  // Some sites put the Product under @graph
  if (Array.isArray(obj['@graph'])) {
    for (const o of obj['@graph']) {
      const r = findJsonLdProduct(o);
      if (r) return r;
    }
  }

  const t = obj['@type'];
  const isProduct =
    t === 'Product' ||
    (Array.isArray(t) && t.includes('Product')) ||
    (typeof t === 'string' && t.toLowerCase().includes('product'));

  if (isProduct) return obj;
  return null;
}

function pickOffer(product) {
  const offers = product.offers;
  if (!offers) return null;
  if (Array.isArray(offers)) return offers[0] || null;
  if (typeof offers === 'object') {
    if (Array.isArray(offers.offers)) return offers.offers[0] || offers;
    return offers;
  }
  return null;
}

function collectImages(product, $page, baseUrl) {
  const out = [];
  function push(u) {
    const abs = safeUrl(u, baseUrl);
    if (abs && !out.includes(abs)) out.push(abs);
  }
  // JSON-LD image
  const img = product.image;
  if (typeof img === 'string') push(img);
  else if (img && typeof img === 'object') {
    if (img.url) push(img.url);
    if (Array.isArray(img)) img.forEach((i) => push(typeof i === 'string' ? i : i?.url));
  } else if (Array.isArray(img)) img.forEach((i) => push(typeof i === 'string' ? i : i?.url));

  // gallery from <meta> and OG
  ['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].forEach((m) => {
    const v = $page(`meta[property="${m}"]`).attr('content') || $page(`meta[name="${m}"]`).attr('content');
    push(v);
  });

  return out.slice(0, 8);
}

async function fetchHtml(targetUrl) {
  const ctl = AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined;
  const res = await fetch(targetUrl, {
    redirect: 'follow',
    signal: ctl,
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8,fr;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${targetUrl}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html') && !ct.includes('xml')) {
    throw new Error(`Unexpected content-type: ${ct}`);
  }
  return await res.text();
}

async function scrapeProduct(rawUrl) {
  if (!/^https?:\/\//i.test(rawUrl)) {
    return { ok: false, error: 'URL must start with http(s)://' };
  }

  let html;
  try {
    html = await fetchHtml(rawUrl);
  } catch (e) {
    return { ok: false, error: 'Failed to fetch URL: ' + e.message };
  }

  const $ = cheerio.load(html);
  const baseUrl = rawUrl;
  const sourceDomain = extractHostname(rawUrl);

  /* ---------- 1. JSON-LD ---------- */
  let product = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (product) return;
    const txt = $(el).contents().text();
    if (!txt || !txt.trim()) return;
    try {
      const data = JSON.parse(txt);
      const p = findJsonLdProduct(data);
      if (p) product = p;
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  if (product) {
    const offer = pickOffer(product) || {};
    const price = asNumber(offer.price ?? offer.lowPrice ?? product.price);
    const currency = offer.priceCurrency || product.priceCurrency || 'USD';
    const name = product.name || '';
    const description =
      (typeof product.description === 'string' && product.description) ||
      (Array.isArray(product.description) ? product.description.join(' ') : '');

    return {
      ok: true,
      source_url: rawUrl,
      source_domain: sourceDomain,
      name: name.trim(),
      description: (description || '').trim().slice(0, 4000),
      image: collectImages(product, $, baseUrl)[0] || '',
      gallery: JSON.stringify(collectImages(product, $, baseUrl)),
      price,
      currency,
      raw: { via: 'json-ld' },
    };
  }

  /* ---------- 2. Open Graph / Twitter ---------- */
  const ogName =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text() ||
    '';
  const ogDesc =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';
  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[property="og:image:secure_url"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('meta[name="twitter:image:src"]').attr('content') ||
    '';

  /* ---------- 3. Price heuristics ---------- */
  let price = null;
  let currency = null;
  const priceCandidates = [];

  // itemprop microdata
  $('[itemprop="price"]').each((_, el) => {
    const c = $(el).attr('content') || $(el).text();
    const n = asNumber(c);
    if (n != null) priceCandidates.push(n);
  });

  // common class names
  const priceSelectors = [
    '.price', '.product-price', '.product_price', '.current-price',
    '[data-price]', '[data-product-price]', '.sale-price', '.amount',
    '.money', '.price-current', '#price', '#product-price',
  ];
  priceSelectors.forEach((sel) => {
    $(sel).each((_, el) => {
      const t = $(el).attr('data-price') || $(el).attr('content') || $(el).text();
      const n = asNumber(t);
      if (n != null && n > 0) priceCandidates.push(n);
    });
  });

  // currency hint
  $('[itemprop="priceCurrency"]').each((_, el) => {
    currency = $(el).attr('content') || $(el).text();
  });
  if (!currency) {
    const m = (ogDesc + ' ' + ogName).match(/\b(MAD|DH|USD|\$|€|EUR|GBP|£|SAR|AED)\b/);
    if (m) currency = m[1];
  }

  if (priceCandidates.length) {
    price = priceCandidates.sort((a, b) => a - b)[0]; // cheapest = usually the real price
  }

  if (ogName || ogImage) {
    return {
      ok: true,
      source_url: rawUrl,
      source_domain: sourceDomain,
      name: (ogName || '').trim().slice(0, 300),
      description: (ogDesc || '').trim().slice(0, 4000),
      image: safeUrl(ogImage, baseUrl),
      gallery: JSON.stringify(ogImage ? [safeUrl(ogImage, baseUrl)] : []),
      price,
      currency: currency || 'USD',
      raw: { via: 'og+heuristics' },
    };
  }

  return {
    ok: false,
    error: 'Could not extract product info from this page. The site may block scrapers or use a non-standard format.',
  };
}

module.exports = { scrapeProduct };
