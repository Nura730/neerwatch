const mongoose = require('mongoose');

const fieldTaskSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    wardId:      { type: String, required: true },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    priority: {
      type:     String,
      enum:     ['low', 'medium', 'high', 'critical'],
      required: true,
      default:  'medium',
    },
    status: {
      type:     String,
      enum:     ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
      required: true,
      default:  'pending',
    },
    assignedTo:          { type: String,   default: null },
    sourceObservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Observation', default: null },
    dueAt:               { type: Date,     default: null },
    completedAt:         { type: Date,     default: null },
  },
  { timestamps: true }
);

fieldTaskSchema.index({ wardId: 1, status: 1 });
fieldTaskSchema.index({ priority: 1, status: 1 });
fieldTaskSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('FieldTask', fieldTaskSchema);
