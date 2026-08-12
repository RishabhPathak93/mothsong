'use strict';

/**
 * Seed script — run ONCE per engagement.
 *
 *   node scripts/seed.js
 *
 * What it does:
 *   1) Generates fresh, RANDOM flag values (flags are never hardcoded).
 *   2) Writes them to backend/data/flags.json (loaded by the server at boot; the RCE
 *      flag is mirrored into process.env.FLAG_RCE there).
 *   3) Drops the LFI flag file TWO directories above backend/levels/ so only the
 *      `....//....//` double-strip bypass reaches it.
 *   4) Seeds MongoDB with an admin account (random plaintext password, holding the
 *      auth-bypass flag in secretNote), a few sample drifters, and demo scores.
 *
 * Re-running rotates every flag and the admin password — good hygiene between cohorts.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('../src/config');
const { connect, mongoose } = require('../src/db');
const User = require('../src/models/User');
const Score = require('../src/models/Score');

function flag(label) {
  // e.g. MOTHSONG{auth_9f2c1b7ac4e83d55}
  return `MOTHSONG{${label}_${crypto.randomBytes(8).toString('hex')}}`;
}

function randomPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

async function main() {
  const engagementId = crypto.randomBytes(4).toString('hex');
  const flags = {
    engagementId,
    generatedAt: new Date().toISOString(),
    auth: flag('auth'),
    ssrf: flag('ssrf'),
    lfi: flag('lfi'),
    rce: flag('rce'),
  };

  // 1 + 2) Write flags.json (used by the running server).
  fs.mkdirSync(path.dirname(config.flagsPath), { recursive: true });
  fs.writeFileSync(config.flagsPath, JSON.stringify(flags, null, 2));
  console.log(`[seed] wrote ${config.flagsPath}`);

  // 3) LFI flag file: two directories ABOVE the levels folder.
  //    levelsDir/..      -> backend/
  //    levelsDir/../..   -> repo root (or Render service root)
  const lfiFlagPath = path.join(config.levelsDir, '..', '..', 'flag_lfi.txt');
  fs.writeFileSync(
    lfiFlagPath,
    `${flags.lfi}\n\nIf you can read this through /api/levels/asset, the "../" strip was not recursive.\n`
  );
  console.log(`[seed] wrote LFI flag to ${path.resolve(lfiFlagPath)}`);

  // 4) Seed the database.
  await connect();
  await User.deleteMany({});
  await Score.deleteMany({});

  const adminPassword = randomPassword();
  const admin = await User.create({
    username: 'admin',
    password: adminPassword, // plaintext, intentional (vuln #1)
    role: 'admin',
    secretNote: `Welcome back, curator. Grove master key: ${flags.auth}`,
    bestScore: 8120,
  });

  const demoUsers = [
    { username: 'lampwick', password: randomPassword(), bestScore: 6400 },
    { username: 'emberdrift', password: randomPassword(), bestScore: 5210 },
    { username: 'nocturne', password: randomPassword(), bestScore: 4790 },
    { username: 'gloamfern', password: randomPassword(), bestScore: 3980 },
  ];
  const created = await User.insertMany(demoUsers);

  const all = [admin, ...created];
  const scores = all.map((u) => ({
    userId: u._id,
    username: u.username,
    spores: u.bestScore,
    blooms: Math.round(u.bestScore / 900),
    seconds: 180 + Math.round(u.bestScore / 30),
  }));
  await Score.insertMany(scores);

  console.log('\n[seed] ───────────────────────────────────────────────');
  console.log(`[seed] engagement:   ${engagementId}`);
  console.log(`[seed] admin login:  admin / ${adminPassword}`);
  console.log('[seed] flags (keep these private — for the operator only):');
  console.log(`         #1 auth : ${flags.auth}`);
  console.log(`         #2 ssrf : ${flags.ssrf}`);
  console.log(`         #3 lfi  : ${flags.lfi}`);
  console.log(`         #4 rce  : ${flags.rce}`);
  console.log('[seed] ───────────────────────────────────────────────');
  console.log('[seed] done. Start the server, then `npm run verify` to confirm all chains.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
