'use strict';

const { mongoose } = require('../db');

/**
 * User model.
 *
 * ⚠️ TRAINING TARGET (vuln #1): `password` is stored in PLAINTEXT on purpose.
 * This keeps the NoSQL-injection auth-bypass realistic and reliable — the login
 * handler compares the raw request value directly against this field.
 *
 * ✅ REAL FIX (production): never store plaintext. Hash with bcrypt/argon2 and
 * compare with the library's constant-time verify:
 *     userSchema.pre('save', async function () {
 *       if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
 *     });
 * and in login: `await bcrypt.compare(String(req.body.password), user.password)`.
 * Hashing also structurally kills the `{ $ne: null }` bypass, because you can no
 * longer put the password into the query — you fetch by username, then verify.
 */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true }, // plaintext (intentional, see above)
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatarUrl: { type: String, default: '' },

    // Only populated on the admin account. Reading this is the reward for the
    // NoSQL auth-bypass (flag #1).
    secretNote: { type: String, default: '' },

    bestScore: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

userSchema.methods.publicProfile = function publicProfile() {
  return {
    id: this._id,
    username: this.username,
    role: this.role,
    avatarUrl: this.avatarUrl,
    bestScore: this.bestScore,
    createdAt: this.createdAt,
    // secretNote is deliberately surfaced to the account owner. For a normal user it
    // is empty; for admin it holds flag #1 — which you only reach by logging in as
    // admin, i.e. by exploiting the NoSQL injection.
    secretNote: this.secretNote || undefined,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
