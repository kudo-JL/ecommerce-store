/**
 * Tiny cookie helper — avoids pulling in cookie-parser.
 * Stores the cart as a JSON cookie. For an admin cookie we store a simple flag.
 */
function parse(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    out[k] = v;
  }
  return out;
}

function serialize(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

function setCookie(res, name, value, opts = {}) {
  res.setHeader('Set-Cookie', serialize(name, value, { path: '/', ...opts }));
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', serialize(name, '', { path: '/', maxAge: 0 }));
}

module.exports = { parse, setCookie, clearCookie, serialize };
