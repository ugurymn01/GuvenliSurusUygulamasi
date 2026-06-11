const mongoose = require('mongoose');

const scoreEntrySchema = new mongoose.Schema(
  {
    score: { type: Number },
    reason: { type: String },
    change: { type: Number },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const driverProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  score: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  scoreHistory: {
    type: [scoreEntrySchema],
    default: []
  },
  totalTrips: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DriverProfile', driverProfileSchema);
