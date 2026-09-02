/**
 * Public store routes — home, product list, product detail, cart, checkout.
 */
const express = require('express');
const router = express.Router();
const path = require('path');

const db = require('../lib/db');
const cartLib = require('../lib/cart');
const notifier = require('../lib/notifier');
const { t, pickLang } = require('../lib/i18n');
const { formatPrice, profitOf } = require('../lib/helpers');

/* ---------- helpers ---------- */
function getSetting(key, def = '') {
  const row = db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : def;
}

/** Compute shipping for a given cart subtotal, using settings. */
function calcShipping(subtotal) {
  const fee = Number(getSetting('shipping_fee', '30')) || 0;
  const threshold = Number(getSetting('free_shipping_threshold', '0')) || 0;
  if (threshold > 0 && subtotal >= threshold) return 0;
  return fee;
}

function viewBase(req) {
  return {
    t: (k, v) => t(pickLang(req), k, v),
    dir: 'rtl',
    lang: 'ar',
    storeName: getSetting('store_name', 'متجر رياضي'),
    storeTagline: getSetting('store_tagline', ''),
    currency: getSetting('currency', 'MAD'),
    settings: {
      store_name: getSetting('store_name'),
      store_tagline: getSetting('store_tagline'),
      currency: getSetting('currency'),
    },
  };
}

function attachCart(req, res, next) {
  const cart = cartLib.readCart(req);
  res.locals.cart = cart;
  res.locals.cartCount = cartLib.count(cart);
  res.locals.cartTotals = cartLib.totals(cart, 0);
  next();
}

/* ---------- HOME ---------- */
router.get('/', attachCart, (req, res) => {
  const featured = db.all(
    'SELECT * FROM products WHERE is_published = 1 ORDER BY created_at DESC LIMIT 8'
  );
  res.render('store/index', {
    ...viewBase(req),
    title: getSetting('store_name', 'متجر رياضي'),
    featured,
    activeNav: 'home',
  });
});

/* ---------- PRODUCT LIST ---------- */
router.get('/products', attachCart, (req, res) => {
  const { q, cat } = req.query;
  let sql = 'SELECT * FROM products WHERE is_published = 1';
  const args = [];
  if (q) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    args.push('%' + q + '%', '%' + q + '%');
  }
  if (cat) {
    sql += ' AND category_id = ?';
    args.push(Number(cat));
  }
  sql += ' ORDER BY created_at DESC';
  const products = db.all(sql, args);
  const categories = db.all('SELECT * FROM categories ORDER BY name');

  res.render('store/products', {
    ...viewBase(req),
    title: 'المنتجات',
    products,
    categories,
    q: q || '',
    activeCat: cat ? Number(cat) : null,
    activeNav: 'products',
  });
});

/* ---------- PRODUCT DETAIL ---------- */
router.get('/product/:slug', attachCart, (req, res) => {
  const product = db.get('SELECT * FROM products WHERE slug = ? AND is_published = 1', [req.params.slug]);
  if (!product) return res.status(404).render('store/404', { ...viewBase(req), title: 'غير موجود' });
  const category = product.category_id
    ? db.get('SELECT * FROM categories WHERE id = ?', [product.category_id])
    : null;
  res.render('store/product', {
    ...viewBase(req),
    title: product.name,
    product,
    category,
    profit: profitOf(product),
    activeNav: 'products',
  });
});

/* ---------- CART ---------- */
router.get('/cart', attachCart, (req, res) => {
  const items = Object.entries(res.locals.cart.items || {}).map(([id, it]) => ({ id, ...it }));
  const subtotal = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0);
  const shipping = items.length ? calcShipping(subtotal) : 0;
  res.render('store/cart', {
    ...viewBase(req),
    title: 'السلة',
    items,
    shipping,
    activeNav: 'cart',
  });
});

