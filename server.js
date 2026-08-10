/**
 * E-commerce store — main server.
 *   Run: npm install && npm start
 *   Admin: http://localhost:3000/admin   (default password: JL@kudo92 — change in /admin/settings)
 */
const path = require('path');
const fs = require('fs');
const express = require('express');

const db = require('./lib/db');
const auth = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3007;

/* ---------- View engine ---------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ---------- Middleware ---------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

/* expose settings + auth status to all views */
app.use((req, res, next) => {
  const storeName = (db.get('SELECT value FROM settings WHERE key = ?', ['store_name']) || {}).value || 'متجري';
  const storeTagline = (db.get('SELECT value FROM settings WHERE key = ?', ['store_tagline']) || {}).value || '';
  const currency = (db.get('SELECT value FROM settings WHERE key = ?', ['currency']) || {}).value || 'MAD';
  res.locals.storeName = storeName;
  res.locals.storeTagline = storeTagline;
  res.locals.currency = currency;
  res.locals.isAdmin = auth.isAuthed(req);
  res.locals.formatPrice = (n) => (Number(n) || 0).toFixed(2) + ' ' + currency;
  res.locals.activeNav = res.locals.activeNav || '';
  res.locals.flash = req.query.ok
    ? ({ created: 'تم إنشاء المنتوج', updated: 'تم تحديث المنتوج', deleted: 'تم حذف المنتوج', imported: 'تم استيراد المنتوج ونشره' })[req.query.ok] || ''
    : '';
  next();
});

/* ---------- Routes ---------- */
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/store'));

/* ---------- 404 ---------- */
app.use((req, res) => {
  if (req.accepts('html')) return res.status(404).render('store/404', { title: 'غير موجود' });
  res.status(404).json({ error: 'not found' });
});

/* ---------- error handler ---------- */
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  if (req.accepts('html')) {
    res.status(500).render('store/error', { title: 'خطأ', error: err.message || 'Server error' });
  } else {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

/* ---------- boot ---------- */
(async () => {
  await db.load();
  // Run schema
  const schema = fs.readFileSync(path.join(__dirname, 'lib', 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log('[db] schema ready at', db.DB_PATH);

  app.listen(PORT, () => {
    console.log(`\n  ${(db.get('SELECT value FROM settings WHERE key=?', ['store_name']) || {}).value || 'Store'} running`);
    console.log(`  Store:   http://localhost:${PORT}/`);
    console.log(`  Admin:   http://localhost:${PORT}/admin/  (default password: admin123)`);
    console.log(`  API:     POST /api/scrape  { url: "https://..." }\n`);
  });
})();
