/**
 * Slugify — ASCII-safe, supports Arabic by transliterating fallback to id suffix.
 */
function slugify(input) {
  if (!input) return '';
  const s = String(input)
    .toLowerCase()
    .replace(/[\u0600-\u06FF]+/g, (m) => m) // keep Arabic
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || ('p-' + Date.now().toString(36));
}

function uniqueSlug(base, exists) {
  let s = base;
  let n = 1;
  while (exists(s)) {
    n += 1;
    s = `${base}-${n}`;
  }
  return s;
}

function formatPrice(value, currency) {
  const n = Number(value) || 0;
  return n.toFixed(2) + ' ' + (currency || 'د.م.');
}

function profitOf(product) {
  const o = Number(product.original_price) || 0;
  const s = Number(product.selling_price) || 0;
  const p = s - o;
  const pct = o > 0 ? (p / o) * 100 : 0;
  return { absolute: p, percent: pct };
}

module.exports = { slugify, uniqueSlug, formatPrice, profitOf };
