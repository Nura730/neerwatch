const mongoose = require('mongoose');

const observationSchema = new mongoose.Schema(
  {
    clientId:    { type: String, required: true, unique: true, index: true },
    householdId: { type: String, required: true },
    testType:    { type: String, enum: ['TDS', 'pH', 'turbidity', 'coliform'], required: true },
    result:      { type: Number, required: true },
    testedAt:    { type: Date,   required: true },
    location: {
      type:        { type: String, enum: ['Point'] },
      coordinates: [Number],
    },
    wardId: { type: String, required: true },
  },
  { timestamps: true }
);

// Sparse so documents without location are not indexed
observationSchema.index({ location: '2dsphere' }, { sparse: true });

module.exports = mongoose.model('Observation', observationSchema);
