'use strict';

const http = require('http');
const config = require('../config');

/**
 * The "private microservice".
 *
 * A SECOND HTTP server bound to 127.0.0.1 only. On Render (and in Docker) a loopback
 * listener is reachable from inside the container but NEVER exposed to the internet —
 * exactly like an internal service on a private network or a cloud metadata endpoint.
 * No auth (internal services often assume the network is the boundary — that assumption
 * is what SSRF breaks).
 *
 * It listens on port 80 — the default HTTP port — and serves the identity metadata
 * (with the flag) at the ROOT path. So the intended discovery is the simplest possible
 * loopback SSRF payload: `http://127.0.0.1/` (no port needed at all). No deep path to
 * brute-force, nothing unpredictable; the challenge is recognising the SSRF itself.
 *
 * ⚠ Port 80 is privileged (<1024) and needs root to bind. Locally that's usually fine;
 * on some hosts the process runs unprivileged and binding 80 fails with EACCES — see the
 * error handler below. If that happens, set INTERNAL_PORT to an unprivileged predictable
 * port (e.g. 8080) and the payload becomes `http://127.0.0.1:8080/`.
 *
 * There is no link to it anywhere in the frontend. The only way to read its response is
 * to make the PUBLIC backend fetch it via the SSRF hole in /api/profile/avatar-import.
 */
function startInternalServer() {
  const identity = () =>
    JSON.stringify(
      {
        service: 'mothsong-identity',
        region: 'internal-1',
        note: 'Private service. If you are reading this from outside the cluster, an SSRF got you here.',
        credentials: {
          accessKeyId: 'AKIA' + 'INTERNALEXAMPLE',
          secretAccessKey: 'do-not-ship-real-secrets-in-training-apps',
        },
        flag: config.flags.ssrf || 'MOTHSONG{flags-not-seeded — run npm run seed}',
      },
      null,
      2
    );

  const server = http.createServer((req, res) => {
    const path = (req.url || '/').split('?')[0];
    // Serve the flag at the root and a couple of conventional aliases, so a default
    // SSRF payload against port 80 (http://127.0.0.1/) lands on it directly.
    if (
      path === '/' ||
      path === '/identity' ||
      path === '/internal/v1/service/identity' ||
      path === '/latest/meta-data/identity'
    ) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(identity());
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal: not found' }));
  });

  // Don't let a bind failure crash the whole backend — log a clear, actionable warning.
  server.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error(
      `[internal] could NOT bind 127.0.0.1:${config.internalPort} — ${err.code}. ` +
        (err.code === 'EACCES'
          ? 'Port <1024 needs root on this host. Set INTERNAL_PORT=8080 (and use http://127.0.0.1:8080/) to fix. '
          : '') +
        'SSRF flag (#2) is DOWN until the internal service is reachable.'
    );
  });

  server.listen(config.internalPort, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(
      `[internal] private microservice on http://127.0.0.1:${config.internalPort} (loopback only)`
    );
  });
  return server;
}

module.exports = { startInternalServer };
