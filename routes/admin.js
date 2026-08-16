/**
 * Admin routes — login, dashboard, products CRUD, URL import, orders, settings.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../lib/db');
const auth = require('../lib/auth');
const notifier = require('../lib/notifier');
const { scrapeProduct } = require('../lib/scraper');
const { slugify, uniqueSlug, formatPrice, profitOf } = require('../lib/helpers');
const { t, pickLang } = require('../lib/i18n');
const uploadsLib = require('../lib/uploads');

const UPLOAD_DIR = uploadsLib.uploadsDir();

/* ---------- multer 2.x — disk storage for product images ----------
 * Saves to the persistent volume (/app/data/uploads on Railway) so
 * images survive redeployments.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname).toLowerCase() || '.jpg')
      .replace(/^\.jfif$/, '.jpg'); // normalize JFIF → JPEG
    const safe = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 40);
    cb(null, Date.now().toString(36) + '_' + safe.replace(/\.[^.]+$/, '') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|jfif)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

/* ---------- helpers ---------- */
function getSetting(key, def = '') {
  const row = db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : def;
}
function setSetting(key, value) {
  db.run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

function adminBase(req) {
  return {
    t: (k, v) => t(pickLang(req), k, v),
    dir: 'rtl',
    lang: 'ar',
    storeName: getSetting('store_name', 'متجري'),
    settings: {
      store_name: getSetting('store_name'),
      store_tagline: getSetting('store_tagline'),
      currency: getSetting('currency'),
      // pricing
      default_markup_pct: getSetting('default_markup_pct', '30'),
      shipping_fee: getSetting('shipping_fee', '30'),
      free_shipping_threshold: getSetting('free_shipping_threshold', '0'),
      // notifications
      notify_telegram_enabled: getSetting('notify_telegram_enabled', '0'),
      notify_telegram_bot_token: getSetting('notify_telegram_bot_token', ''),
      notify_telegram_chat_id: getSetting('notify_telegram_chat_id', ''),
      notify_whatsapp_enabled: getSetting('notify_whatsapp_enabled', '0'),
      notify_whatsapp_phone: getSetting('notify_whatsapp_phone', ''),
      notify_whatsapp_apikey: getSetting('notify_whatsapp_apikey', ''),
    },
    activeNav: '',
  };
}

function ensureCategoryByName(name) {
  if (!name) return null;
  let row = db.get('SELECT * FROM categories WHERE name = ?', [name]);
  if (row) return row;
  const slug = uniqueSlug(slugify(name), (s) => !!db.get('SELECT 1 FROM categories WHERE slug = ?', [s]));
  const r = db.run('INSERT INTO categories(name, slug) VALUES(?, ?)', [name, slug]);
  return { id: r.lastInsertRowid, name, slug };
}

/* ---------- AUTH ---------- */
router.get('/login', (req, res) => {
  if (auth.isAuthed(req)) return res.redirect('/admin');
  res.render('admin/login', { ...adminBase(req), title: 'دخول', error: null, activeNav: 'login' });
});

router.post('/login', (req, res) => {
  const token = (req.body.token || '').trim();
  if (token === auth.getToken()) {
    auth.login(res, token);
    return res.redirect('/admin');
  }
  res.status(401).render('admin/login', { ...adminBase(req), title: 'دخول', error: 'كلمة المرور خاطئة', activeNav: 'login' });
});

router.post('/logout', (req, res) => {
  auth.logout(res);
  res.redirect('/admin/login');
});

/* ---------- AUTHED ROUTES ---------- */
router.use(auth.requireAdmin);

/* ---------- DASHBOARD ---------- */
router.get('/', (req, res) => {
  const stats = {
    products: db.get('SELECT COUNT(*) AS c FROM products').c,
    published: db.get('SELECT COUNT(*) AS c FROM products WHERE is_published = 1').c,
    imported: db.get('SELECT COUNT(*) AS c FROM products WHERE is_imported = 1').c,
    manual: db.get('SELECT COUNT(*) AS c FROM products WHERE is_imported = 0').c,
    orders: db.get('SELECT COUNT(*) AS c FROM orders').c,
    new_orders: db.get(`SELECT COUNT(*) AS c FROM orders WHERE status = 'new'`).c,

    // 💰 money breakdown — shipping is tracked SEPARATELY so it never mixes with profit
    products_revenue: db.get('SELECT COALESCE(SUM(subtotal), 0) AS s FROM orders').s,
    shipping_collected: db.get('SELECT COALESCE(SUM(shipping), 0) AS s FROM orders').s,
    total_invoiced: db.get('SELECT COALESCE(SUM(total), 0) AS s FROM orders').s,

    // 🟢 product profit = real money YOU keep from sales (excludes shipping)
    //    = sum across order_items of (price - product.original_price) * quantity
    realized_profit: db.get(
      `SELECT COALESCE(SUM((oi.price - p.original_price) * oi.quantity), 0) AS s
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id`
    ).s,
    // 🟡 potential profit = profit locked in current inventory (if you sold it all today)
    potential_profit: db
      .get(
        `SELECT COALESCE(SUM((selling_price - original_price) * stock), 0) AS s
         FROM products WHERE is_published = 1 AND original_price > 0`
      ).s,
  };
  const recentOrders = db.all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
  const recentProducts = db.all('SELECT * FROM products ORDER BY created_at DESC LIMIT 5');
  res.render('admin/dashboard', {
    ...adminBase(req),
    title: 'لوحة التحكم',
    stats,
    recentOrders,
    recentProducts,
    activeNav: 'dashboard',
  });
});

/* ---------- PRODUCTS LIST ---------- */
router.get('/products', (req, res) => {
  const products = db.all(
    `SELECT p.*, c.name AS category_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.created_at DESC`
  );
  const categories = db.all('SELECT * FROM categories ORDER BY name');
  res.render('admin/products', {
    ...adminBase(req),
    title: 'المنتجات',
    products: products.map((p) => ({ ...p, profit: profitOf(p) })),
    categories,
    activeNav: 'products',
  });
});

/* ---------- MANUAL ADD ---------- */
router.get('/products/new', (req, res) => {
  const categories = db.all('SELECT * FROM categories ORDER BY name');
  res.render('admin/edit', {
    ...adminBase(req),
    title: 'إضافة منتوج',
    product: null,
    categories,
    error: null,
    activeNav: 'products',
  });
});

/* ---------- EDIT ---------- */
router.get('/products/:id/edit', (req, res) => {
  const product = db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.redirect('/admin/products');
  const categories = db.all('SELECT * FROM categories ORDER BY name');
  res.render('admin/edit', {
    ...adminBase(req),
    title: 'تعديل منتوج',
    product,
    categories,
    error: null,
    activeNav: 'products',
  });
});

/* ---------- SAVE (create / update) ---------- */
async function readBody(req) {
  // multer only runs on multipart; for urlencoded we need to read body
  return req.body;
}

function buildImageUrl(req, file, body) {
  if (file) return '/uploads/' + path.basename(file.path);
  if (body.image_url && body.image_url.trim()) return body.image_url.trim();
  return '';
}

router.post('/products', upload.single('image'), (req, res, next) => {
  try {
    saveProduct(req, res, null);
  } catch (e) { next(e); }
});

router.post('/products/:id', upload.single('image'), (req, res, next) => {
  try {
    saveProduct(req, res, req.params.id);
  } catch (e) { next(e); }
});

function saveProduct(req, res, id) {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) {
    const categories = db.all('SELECT * FROM categories ORDER BY name');
    return res.status(400).render('admin/edit', {
      ...adminBase(req),
      title: id ? 'تعديل' : 'إضافة',
      product: id ? db.get('SELECT * FROM products WHERE id = ?', [id]) : null,
      categories,
      error: 'الاسم مطلوب',
      activeNav: 'products',
    });
  }

  // category resolution
  let categoryId = b.category_id ? Number(b.category_id) : null;
  if (b.new_category && b.new_category.trim()) {
    const c = ensureCategoryByName(b.new_category.trim());
    categoryId = c.id;
  }

  // price
  const originalPrice = Number(b.original_price) || 0;
  let sellingPrice = Number(b.selling_price) || 0;
  if (!sellingPrice && originalPrice) {
    // default markup
    const markup = Number(getSetting('default_markup_pct', '30')) || 30;
    sellingPrice = +(originalPrice * (1 + markup / 100)).toFixed(2);
  }

  // image
  const imageUrl = buildImageUrl(req, req.file, b);
  const isPublished = b.is_published === 'on' || b.is_published === '1' || b.is_published === 1 ? 1 : 0;

  if (id) {
    const existing = db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.redirect('/admin/products');

    const finalImage = imageUrl || existing.image_url;
    db.run(
      `UPDATE products SET
        name = ?, description = ?, original_price = ?, selling_price = ?,
        category_id = ?, image_url = ?, source_url = ?, source_domain = ?,
        stock = ?, is_published = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        name,
        b.description || '',
        originalPrice,
        sellingPrice,
        categoryId,
        finalImage,
        b.source_url || existing.source_url || '',
        b.source_domain || existing.source_domain || '',
        Math.max(0, Number(b.stock) || 0),
        isPublished,
        id,
      ]
    );
    return res.redirect('/admin/products?ok=updated');
  } else {
    const baseSlug = slugify(name);
    const slug = uniqueSlug(baseSlug, (s) => !!db.get('SELECT 1 FROM products WHERE slug = ?', [s]));
    const r = db.run(
      `INSERT INTO products
        (name, slug, description, original_price, selling_price, currency,
         image_url, source_url, source_domain, category_id, stock, is_imported, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        name,
        slug,
        b.description || '',
        originalPrice,
        sellingPrice,
        getSetting('currency', 'MAD'),
        imageUrl,
        b.source_url || '',
        b.source_domain || '',
        categoryId,
        Math.max(0, Number(b.stock) || 0),
        isPublished,
      ]
    );
    return res.redirect('/admin/products?ok=created');
  }
}

