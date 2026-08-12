'use strict';

const http = require('http');
const config = require('../config');

/**
 * The "private microservice".
 *
 * This is a SECOND HTTP server bound to 127.0.0.1 only. On Render (and in Docker) a
 * loopback-bound listener is reachable from inside the container but NEVER exposed to
 * the internet — exactly like an internal service on a private network or a cloud
 * metadata endpoint. It requires no auth (internal services often assume the network
 * is the boundary — that assumption is what SSRF breaks).
 *
 * There is no link to it anywhere in the frontend. The only way to read its response
 * is to make the PUBLIC backend fetch it on your behalf via the SSRF hole in
 * /api/profile/avatar-import (vuln #2).
 */
function startInternalServer() {
  const server = http.createServer((req, res) => {
    if (req.url && req.url.startsWith('/internal/v1/service/identity')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
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
        )
      );
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
