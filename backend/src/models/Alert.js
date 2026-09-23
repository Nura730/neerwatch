const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    clusterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cluster', required: true, unique: true },
    severity:  { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
    message:   { type: String, required: true },
    wardId:    { type: String, required: true },
    resolved:   { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
