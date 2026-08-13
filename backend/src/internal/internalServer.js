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
 * It listens on port 8000 — a very common internal/dev port that appears in every
 * standard SSRF payload list — and it serves the identity metadata (with the flag) at
 * the ROOT path. So the intended discovery is: recognise the avatar-import SSRF, then
 * point it at a default loopback payload — `http://127.0.0.1:8000/` — and read the
 * reflected body. No deep, unguessable path to brute-force; the challenge is the SSRF
 * itself + finding the port with a standard wordlist.
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
    // SSRF payload against port 8000 lands on it directly.
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

  server.listen(config.internalPort, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(
      `[internal] private microservice on http://127.0.0.1:${config.internalPort} (loopback only)`
    );
  });
  return server;
}

module.exports = { startInternalServer };
