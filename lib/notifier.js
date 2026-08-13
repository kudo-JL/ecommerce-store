/**
 * Order notifications — 100% free.
 *
 *   • Email     → Gmail SMTP via nodemailer (App Password from env var)
 *   • WhatsApp  → CallMeBot free API (https://www.callmebot.com)
 *
 * Each channel is independent. If one fails, the others still try.
 * Failures are logged, never thrown back to the caller.
 */
const db = require('./db');

/* ---------- config ---------- */
function getEmailConfig() {
  return {
    enabled: getSet('notify_email_enabled', '0') === '1',
    to:      getSet('notify_email_to', ''),
    from:    getSet('notify_email_from', ''),
    // App password lives ONLY in environment variable — never in DB
    appPassword: process.env.GMAIL_APP_PASSWORD || '',
  };
}

function getWhatsAppConfig() {
  return {
    enabled: getSet('notify_whatsapp_enabled', '0') === '1',
    phone:   getSet('notify_whatsapp_phone', ''),  // international format, e.g. +2126XXXXXXXX
    apikey:  getSet('notify_whatsapp_apikey', ''),
  };
}

function getSet(key, def) {
  try {
    const row = db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? def;
  } catch {
    return def;
  }
}

/* ---------- formatters ---------- */
function formatOrderEmail(order, items, storeName) {
  const lines = items.map(
    (i) => `  • ${i.name}  ×  ${i.quantity}  =  ${Number(i.line_total).toFixed(2)} MAD`
  ).join('\n');

  return `طلب جديد على ${storeName}! 🎉

— معلومات الزبون —
👤 الاسم:   ${order.customer_name}
📞 الهاتف:  ${order.customer_phone || '—'}
🏙️ المدينة: ${order.customer_city || '—'}
📍 العنوان: ${order.customer_address || '—'}

— المنتجات —
${lines || '—'}

— المبلغ —
المنتجات:  ${Number(order.subtotal).toFixed(2)} MAD
الشحن:    ${Number(order.shipping).toFixed(2)} MAD
الإجمالي: ${Number(order.total).toFixed(2)} MAD

${order.notes ? `📝 ملاحظات: ${order.notes}\n` : ''}رقم الطلب: #${order.id}
التاريخ:    ${order.created_at}
`;
}

function formatOrderWhatsApp(order, items) {
  const itemsText = items
    .map((i) => `${i.name} x${i.quantity}`)
    .join(' | ');
  return [
    `🛒 طلب جديد #${order.id}`,
    `👤 ${order.customer_name}`,
    `📞 ${order.customer_phone || '—'}`,
    `📍 ${order.customer_city || '—'}`,
    `🛍️ ${itemsText}`,
    `💰 ${Number(order.total).toFixed(2)} MAD`,
    `🚚 شحن: ${Number(order.shipping).toFixed(2)} MAD`,
  ].join('\n');
}

/* ---------- senders ---------- */
async function sendEmail(order, items, storeName) {
  const cfg = getEmailConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  if (!cfg.to || !cfg.from) return { ok: false, reason: 'missing_to_or_from' };
  if (!cfg.appPassword) return { ok: false, reason: 'missing_app_password_env' };

  // Lazy-require so the app boots even if nodemailer isn't installed (dev fallback)
  let nodemailer;
  try { nodemailer = require('nodemailer'); }
  catch { return { ok: false, reason: 'nodemailer_not_installed' }; }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: cfg.from, pass: cfg.appPassword },
  });

  const text = formatOrderEmail(order, items, storeName);

  const info = await transporter.sendMail({
    from: `"${storeName}" <${cfg.from}>`,
    to: cfg.to,
    subject: `🛒 طلب جديد #${order.id} — ${order.customer_name}`,
    text,
  });
  return { ok: true, messageId: info.messageId };
}

async function sendWhatsApp(order, items) {
  const cfg = getWhatsAppConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  if (!cfg.phone || !cfg.apikey) return { ok: false, reason: 'missing_phone_or_apikey' };

  const text = formatOrderWhatsApp(order, items);
  const url =
    'https://api.callmebot.com/whatsapp.php' +
    '?phone=' + encodeURIComponent(cfg.phone) +
    '&text=' + encodeURIComponent(text) +
    '&apikey=' + encodeURIComponent(cfg.apikey);

  const ctl = AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
  const res = await fetch(url, { signal: ctl });
  if (!res.ok) return { ok: false, reason: 'http_' + res.status };
  return { ok: true };
}

/* ---------- public API ---------- */
async function notifyNewOrder(order, items, storeName) {
  const results = { email: null, whatsapp: null, errors: [] };
  try { results.email = await sendEmail(order, items, storeName); }
  catch (e) { results.email = { ok: false, reason: 'exception', error: e.message }; }
  try { results.whatsapp = await sendWhatsApp(order, items); }
  catch (e) { results.whatsapp = { ok: false, reason: 'exception', error: e.message }; }

  // Log to DB so admin can see notification history
  try {
    db.run(
      `INSERT INTO notification_log (order_id, channel, status, detail, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [
        order.id, 'email',     results.email?.ok ? 'sent' : 'failed',
        results.email?.ok ? (results.email.messageId || '') : (results.email?.reason + ' ' + (results.email?.error || '')),
      ]
    );
    db.run(
      `INSERT INTO notification_log (order_id, channel, status, detail, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [
        order.id, 'whatsapp',  results.whatsapp?.ok ? 'sent' : 'failed',
        results.whatsapp?.ok ? '' : (results.whatsapp?.reason + ' ' + (results.whatsapp?.error || '')),
      ]
    );
  } catch { /* table may not exist yet in dev — ignore */ }

  return results;
}

module.exports = { notifyNewOrder, sendEmail, sendWhatsApp, getEmailConfig, getWhatsAppConfig };