/* ---------- DELETE ---------- */
router.post('/products/:id/delete', (req, res) => {
  const id = req.params.id;
  const p = db.get('SELECT image_url FROM products WHERE id = ?', [id]);
  db.run('DELETE FROM products WHERE id = ?', [id]);
  // best-effort: remove uploaded file
  if (p && p.image_url && p.image_url.startsWith('/uploads/')) {
    const fp = path.join(UPLOAD_DIR, path.basename(p.image_url));
    fs.promises.unlink(fp).catch(() => {});
  }
  return res.redirect('/admin/products?ok=deleted');
});

/* ---------- IMPORT BY URL ---------- */
router.get('/import', (req, res) => {
  res.render('admin/import', {
    ...adminBase(req),
    title: 'استيراد من رابط',
    preview: null,
    error: null,
    formUrl: '',
    activeNav: 'import',
  });
});

// Preview: scrape + show the form pre-filled, do NOT save yet
router.post('/import/preview', express.urlencoded({ extended: true }), async (req, res) => {
  const url = (req.body.url || '').trim();
  if (!url) {
    return res.render('admin/import', {
      ...adminBase(req),
      title: 'استيراد من رابط',
      preview: null,
      error: 'الرجاء إدخال رابط',
      formUrl: '',
      activeNav: 'import',
    });
  }
  const result = await scrapeProduct(url);
  if (!result.ok) {
    return res.render('admin/import', {
      ...adminBase(req),
      title: 'استيراد من رابط',
      preview: null,
      error: result.error,
      formUrl: url,
      activeNav: 'import',
    });
  }
  const markup = Number(getSetting('default_markup_pct', '30')) || 30;
  const suggestedSelling = result.price
    ? +(result.price * (1 + markup / 100)).toFixed(2)
    : 0;
  const preview = {
    source_url: result.source_url,
    source_domain: result.source_domain,
    name: result.name || '',
    description: result.description || '',
    image_url: result.image || '',
    original_price: result.price || 0,
    selling_price: suggestedSelling,
    currency: result.currency || getSetting('currency', 'MAD'),
  };
  res.render('admin/import', {
    ...adminBase(req),
    title: 'معاينة قبل النشر',
    preview,
    error: null,
    formUrl: url,
    activeNav: 'import',
  });
});

