'use strict';

const express = require('express');
const User = require('../models/User');
const { sign, requireAuth, cookieOptions } = require('../middleware/auth');

const router = express.Router();

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VULN #1 — NoSQL injection → authentication bypass
 * ─────────────────────────────────────────────────────────────────────────────
 * The login handler drops `req.body.username` and `req.body.password` straight into
 * a Mongo query with NO type checking. Because express.json() parses JSON, a client
 * can send an *object* where a string is expected:
 *
 *     { "username": "admin", "password": { "$ne": null } }
 *
 * Mongo interprets `{ $ne: null }` as "password is not null", which is true for every
 * account, so findOne returns admin and you are logged in without the password.
 * Combined with plaintext storage (see User model), the bug is realistic and reliable.
 *
 * Try also: { "username": { "$gt": "" }, "password": { "$gt": "" } } → first user.
 *
 * ✅ REAL FIX:
 *   1) Coerce inputs to strings so operators can't be injected:
 *          const username = String(req.body.username || '');
 *          const password = String(req.body.password || '');
 *   2) Never put the secret in the query. Look the user up by username only, then
 *      verify a HASH in application code:
 *          const user = await User.findOne({ username });
 *          if (!user || !(await bcrypt.compare(password, user.password))) return 401;
 *   3) Optionally enable Mongo query sanitization (e.g. express-mongo-sanitize) to
 *      strip keys beginning with `$` or containing `.` as defence in depth.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (username === undefined || password === undefined) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    // ⚠️ VULNERABLE: no String() coercion — operator objects flow into the query.
    const user = await User.findOne({ username, password });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const token = sign(user);
    res.cookie('ms_token', token, cookieOptions());
    return res.json({ token, user: user.publicProfile() });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed', detail: String(err.message) });
  }
});

/**
 * Registration is written safely, as a contrast to /login. Inputs are coerced to
 * strings and uniqueness is enforced. (Passwords are still stored plaintext for this
 * training app, but the query itself cannot be injected.)
 */
router.post('/register', async (req, res) => {
  try {
    const username = String((req.body && req.body.username) || '').trim();
    const password = String((req.body && req.body.password) || '');
    if (username.length < 3 || password.length < 4) {
      return res
        .status(400)
        .json({ error: 'Username must be ≥3 chars and password ≥4 chars.' });
    }
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'That name is already taken.' });

    const user = await User.create({ username, password, role: 'user' });
    const token = sign(user);
    res.cookie('ms_token', token, cookieOptions());
    return res.status(201).json({ token, user: user.publicProfile() });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed', detail: String(err.message) });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('ms_token', cookieOptions());
  return res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: user.publicProfile() });
});

module.exports = router;
