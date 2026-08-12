'use strict';

const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: user.publicProfile() });
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VULN #2 — Server-Side Request Forgery (SSRF) via avatar import
 * ─────────────────────────────────────────────────────────────────────────────
 * A logged-in user can "import" an avatar from a URL. The server fetches whatever URL
 * it is given, server-side, with NO allowlist and NO IP/host validation. When the
 * fetched resource is not an image, the handler helpfully echoes a chunk of the
 * response body back in a debug field — so an attacker can read the response of an
 * internal-only endpoint through the server.
 *
 * The intended target is the private microservice bound to 127.0.0.1 (see
 * src/internal/internalServer.js), which is NOT reachable from the public internet
 * but IS reachable from the backend process:
 *
 *     POST /api/profile/avatar-import
 *     { "url": "http://127.0.0.1:<INTERNAL_PORT>/internal/v1/service/identity" }
 *
 * The internal service returns JSON containing flag #2; because JSON isn't an image,
 * the `debug.bodyPreview` field leaks it straight back to the attacker.
 *
 * ✅ REAL FIX (defence in depth — apply several):
 *   1) Resolve the hostname and REJECT private/loopback/link-local ranges
 *      (127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7) and
 *      re-check after every redirect (DNS-rebinding-safe: pin the resolved IP).
 *   2) Enforce an allowlist of schemes (https only) and, ideally, of hosts.
 *   3) Never reflect fetched response bodies back to the client.
 *   4) Fetch with a hard timeout + max size, and validate Content-Type is image/*
 *      BEFORE doing anything with the body; store the bytes, don't echo them.
 *   5) Route outbound fetches through an egress proxy that blocks internal ranges.
 */
router.post('/avatar-import', requireAuth, async (req, res) => {
  const url = String((req.body && req.body.url) || '');
  if (!url) return res.status(400).json({ error: 'A url is required.' });

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_e) {
    return res.status(400).json({ error: 'That does not look like a valid URL.' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only http/https URLs are supported.' });
  }

  // ⚠️ VULNERABLE: no allowlist, no private-IP check — fetches anything, including
  // loopback / internal hosts.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const upstream = await fetch(parsed.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mothsong-AvatarBot/1.0' },
    });
    clearTimeout(timer);

    const contentType = upstream.headers.get('content-type') || 'unknown';
    const buf = Buffer.from(await upstream.arrayBuffer());

    if (contentType.startsWith('image/')) {
      // Happy path: store as a data URL so the avatar renders anywhere.
      const dataUrl = `data:${contentType};base64,${buf.toString('base64')}`;
      await User.findByIdAndUpdate(req.user.sub, { avatarUrl: dataUrl });
      return res.json({ ok: true, contentType, bytes: buf.length });
    }

    // ⚠️ VULNERABLE: reflects fetched body back to the caller in an error/debug field.
    return res.status(422).json({
      error: 'That URL did not return an image.',
      debug: {
        status: upstream.status,
        contentType,
        bytes: buf.length,
        // The reflected body is what turns a blind SSRF into a readable one.
        bodyPreview: buf.slice(0, 2048).toString('utf8'),
      },
    });
  } catch (err) {
    return res
      .status(502)
      .json({ error: 'Could not fetch that URL.', detail: String(err.message) });
  }
});

module.exports = router;
