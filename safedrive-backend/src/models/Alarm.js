const mongoose = require('mongoose');

const alarmSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  type: {
    type: String,
    enum: [
      'HARD_BRAKE',
      'SHARP_TURN',
      'RAPID_ACCELERATION',
      'VIBRATION',
      'SPEED_LIMIT_EXCEEDED'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  value: {
    type: Number
  },
  speedLimit: {
    type: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  resolved: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Alarm', alarmSchema);
