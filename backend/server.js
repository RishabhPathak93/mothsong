'use strict';

const config = require('./src/config');
const { connect } = require('./src/db');
const { createApp } = require('./src/app');
const { startInternalServer } = require('./src/internal/internalServer');

async function main() {
  await connect();

  // The public API. Render sets PORT; bind 0.0.0.0 so the platform can route to it.
  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[api] Mothsong backend listening on :${config.port} (${config.env})`);
    if (!config.flags.engagementId) {
      console.warn('[api] ⚠ flags not seeded — run `npm run seed` before an engagement.');
    }
  });

  // The private, loopback-only microservice (SSRF target #2).
  startInternalServer();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[api] fatal startup error:', err);
  process.exit(1);
});
