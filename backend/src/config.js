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
  internalPort: Number(process.env.INTERNAL_PORT) || 9099,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mothsong',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',

  // Absolute paths used by the LFI target (#3).
  //   levelsDir : backend/levels
  //   the LFI flag lives TWO directories above levelsDir (i.e. the repo root),
  //   so only the `....//....//` double-strip bypass reaches it.
  levelsDir: path.join(__dirname, '..', 'levels'),
  uploadsDir: path.join(__dirname, '..', 'uploads'),

  flags,
  flagsPath: FLAGS_PATH,
};

module.exports = config;
