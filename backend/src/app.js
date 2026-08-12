'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const levelRoutes = require('./routes/levels');
const modRoutes = require('./routes/mods');
const leaderboardRoutes = require('./routes/leaderboard');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  /**
   * CORS across the Vercel↔Render split.
   * `origin` must be the EXACT frontend URL and `credentials: true` is required for
   * the httpOnly cookie to be sent/accepted cross-site. This must line up with the
   * cookie's SameSite=None; Secure attributes (see middleware/auth.js) in production.
   */
  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) =>
    res.json({
      ok: true,
      service: 'mothsong-backend',
      env: config.env,
      flagsSeeded: Boolean(config.flags.engagementId),
      engagementId: config.flags.engagementId || null,
      time: new Date().toISOString(),
    })
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/levels', levelRoutes);
  app.use('/api/mods', modRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Multer + misc errors land here.
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
  });

  return app;
}

module.exports = { createApp };
