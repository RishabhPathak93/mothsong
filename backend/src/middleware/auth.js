'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Auth is a signed JWT delivered two ways so the app works across the Vercel↔Render
 * split as well as same-origin dev:
 *   1) httpOnly cookie `ms_token` (used by the browser automatically), and
 *   2) `Authorization: Bearer <token>` header (used as a fallback + by scripts).
 *
 * Note: authentication here is genuine (the token is signed & verified). The planted
 * bugs are in *authorization* and in specific handlers — e.g. the mod-apply endpoint
 * (#4) checks only that you are logged in, never that you own the file you load.
 */
function sign(user) {
  return jwt.sign(
    { sub: String(user._id), username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.ms_token) return req.cookies.ms_token;
  return null;
}

function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (_e) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function cookieOptions() {
  // Cross-site (Vercel → Render) requires SameSite=None; Secure in production.
  // In dev over http://localhost these must be Lax + non-secure or the browser drops them.
  return config.isProd
    ? { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 3600 * 1000 }
    : { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 };
}

module.exports = { sign, requireAuth, cookieOptions };
