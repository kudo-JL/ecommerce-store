/**
 * Cart — stored in a single cookie as JSON. Keyed by product id.
 * Shape: { items: { "<productId>": { qty, name, price, image, slug } }, updatedAt }
 */
const cookies = require('./cookies');

const COOKIE_NAME = 'cart';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function readCart(req) {
  const raw = cookies.parse(req)[COOKIE_NAME];
  if (!raw) return { items: {}, updatedAt: 0 };
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || !obj.items) obj.items = {};
    return obj;
  } catch {
    return { items: {}, updatedAt: 0 };
  }
}

function writeCart(res, cart) {
  cart.updatedAt = Date.now();
  cookies.setCookie(res, COOKIE_NAME, JSON.stringify(cart), {
    maxAge: MAX_AGE,
    sameSite: 'Lax',
    httpOnly: false, // readable by client to show badge count
  });
}

/** Mutate the cart through a callback, then persist. */
function update(req, res, fn) {
  const cart = readCart(req);
  fn(cart);
  writeCart(res, cart);
  return cart;
}

function clear(res) {
  cookies.clearCookie(res, COOKIE_NAME);
}

function count(cart) {
  return Object.values(cart.items || {}).reduce((s, it) => s + (it.qty || 0), 0);
}

function totals(cart, shipping = 0) {
  const items = Object.values(cart.items || {});
  const subtotal = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0);
  return {
    subtotal,
    shipping,
    total: subtotal + shipping,
    count: items.reduce((s, it) => s + (it.qty || 0), 0),
  };
}

/** Merge the latest server prices/names into the cart (in case products changed). */
async function rehydrate(db, cart) {
  const ids = Object.keys(cart.items || {});
  if (!ids.length) return cart;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    ? (db.all
        ? db.all(`SELECT id, name, slug, selling_price, image_url, is_published, stock FROM products WHERE id IN (${placeholders})`, ids)
        : [])
    : [];
  for (const r of rows) {
    const item = cart.items[String(r.id)];
    if (!item) continue;
    item.name = r.name;
    item.price = Number(r.selling_price) || 0;
    item.image = r.image_url || '';
    item.slug = r.slug;
    item.available = !!r.is_published && r.stock > 0;
    item.stock = r.stock;
  }
  return cart;
}

module.exports = { readCart, writeCart, update, clear, count, totals, rehydrate, COOKIE_NAME };
