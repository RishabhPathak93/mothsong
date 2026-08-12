'use strict';

const express = require('express');
const Score = require('../models/Score');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public: top drifters by spores collected.
router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const top = await Score.find({})
    .sort({ spores: -1, seconds: 1, createdAt: 1 })
    .limit(limit)
    .lean();
  return res.json({
    entries: top.map((s, i) => ({
      rank: i + 1,
      username: s.username,
      spores: s.spores,
      blooms: s.blooms,
      seconds: s.seconds,
      at: s.createdAt,
    })),
  });
});

// Submit a run. Inputs are clamped so the leaderboard stays honest-ish.
router.post('/', requireAuth, async (req, res) => {
  const spores = Math.max(0, Math.min(Number(req.body.spores) || 0, 100000));
  const blooms = Math.max(0, Math.min(Number(req.body.blooms) || 0, 10000));
  const seconds = Math.max(0, Math.min(Number(req.body.seconds) || 0, 86400));

  const entry = await Score.create({
    userId: req.user.sub,
    username: req.user.username,
    spores,
    blooms,
    seconds,
  });

  // Track a personal best on the user doc for the profile screen.
  const user = await User.findById(req.user.sub);
  if (user && spores > user.bestScore) {
    user.bestScore = spores;
    await user.save();
  }

  return res.status(201).json({ ok: true, id: entry._id });
});

module.exports = router;
