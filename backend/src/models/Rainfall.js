const mongoose = require('mongoose');

const rainfallSchema = new mongoose.Schema({
  wardId:      { type: String, required: true },
  rainfallMm:  { type: Number, required: true },
  recordedAt:  { type: Date, required: true },
});

rainfallSchema.index({ wardId: 1, recordedAt: 1 }, { unique: true });

module.exports = mongoose.model('Rainfall', rainfallSchema);
