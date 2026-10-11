const mongoose = require('mongoose');

/** Audit trail of important admin actions (catalogue, orders, refunds, users, content, settings). */
const adminActivitySchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, maxlength: 60, index: true },
    entity: { type: String, required: true, maxlength: 40, index: true },
    entityId: { type: String, maxlength: 64 },
    description: { type: String, maxlength: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 512 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminActivity', adminActivitySchema);
