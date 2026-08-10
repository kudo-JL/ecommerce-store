/**
 * Database layer — uses node:sqlite (built-in, Node 22+ experimental / Node 24 stable).
 * Falls back to better-sqlite3 ONLY if node:sqlite is unavailable, so the app
 * still boots on older runtimes.
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'store.db');

let db;
let usingFallback = false;

async function load() {
  if (db) return db;

  // Prefer the built-in node:sqlite
  try {
    const sqlite = require('node:sqlite');
    db = new sqlite.DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    return db;
  } catch (e) {
    usingFallback = true;
    console.warn('[db] node:sqlite unavailable, falling back to better-sqlite3:', e.message);
    const Better = require('better-sqlite3');
    db = new Better(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return db;
  }
}

/* ---------- helpers (work for both backends) ---------- */
function all(sql, params = []) {
  if (usingFallback) return db.prepare(sql).all(...params);
  return db.prepare(sql).all(...params);
}
function get(sql, params = []) {
  if (usingFallback) return db.prepare(sql).get(...params);
  return db.prepare(sql).get(...params);
}
function run(sql, params = []) {
  if (usingFallback) {
    const r = db.prepare(sql).run(...params);
    return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
  }
  const r = db.prepare(sql).run(...params);
  return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
}
function exec(sql) {
  if (usingFallback) return db.exec(sql);
  return db.exec(sql);
}

module.exports = { load, all, get, run, exec, DB_PATH, usingFallback };