// Publish: save the previewed product (now editable)
router.post('/import/publish', express.urlencoded({ extended: true }), upload.single('image'), (req, res) => {
  const b = req.body;
  const name = (b.name || '').trim();
  if (!name) {
    return res.redirect('/admin/import');
  }
  let categoryId = b.category_id ? Number(b.category_id) : null;
  if (b.new_category && b.new_category.trim()) {
    const c = ensureCategoryByName(b.new_category.trim());
    categoryId = c.id;
  }
  const originalPrice = Number(b.original_price) || 0;
  const sellingPrice = Number(b.selling_price) || 0;
  const imageUrl = buildImageUrl(req, req.file, b) || b.image_url || '';
  const baseSlug = slugify(name);
  const slug = uniqueSlug(baseSlug, (s) => !!db.get('SELECT 1 FROM products WHERE slug = ?', [s]));

  const r = db.run(
    `INSERT INTO products
      (name, slug, description, original_price, selling_price, currency,
       image_url, source_url, source_domain, category_id, stock, is_imported, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
    [
      name,
      slug,
      b.description || '',
      originalPrice,
      sellingPrice,
      b.currency || getSetting('currency', 'MAD'),
      imageUrl,
      b.source_url || '',
      b.source_domain || '',
      categoryId,
      Math.max(0, Number(b.stock) || 0),
    ]
  );
  res.redirect('/admin/products?ok=imported');
});

/* ---------- ORDERS ---------- */
router.get('/orders', (req, res) => {
  const orders = db.all('SELECT * FROM orders ORDER BY created_at DESC');
  const enriched = orders.map((o) => {
    const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    // product profit for THIS order (shipping NOT included)
    const orderProfit = items.reduce((sum, it) => {
      const p = db.get('SELECT original_price FROM products WHERE id = ?', [it.product_id]);
      const orig = p ? Number(p.original_price) || 0 : 0;
      return sum + (Number(it.price) - orig) * Number(it.quantity);
    }, 0);
    return { ...o, items, orderProfit };
  });
  res.render('admin/orders', {
    ...adminBase(req),
    title: 'الطلبات',
    orders: enriched,
    activeNav: 'orders',
  });
});

router.post('/orders/:id/status', (req, res) => {
  const status = req.body.status || 'new';
  const allowed = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.redirect('/admin/orders');
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  res.redirect('/admin/orders');
});

// edit shipping per order (and total is recomputed)
router.post('/orders/:id/shipping', (req, res) => {
  const newShipping = Math.max(0, Number(req.body.shipping) || 0);
  const order = db.get('SELECT subtotal FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.redirect('/admin/orders');
  const newTotal = (Number(order.subtotal) || 0) + newShipping;
  db.run('UPDATE orders SET shipping = ?, total = ? WHERE id = ?', [newShipping, newTotal, req.params.id]);
  res.redirect('/admin/orders?ok=updated');
});

router.post('/orders/:id/delete', (req, res) => {
  db.run('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
  db.run('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.redirect('/admin/orders');
});

/* ---------- SETTINGS ---------- */
router.get('/settings', (req, res) => {
  res.render('admin/settings', {
    ...adminBase(req),
    title: 'الإعدادات',
    saved: req.query.ok === '1',
    activeNav: 'settings',
  });
});

router.post('/settings', (req, res) => {
  const {
    store_name, store_tagline, currency,
    default_markup_pct, shipping_fee, free_shipping_threshold,
    notify_telegram_enabled, notify_telegram_bot_token, notify_telegram_chat_id,
    notify_whatsapp_enabled, notify_whatsapp_phone, notify_whatsapp_apikey,
  } = req.body || {};

  if (store_name !== undefined) setSetting('store_name', String(store_name).trim());
  if (store_tagline !== undefined) setSetting('store_tagline', String(store_tagline).trim());
  if (currency) setSetting('currency', currency.trim());
  if (default_markup_pct !== undefined) setSetting('default_markup_pct', String(Math.max(0, Number(default_markup_pct) || 0)));
  if (shipping_fee !== undefined) setSetting('shipping_fee', String(Math.max(0, Number(shipping_fee) || 0)));
  if (free_shipping_threshold !== undefined) setSetting('free_shipping_threshold', String(Math.max(0, Number(free_shipping_threshold) || 0)));

  // Telegram
  setSetting('notify_telegram_enabled',  notify_telegram_enabled === 'on' || notify_telegram_enabled === '1' ? '1' : '0');
  setSetting('notify_telegram_bot_token', String(notify_telegram_bot_token || '').trim());
  setSetting('notify_telegram_chat_id',   String(notify_telegram_chat_id || '').trim());

  // WhatsApp (CallMeBot)
  setSetting('notify_whatsapp_enabled', notify_whatsapp_enabled === 'on' || notify_whatsapp_enabled === '1' ? '1' : '0');
  setSetting('notify_whatsapp_phone',   String(notify_whatsapp_phone || '').trim());
  setSetting('notify_whatsapp_apikey',  String(notify_whatsapp_apikey || '').trim());

  res.redirect('/admin/settings?ok=1');
});

// Resend notifications for an order
router.post('/orders/:id/notify', async (req, res) => {
  const order = db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.redirect('/admin/orders');
  const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const storeName = getSetting('store_name', 'متجري');
  const result = await notifier.notifyNewOrder(order, items, storeName);
  res.redirect('/admin/orders?ok=notified&tg=' + (result.telegram?.ok ? 1 : 0) + '&wa=' + (result.whatsapp?.ok ? 1 : 0));
});

module.exports = router;
