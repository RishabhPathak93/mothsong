'use strict';

/**
 * Central configuration + flag loading.
 *
 * Flags are NOT hardcoded. `scripts/seed.js` generates randomized flag values per
 * engagement and writes them to backend/data/flags.json. This module loads that file
 * at boot so the routes can serve the current run's flags, and mirrors the RCE flag
 * into process.env so the file-upload/RCE target (#4) can read it from the environment.
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config();

const FLAGS_PATH = path.join(__dirname, '..', 'data', 'flags.json');

let flags = { auth: null, ssrf: null, lfi: null, rce: null, engagementId: null };
try {
  const raw = fs.readFileSync(FLAGS_PATH, 'utf8');
  flags = { ...flags, ...JSON.parse(raw) };
  // Mirror the RCE flag into the process environment so the vm sandbox target can
  // read it via process.env.FLAG_RCE (an "env var or filesystem" source, per spec).
  if (flags.rce && !process.env.FLAG_RCE) process.env.FLAG_RCE = flags.rce;
} catch (_e) {
  // No flags file yet — seed script hasn't been run. Routes will report this.
  // eslint-disable-next-line no-console
  console.warn(
    '[config] No data/flags.json found. Run `npm run seed` to generate per-engagement flags.'
  );
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || 4000,
  internalPort: Number(process.env.INTERNAL_PORT) || 8000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mothsong',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',

  // Absolute paths used by the LFI target (#3).
  //   levelsDir  : backend/game/content/assets/levels   (nested 4 deep under backend)
  //   lfiFlagPath: backend/var/www/html/flag_lfi.txt
  //
  // The flag lives in a fake web-root, exactly where
  //   levelsDir + "../../../../var/www/html/flag_lfi.txt"
  // resolves. Because the sanitizer strips "../" only once (non-recursively), the
  // intended payload is:
  //   ....//....//....//....//var/www/html/flag_lfi.txt
  // The four "....//" collapse to four "../", climbing levels→assets→content→game→backend,
  // then descend into var/www/html. Fewer segments, or a raw (already-"../") path, miss it.
  levelsDir: path.join(__dirname, '..', 'game', 'content', 'assets', 'levels'),
  uploadsDir: path.join(__dirname, '..', 'uploads'),
  lfiFlagPath: path.join(__dirname, '..', 'var', 'www', 'html', 'flag_lfi.txt'),

  flags,
  flagsPath: FLAGS_PATH,
};

module.exports = config;
