'use strict';

const config = require('./src/config');
const { connect } = require('./src/db');
const { createApp } = require('./src/app');
const { startInternalServer } = require('./src/internal/internalServer');
const { ensureSeeded } = require('./src/bootstrap');

function banner(flags, generated) {
  // Printed to the host's logs — this is the operator's private answer key. On free
  // tiers with no shell, the Render/host "Logs" tab is where you read these.
  /* eslint-disable no-console */
  console.log('\n[flags] ─────────────────────────────────────────────');
  console.log(`[flags] engagement:  ${flags.engagementId}  ${generated ? '(newly generated)' : '(loaded from Atlas)'}`);
  console.log(`[flags] admin login: admin / ${flags.adminPassword}`);
  console.log(`[flags]   #1 auth : ${flags.auth}`);
  console.log(`[flags]   #2 ssrf : ${flags.ssrf}`);
  console.log(`[flags]   #3 lfi  : ${flags.lfi}`);
  console.log(`[flags]   #4 rce  : ${flags.rce}`);
  console.log('[flags] ─────────────────────────────────────────────\n');
  /* eslint-enable no-console */
}

async function main() {
  await connect();

  // Seed on first boot, or restore the same flags from Atlas on every subsequent boot.
  // Durable across restarts / spin-downs, no shell required.
  const { flags, generated } = await ensureSeeded();
  banner(flags, generated);

  // The public API. Render sets PORT; bind 0.0.0.0 so the platform can route to it.
  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[api] Mothsong backend listening on :${config.port} (${config.env})`);
  });

  // The private, loopback-only microservice (SSRF target #2).
  startInternalServer();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[api] fatal startup error:', err);
  process.exit(1);
});
