'use strict';

/**
 * Seed / ROTATE script.
 *
 *   node scripts/seed.js
 *
 * The server now seeds itself on first boot (see src/bootstrap.js), so you usually don't
 * need this. Use it to deliberately ROTATE every flag + the admin password between
 * cohorts. It wipes the flag doc, users, and scores, generates fresh values, and prints
 * the new answer key.
 *
 * Run it locally against the same MONGO_URI your deployment uses, then restart the
 * service (or just let the next boot load the rotated flags from Atlas).
 */

const { connect, mongoose } = require('../src/db');
const { ensureSeeded } = require('../src/bootstrap');

async function main() {
  await connect();
  const { flags } = await ensureSeeded({ force: true });

  console.log('\n[seed] ─────────────────────────────────────────────');
  console.log(`[seed] engagement:  ${flags.engagementId}  (rotated)`);
  console.log(`[seed] admin login: admin / ${flags.adminPassword}`);
  console.log('[seed] flags (operator answer key — keep private):');
  console.log(`         #1 auth : ${flags.auth}`);
  console.log(`         #2 ssrf : ${flags.ssrf}`);
  console.log(`         #3 lfi  : ${flags.lfi}`);
  console.log(`         #4 rce  : ${flags.rce}`);
  console.log('[seed] ─────────────────────────────────────────────');
  console.log('[seed] Restart the service to load the rotated flags, then `npm run verify`.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
