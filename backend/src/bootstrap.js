'use strict';

/**
 * Boot-time seeding — designed for free-tier hosts with NO shell and an EPHEMERAL
 * filesystem (e.g. Render free).
 *
 * The four flags are generated ONCE and persisted in MongoDB (Atlas is durable), in a
 * tiny `flagdocs` collection. On every boot the server:
 *   • loads the existing flags from Atlas (or generates + stores them on first boot), and
 *   • re-materialises the local artifacts the routes depend on — data/flags.json, the LFI
 *     flag file two dirs above levels/, and process.env.FLAG_RCE — because those live on
 *     the ephemeral disk and would otherwise vanish on restart.
 *
 * Result: start command is just `node server.js`. No shell, no manual seed step, and the
 * flags stay identical across restarts for the whole engagement. `scripts/seed.js` still
 * exists to force-ROTATE the flags (new engagement / new cohort).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./config');
const { mongoose } = require('./db');
const User = require('./models/User');
const Score = require('./models/Score');

const flagSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'engagement' },
    engagementId: String,
    auth: String,
    ssrf: String,
    lfi: String,
    rce: String,
    adminPassword: String,
    generatedAt: Date,
  },
  { versionKey: false }
);
const FlagDoc = mongoose.models.FlagDoc || mongoose.model('FlagDoc', flagSchema);

const mkFlag = (label) => `MOTHSONG{${label}_${crypto.randomBytes(8).toString('hex')}}`;
const mkPass = () => crypto.randomBytes(12).toString('base64url');

function newFlags() {
  return {
    engagementId: crypto.randomBytes(4).toString('hex'),
    generatedAt: new Date(),
    auth: mkFlag('auth'),
    ssrf: mkFlag('ssrf'),
    lfi: mkFlag('lfi'),
    rce: mkFlag('rce'),
    adminPassword: mkPass(),
  };
}

// Re-materialise every local artifact the routes read, from the durable flag values.
function applyFlags(flags) {
  // Mutate the shared config.flags object so live handlers (internal service, etc.) see it.
  config.flags.engagementId = flags.engagementId;
  config.flags.auth = flags.auth;
  config.flags.ssrf = flags.ssrf;
  config.flags.lfi = flags.lfi;
  config.flags.rce = flags.rce;

  fs.mkdirSync(path.dirname(config.flagsPath), { recursive: true });
  fs.writeFileSync(
    config.flagsPath,
    JSON.stringify(
      {
        engagementId: flags.engagementId,
        generatedAt: flags.generatedAt,
        auth: flags.auth,
        ssrf: flags.ssrf,
        lfi: flags.lfi,
        rce: flags.rce,
      },
      null,
      2
    )
  );

  // LFI flag file: two directories above backend/levels/.
  const lfiPath = path.join(config.levelsDir, '..', '..', 'flag_lfi.txt');
  fs.writeFileSync(
    lfiPath,
    `${flags.lfi}\n\nIf you can read this through /api/levels/asset, the "../" strip was not recursive.\n`
  );

  // RCE flag from an env var (the vm target reads process.env.FLAG_RCE).
  process.env.FLAG_RCE = flags.rce;
}

async function seedUsers(flags) {
  const admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    await User.create({
      username: 'admin',
      password: flags.adminPassword, // plaintext, intentional (vuln #1)
      role: 'admin',
      secretNote: `Welcome back, curator. Grove master key: ${flags.auth}`,
      bestScore: 8120,
    });
    const demo = [
      { username: 'lampwick', password: mkPass(), bestScore: 6400 },
      { username: 'emberdrift', password: mkPass(), bestScore: 5210 },
      { username: 'nocturne', password: mkPass(), bestScore: 4790 },
      { username: 'gloamfern', password: mkPass(), bestScore: 3980 },
    ];
    const created = await User.insertMany(demo);
    const adminDoc = await User.findOne({ username: 'admin' });
    const all = [adminDoc, ...created];
    await Score.insertMany(
      all.map((u) => ({
        userId: u._id,
        username: u.username,
        spores: u.bestScore,
        blooms: Math.round(u.bestScore / 900),
        seconds: 180 + Math.round(u.bestScore / 30),
      }))
    );
  } else if (!admin.secretNote || admin.secretNote.indexOf(flags.auth) === -1) {
    // keep the note in sync if flags were rotated
    admin.secretNote = `Welcome back, curator. Grove master key: ${flags.auth}`;
    await admin.save();
  }
}

/**
 * Ensure the engagement is seeded.
 *   force:false → load existing flags, or generate on first boot (idempotent).
 *   force:true  → rotate: wipe flags + users + scores and generate fresh ones.
 */
async function ensureSeeded({ force = false } = {}) {
  let doc = force ? null : await FlagDoc.findById('engagement');
  let generated = false;

  if (!doc) {
    if (force) {
      await Promise.all([FlagDoc.deleteMany({}), User.deleteMany({}), Score.deleteMany({})]);
    }
    doc = await FlagDoc.findOneAndUpdate({ _id: 'engagement' }, newFlags(), {
      upsert: true,
      new: true,
    });
    generated = true;
  }

  const flags = {
    engagementId: doc.engagementId,
    generatedAt: doc.generatedAt,
    auth: doc.auth,
    ssrf: doc.ssrf,
    lfi: doc.lfi,
    rce: doc.rce,
    adminPassword: doc.adminPassword,
  };

  applyFlags(flags);
  await seedUsers(flags);
  return { flags, generated };
}

module.exports = { ensureSeeded };
