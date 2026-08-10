/**
 * Admin auth — single token, stored in DB settings. No JWT; just a cookie.
 * Cookie is HttpOnly + SameSite=Lax.
 */
const cookies = require('./cookies');
const db = require('./db');

const COOKIE_NAME = 'admin_sess';

function getToken() {
  const row = db.get('SELECT value FROM settings WHERE key = ?', ['admin_token']);
  return row?.value || 'JL@kudo92';
}

function isAuthed(req) {
  return cookies.parse(req)[COOKIE_NAME] === getToken();
}

function login(res, token) {
  cookies.setCookie(res, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
}

function logout(res) {
  cookies.clearCookie(res, COOKIE_NAME);
}

function requireAdmin(req, res, next) {
  if (isAuthed(req)) return next();
  if (req.accepts('html')) return res.redirect('/admin/login');
  return res.status(401).json({ error: 'auth required' });
}

module.exports = { isAuthed, login, logout, requireAdmin, getToken, COOKIE_NAME };
