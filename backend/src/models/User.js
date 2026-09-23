const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false keeps password out of every query result unless explicitly requested
    password: { type: String, required: true, select: false },
    role:     { type: String, enum: ['admin', 'operator', 'viewer'], required: true, default: 'viewer' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
