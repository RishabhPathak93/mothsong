'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const multer = require('multer');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Store uploaded mods on disk (Render provides a persistent process/disk — this is
// why the backend can't be pure serverless).
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadsDir),
  filename: (req, file, cb) => {
    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${req.user.sub}_${safeBase}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 256 * 1024 },
  fileFilter: (req, file, cb) => {
    // Only .js "level mods" are accepted. (This does not make execution safe — see below.)
    if (!file.originalname.endsWith('.js')) return cb(new Error('Only .js mods are accepted.'));
    cb(null, true);
  },
});

/**
 * Upload a custom "level mod". Auth required. Files are named with the uploader's id,
 * but note the apply endpoint below never checks that binding.
 */
router.post('/upload', requireAuth, upload.single('mod'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No mod file received.' });
  return res.status(201).json({
    ok: true,
    file: req.file.filename,
    bytes: req.file.size,
    note: 'Uploaded. Mods are reviewed before they appear in your level list.',
  });
});

// List the caller's own uploaded mods (the intended, visible surface).
router.get('/mine', requireAuth, (req, res) => {
  let files = [];
  try {
    files = fs
      .readdirSync(config.uploadsDir)
      .filter((f) => f.includes(`_${req.user.sub}_`))
      .map((f) => ({ file: f }));
  } catch (_e) {
    /* ignore */
  }
  return res.json({ mods: files });
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VULN #4 — Arbitrary file upload → Remote Code Execution
 * ─────────────────────────────────────────────────────────────────────────────
 * This endpoint is undocumented and NOT linked anywhere in the UI. It requires only
 * that the caller be logged in — there is NO ownership check, so any authenticated
 * user can load ANY uploaded file by name, including one they just uploaded.
 *
 * The file's contents are executed server-side in a Node `vm` context that exposes
 * `require`, `process`, `module`, `console`, and `Buffer`. `vm` is NOT a security
 * boundary; handing it real `require`/`process` means the "mod" runs with the full
 * privileges of the server process. So an uploaded mod like:
 *
 *     module.exports = process.env.FLAG_RCE;          // read the flag from env
 *     // or: module.exports = require('fs').readFileSync('/etc/hostname','utf8');
 *
 * yields genuine code execution and returns flag #4 (which config.js mirrors from
 * data/flags.json into process.env.FLAG_RCE at boot).
 *
 * ✅ REAL FIX:
 *   1) NEVER execute uploaded content. Treat "mods" as data (JSON), validated against
 *      a strict schema, and interpret them with your own safe runtime — no code.
 *   2) If you truly must run untrusted code, do it in a real sandbox: a separate
 *      process with dropped privileges, seccomp/AppArmor, no network, no filesystem,
 *      strict CPU/memory/time limits (isolated-vm, a WASM runtime, gVisor, Firecracker).
 *      `vm`/`vm2` alone are not sufficient.
 *   3) Enforce ownership + authorization on every object reference (this endpoint
 *      should at minimum verify the file belongs to req.user.sub) to prevent IDOR.
 *   4) Validate upload type by content, store outside the web root, and never trust
 *      the extension.
 */
router.post('/apply', requireAuth, (req, res) => {
  const fileName = String((req.body && req.body.file) || '');
  if (!fileName) return res.status(400).json({ error: 'A mod file name is required.' });

  // ⚠️ VULNERABLE: basename only prevents traversal here, but there is NO check that
  // the file was uploaded by this user (IDOR), and the contents are then executed.
  const target = path.join(config.uploadsDir, path.basename(fileName));
  let code;
  try {
    code = fs.readFileSync(target, 'utf8');
  } catch (_e) {
    return res.status(404).json({ error: 'Mod not found.' });
  }

  const logs = [];
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: { log: (...a) => logs.push(a.map(String).join(' ')) },
    // ⚠️ VULNERABLE: exposing the real require/process/Buffer makes this full RCE.
    require,
    process,
    Buffer,
    __dirname: config.uploadsDir,
  };
  sandbox.exports = sandbox.module.exports;

  try {
    vm.runInNewContext(code, sandbox, { timeout: 2000, filename: 'mod.js' });
    let result = sandbox.module.exports;
    if (typeof result === 'function') result = String(result);
    return res.json({ ok: true, applied: path.basename(fileName), result, logs });
  } catch (err) {
    return res.status(500).json({ error: 'Mod failed to run.', detail: String(err.message), logs });
  }
});

module.exports = router;
