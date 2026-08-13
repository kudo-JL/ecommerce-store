-- E-commerce store schema
-- node:sqlite compatible (also runs on better-sqlite3)

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  slug  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT DEFAULT '',
  original_price  REAL DEFAULT 0,    -- hidden from public; for admin profit calc
  selling_price   REAL NOT NULL,     -- public price (editable before publish)
  currency        TEXT DEFAULT 'MAD',
  image_url       TEXT DEFAULT '',
  gallery         TEXT DEFAULT '',   -- JSON array of extra image URLs
  source_url      TEXT DEFAULT '',   -- where it was imported from
  source_domain   TEXT DEFAULT '',
  category_id     INTEGER,
  stock           INTEGER DEFAULT 0,
  is_imported     INTEGER DEFAULT 0, -- 1 = imported by URL, 0 = manual
  is_published    INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_published ON products(is_published);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT,
  customer_city    TEXT,
  customer_address TEXT,
  notes            TEXT,
  subtotal         REAL NOT NULL DEFAULT 0,
  shipping         REAL NOT NULL DEFAULT 0,
  total            REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'new', -- new | confirmed | shipped | delivered | cancelled
  created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name       TEXT NOT NULL,
  price      REAL NOT NULL,
  quantity   INTEGER NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Notification log
CREATE TABLE IF NOT EXISTS notification_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER,
  channel    TEXT,    -- 'telegram' | 'whatsapp'
  status     TEXT,    -- 'sent' | 'failed'
  detail     TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_log_order ON notification_log(order_id);

-- Seed default settings
INSERT OR IGNORE INTO settings(key, value) VALUES
  ('store_name', 'متجري'),
  ('store_tagline', 'متجرك الوسيط — منتجات مختارة بأسعار مناسبة'),
  ('currency', 'MAD'),
  ('language', 'ar'),
  ('admin_token', 'admin123'),
  ('default_markup_pct', '30'),
  ('shipping_fee', '30'),
  ('free_shipping_threshold', '0'),  -- 0 = never free. e.g. 500 = free over 500 MAD

  -- Telegram notifications (free via Bot API)
  ('notify_telegram_enabled', '0'),
  ('notify_telegram_bot_token', ''),  -- from @BotFather
  ('notify_telegram_chat_id', ''),    -- your personal chat id (10-digit number)

  -- WhatsApp notifications (CallMeBot free API)
  ('notify_whatsapp_enabled', '0'),
  ('notify_whatsapp_phone', ''),   -- international format, e.g. +2126XXXXXXXX
  ('notify_whatsapp_apikey', '');  -- from CallMeBot registration
