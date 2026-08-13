'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const router = express.Router();

// List the built-in levels (safe — reads directory contents only).
router.get('/', (req, res) => {
  let files = [];
  try {
    files = fs
      .readdirSync(config.levelsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ name: f, id: f.replace(/\.json$/, '') }));
  } catch (_e) {
    /* levels dir missing */
  }
  return res.json({ levels: files });
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VULN #3 — Local File Inclusion / path traversal (incomplete sanitization)
 * ─────────────────────────────────────────────────────────────────────────────
 * Level data is loaded by filename from a query parameter:
 *     GET /api/levels/asset?name=grove.json
 *
 * There IS a sanitization attempt — but it strips "../" exactly once and is not
 * recursive, so a nested payload survives the strip and reassembles into a working
 * traversal AFTER the replace runs:
 *
 *     "....//....//....//....//var/www/html/flag_lfi.txt"
 *        --.replace(/\.\.\//g, '') collapses each "....//" into one "../"-->
 *     "../../../../var/www/html/flag_lfi.txt"
 *
 * levelsDir is nested backend/game/content/assets/levels, so the four "../" climb
 * levels→assets→content→game→backend, then descend into the fake web-root var/www/html/
 * where the flag lives. A shallower payload, or a raw already-"../" path (→ stripped to
 * nothing), both fail; only this specific double-strip bypass reaches the flag.
 *
 * ✅ REAL FIX:
 *   1) Don't sanitize by blocklist — resolve and CONTAIN. Normalize the final path
 *      and verify it stays inside levelsDir:
 *          const resolved = path.resolve(config.levelsDir, name);
 *          if (!resolved.startsWith(path.resolve(config.levelsDir) + path.sep)) return 400;
 *   2) Better still, never accept a path at all: map an allowlisted id → known file,
 *      e.g. `const file = LEVELS[name]; if (!file) return 404;`
 *   3) Strip to a basename and reject anything with separators:
 *          if (name.includes('/') || name.includes('\\') || name.includes('..')) return 400;
 */
router.get('/asset', (req, res) => {
  const raw = String(req.query.name || '');
  if (!raw) return res.status(400).json({ error: 'A level name is required.' });

  // ⚠️ VULNERABLE: single, non-recursive strip of "../". Looks reasonable, isn't.
  const sanitized = raw.replace(/\.\.\//g, '');

  // Note we intentionally do NOT re-check containment after joining.
  const target = path.join(config.levelsDir, sanitized);

  fs.readFile(target, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({
        error: 'Level not found.',
        // Small hint surface, as many real apps accidentally leak.
        requested: sanitized,
      });
    }
    // Try to serve JSON as JSON; otherwise return raw text (this is what lets the
    // traversal read the flag file, which is plain text).
    try {
      return res.json(JSON.parse(data));
    } catch (_e) {
      res.type('text/plain');
      return res.send(data);
    }
  });
});

module.exports = router;
