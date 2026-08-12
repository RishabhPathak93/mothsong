'use strict';

const { mongoose } = require('../db');

const scoreSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    spores: { type: Number, default: 0 }, // light collected
    blooms: { type: Number, default: 0 }, // signature-moment triggers
    seconds: { type: Number, default: 0 }, // time spent drifting
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

scoreSchema.index({ spores: -1, createdAt: 1 });

module.exports = mongoose.models.Score || mongoose.model('Score', scoreSchema);
