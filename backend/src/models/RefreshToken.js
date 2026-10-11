const mongoose = require('mongoose');

/**
 * A refresh-token session. Only a SHA-256 hash of the raw token is stored.
 * `family` groups every token produced by rotation from one login, so reuse of an
 * already-rotated token can revoke the whole chain (token theft detection).
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, maxlength: 512 },
    ipAddress: { type: String, maxlength: 64 },
    lastUsedAt: Date,
  },
  { timestamps: true },
);

// MongoDB removes sessions automatically one day after they expire.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

refreshTokenSchema.virtual('isActive').get(function isActive() {
  return !this.revokedAt && this.expiresAt > new Date();
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
