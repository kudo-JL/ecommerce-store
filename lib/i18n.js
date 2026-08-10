/**
 * Minimal i18n — Arabic primary, FR/EN structure ready.
 * Switch is a no-op for now (we hardcode Arabic) but the lookup is in place,
 * so flipping the `language` setting in the DB will activate translations later.
 */
const ar = require('../locales/ar.json');
const fr = require('../locales/fr.json');
const en = require('../locales/en.json');

const DICTS = { ar, fr, en };

function pickLang(req) {
  // For now: always Arabic. FR/EN reserved for later activation.
  return 'ar';
}

function t(lang, key, vars = {}) {
  const dict = DICTS[lang] || DICTS.ar;
  const parts = key.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
    else return key;
  }
  if (typeof cur !== 'string') return key;
  return cur.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function dir(lang) {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

module.exports = { pickLang, t, dir, DICTS };
