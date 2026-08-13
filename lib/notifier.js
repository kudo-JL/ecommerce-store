/**
 * Order notifications — 100% free.
 *
 *   • Telegram  → Telegram Bot API (just a Bot Token from @BotFather + your chat id)
 *   • WhatsApp  → CallMeBot free API (https://www.callmebot.com)
 *
 * Each channel is independent. If one fails, the others still try.
 * Failures are logged, never thrown back to the caller.
 */
const db = require('./db');

/* ---------- config ---------- */
function getTelegramConfig() {
  return {
    enabled: getSet('notify_telegram_enabled', '0') === '1',
    botToken: getSet('notify_telegram_bot_token', ''),
    chatId:   getSet('notify_telegram_chat_id', ''),
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
function formatOrderMessage(order, items) {
  const lines = items.map((i) => {
    return `  • ${i.name}  ×  ${i.quantity}  =  ${Number(i.line_total).toFixed(2)} MAD`;
  }).join('\n');

  return [
    `🛒 طلب جديد #${order.id}`,
    ``,
    `👤 الاسم:   ${order.customer_name}`,
    `📞 الهاتف:  ${order.customer_phone || '—'}`,
    `🏙️ المدينة: ${order.customer_city || '—'}`,
    `📍 العنوان: ${order.customer_address || '—'}`,
    ``,
    `— المنتجات —`,
    lines || '—',
    ``,
    `💰 المنتجات: ${Number(order.subtotal).toFixed(2)} MAD`,
    `🚚 الشحن:   ${Number(order.shipping).toFixed(2)} MAD`,
    `🧾 الإجمالي: ${Number(order.total).toFixed(2)} MAD`,
    order.notes ? `\n📝 ملاحظات: ${order.notes}` : '',
  ].filter(Boolean).join('\n');
}

/* ---------- senders ---------- */
async function sendTelegram(order, items) {
  const cfg = getTelegramConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  if (!cfg.botToken || !cfg.chatId) return { ok: false, reason: 'missing_token_or_chatid' };

  const text = formatOrderMessage(order, items);
  const url =
    'https://api.telegram.org/bot' + cfg.botToken +
    '/sendMessage' +
    '?chat_id=' + encodeURIComponent(cfg.chatId) +
    '&text='    + encodeURIComponent(text) +
    '&parse_mode=HTML';

  const ctl = AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
  const res = await fetch(url, { signal: ctl });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    return { ok: false, reason: 'http_' + res.status, error: body.description || '' };
  }
  return { ok: true, messageId: body.result?.message_id };
}

async function sendWhatsApp(order, items) {
  const cfg = getWhatsAppConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  if (!cfg.phone || !cfg.apikey) return { ok: false, reason: 'missing_phone_or_apikey' };

  const text = formatOrderMessage(order, items);
  const url =
    'https://api.callmebot.com/whatsapp.php' +
    '?phone='  + encodeURIComponent(cfg.phone) +
    '&text='   + encodeURIComponent(text) +
    '&apikey=' + encodeURIComponent(cfg.apikey);

  const ctl = AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
  const res = await fetch(url, { signal: ctl });
  if (!res.ok) return { ok: false, reason: 'http_' + res.status };
  return { ok: true };
}

/* ---------- public API ---------- */
async function notifyNewOrder(order, items, storeName) {
  const results = { telegram: null, whatsapp: null, errors: [] };
  try { results.telegram = await sendTelegram(order, items); }
  catch (e) { results.telegram = { ok: false, reason: 'exception', error: e.message }; }
  try { results.whatsapp = await sendWhatsApp(order, items); }
  catch (e) { results.whatsapp = { ok: false, reason: 'exception', error: e.message }; }

  // Log to DB
  try {
    db.run(
      `INSERT INTO notification_log (order_id, channel, status, detail, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [
        order.id, 'telegram', results.telegram?.ok ? 'sent' : 'failed',
        results.telegram?.ok ? '' : (results.telegram?.reason + ' ' + (results.telegram?.error || '')),
      ]
    );
    db.run(
      `INSERT INTO notification_log (order_id, channel, status, detail, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [
        order.id, 'whatsapp', results.whatsapp?.ok ? 'sent' : 'failed',
        results.whatsapp?.ok ? '' : (results.whatsapp?.reason + ' ' + (results.whatsapp?.error || '')),
      ]
    );
  } catch { /* table may not exist yet in dev — ignore */ }

  return results;
}

module.exports = {
  notifyNewOrder,
  sendTelegram,
  sendWhatsApp,
  getTelegramConfig,
  getWhatsAppConfig,
};
