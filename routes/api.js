/**
 * Public API — used by the admin "import" page to preview a URL via JSON
 * (so the user can also use it as a standalone scraper endpoint).
 */
const express = require('express');
const router = express.Router();
const { scrapeProduct } = require('../lib/scraper');

router.post('/scrape', express.urlencoded({ extended: true }), async (req, res) => {
  const url = (req.body.url || '').trim();
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });
  const out = await scrapeProduct(url);
  res.json(out);
});

router.get('/scrape', async (req, res) => {
  const url = (req.query.url || '').trim();
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });
  const out = await scrapeProduct(url);
  res.json(out);
});

module.exports = router;