router.post('/cart/add/:id', (req, res) => {
  const id = Number(req.params.id);
  const qty = Math.max(1, Number(req.body.qty) || 1);
  const product = db.get('SELECT * FROM products WHERE id = ? AND is_published = 1', [id]);
  if (!product) return res.status(404).json({ error: 'not found' });
  cartLib.update(req, res, (cart) => {
    const key = String(id);
    if (cart.items[key]) {
      cart.items[key].qty += qty;
    } else {
      cart.items[key] = {
        qty,
        name: product.name,
        price: Number(product.selling_price) || 0,
        image: product.image_url || '',
        slug: product.slug,
      };
    }
  });
  if (req.accepts('html') && !req.xhr) return res.redirect('back');
  const c = cartLib.readCart(req);
  return res.json({ ok: true, count: cartLib.count(c) });
});

router.post('/cart/update/:id', (req, res) => {
  const id = req.params.id;
  const qty = Math.max(0, Number(req.body.qty) || 0);
  cartLib.update(req, res, (cart) => {
    if (qty <= 0) {
      delete cart.items[id];
    } else if (cart.items[id]) {
      cart.items[id].qty = qty;
    }
  });
  return res.redirect('/cart');
});

router.post('/cart/remove/:id', (req, res) => {
  const id = req.params.id;
  cartLib.update(req, res, (cart) => {
    delete cart.items[id];
  });
  return res.redirect('/cart');
});

router.post('/cart/clear', (req, res) => {
  cartLib.clear(res);
  return res.redirect('/cart');
});

/* ---------- CHECKOUT ---------- */
router.get('/checkout', attachCart, (req, res) => {
  const items = Object.entries(res.locals.cart.items || {}).map(([id, it]) => ({ id, ...it }));
  if (!items.length) return res.redirect('/cart');
  const subtotal = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0);
  const shipping = calcShipping(subtotal);
  res.render('store/checkout', {
    ...viewBase(req),
    title: 'إتمام الطلب',
    items,
    shipping,
    error: null,
    values: {},     // <-- FIX: always pass values to template
    activeNav: 'cart',
  });
});

router.post('/checkout', (req, res) => {
  const { customer_name, customer_phone, customer_city, customer_address, notes } = req.body || {};
  const cart = cartLib.readCart(req);
  const items = Object.entries(cart.items || {});
  if (!items.length) return res.redirect('/cart');

  const subtotal = items.reduce((s, [, it]) => s + (it.price || 0) * (it.qty || 0), 0);
  const shipping = calcShipping(subtotal);
  const total = subtotal + shipping;

  if (!customer_name || !customer_phone) {
    return res.status(400).render('store/checkout', {
      ...viewBase(req),
      title: 'إتمام الطلب',
      items: items.map(([id, it]) => ({ id, ...it })),
      shipping,
      error: 'الاسم والهاتف مطلوبان',
      values: req.body || {},
      activeNav: 'cart',
    });
  }

  const r = db.run(
    `INSERT INTO orders
      (customer_name, customer_phone, customer_city, customer_address, notes, subtotal, shipping, total, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    [customer_name, customer_phone, customer_city || '', customer_address || '', notes || '',
     subtotal, shipping, total]
  );
  const orderId = r.lastInsertRowid;

  for (const [pid, it] of items) {
    db.run(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, Number(pid), it.name, it.price, it.qty, it.price * it.qty]
    );
    db.run('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [it.qty, Number(pid)]);
  }

  // Reload order + items so we have canonical created_at & subtotal/total
  const savedOrder = db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  const orderItems = db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

  // 🔔 Fire notifications (email + WhatsApp). Don't block the response.
  // If a channel fails, the order is still saved.
  notifier
    .notifyNewOrder(savedOrder, orderItems, getSetting('store_name', 'متجر رياضي'))
    .then((r) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[notifier]', JSON.stringify(r));
      }
    })
    .catch((e) => console.error('[notifier] fatal:', e));

  cartLib.clear(res);
  res.render('store/order-success', {
    ...viewBase(req),
    title: 'تم استلام الطلب',
    orderId,
    activeNav: 'cart',
  });
});

module.exports = router;
