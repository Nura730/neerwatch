const mongoose = require('mongoose');

const clusterSchema = new mongoose.Schema({
  testType:         { type: String, enum: ['TDS', 'pH', 'turbidity', 'coliform'], required: true },
  centroid: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
  },
  radiusMetres:     { type: Number, default: 500 },
  observationCount: { type: Number, required: true },
  failureRate:      { type: Number, required: true },
  windowStart:      { type: Date, required: true },
  windowEnd:        { type: Date, required: true },
  wardId:           { type: String, required: true },
  detectedAt:       { type: Date, default: Date.now },
  active:           { type: Boolean, default: true },
});

module.exports = mongoose.model('Cluster', clusterSchema);
