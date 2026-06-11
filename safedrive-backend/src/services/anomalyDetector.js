const SensorData = require('../models/SensorData');
const DriverProfile = require('../models/DriverProfile');

// Alarm türüne göre skor cezası (puan)
const SCORE_PENALTIES = {
  HARD_BRAKE: 10,
  SHARP_TURN: 7,
  RAPID_ACCELERATION: 5,
  VIBRATION: 3,
  SPEED_LIMIT_EXCEEDED: 8
};

// Standart sapma hesaplama (popülasyon standart sapması)
const standardDeviation = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

/**
 * Verilen sensör verisini analiz eder ve bir anomali tespit ederse
 * { type, severity, value } objesi, aksi halde null döner.
 * @param {Object} sensorData - Kaydedilmiş SensorData dökümanı
 */
const detectAnomaly = async (sensorData) => {
  const accel = sensorData.accelerometer || {};
  const gyro = sensorData.gyroscope || {};

  // Ani fren
  if (typeof accel.x === 'number' && accel.x < -8) {
    return {
      type: 'HARD_BRAKE',
      severity: 'critical',
      value: accel.x
    };
  }

  // Ani hızlanma
  if (typeof accel.x === 'number' && accel.x > 10) {
    return {
      type: 'RAPID_ACCELERATION',
      severity: 'high',
      value: accel.x
    };
  }

  // Sert dönüş
  if (typeof gyro.gamma === 'number' && (gyro.gamma > 150 || gyro.gamma < -150)) {
    return {
      type: 'SHARP_TURN',
      severity: 'high',
      value: gyro.gamma
    };
  }

  // Sarsıntı: son 5 kaydın accelerometer.x standart sapması > 4
  const recent = await SensorData.find({ deviceId: sensorData.deviceId })
    .sort({ timestamp: -1 })
    .limit(5)
    .lean();

  const xValues = recent
    .map((r) => r.accelerometer && r.accelerometer.x)
    .filter((x) => typeof x === 'number');

  if (xValues.length >= 2) {
    const stdDev = standardDeviation(xValues);
    if (stdDev > 4) {
      return {
        type: 'VIBRATION',
        severity: 'medium',
        value: stdDev
      };
    }
  }

  return null;
};

const REASON_LABELS = {
  HARD_BRAKE: 'Ani Fren',
  SHARP_TURN: 'Sert Dönüş',
  RAPID_ACCELERATION: 'Ani Hızlanma',
  VIBRATION: 'Sarsıntı',
  SPEED_LIMIT_EXCEEDED: 'Hız Sınırı Aşımı'
};

/**
 * Alarm türüne göre sürücünün skorunu düşürür (atomic).
 * Race condition'ı önlemek için aggregation pipeline'lı findOneAndUpdate kullanır.
 * Skor 0'ın altına düşmez. scoreHistory'ye kayıt ekler ve scoreUpdate yayınlar.
 */
const applyAlarmPenalty = async (userId, type, io) => {
  const penalty = SCORE_PENALTIES[type];
  if (!penalty || !userId) return null;

  const reason = REASON_LABELS[type] || type;
  const now = new Date();

  const updated = await DriverProfile.findOneAndUpdate(
    { userId },
    [
      { $set: { score: { $max: [0, { $subtract: ['$score', penalty] }] } } },
      {
        $set: {
          scoreHistory: {
            $concatArrays: [
              '$scoreHistory',
              [{ score: '$score', reason, change: -penalty, timestamp: now }]
            ]
          }
        }
      }
    ],
    { new: true }
  );

  if (updated && io) {
    io.emit('scoreUpdate', {
      userId: String(userId),
      newScore: updated.score,
      change: -penalty,
      reason
    });
  }
  return updated;
};

/**
 * Temiz sürüş ödülü: skoru +1 artırır (max 100).
 * En son skor değişikliğinin üzerinden 10 dk geçmediyse atlar (spam önleme).
 */
const rewardCleanDriving = async (userId, io) => {
  if (!userId) return null;
  const profile = await DriverProfile.findOne({ userId });
  if (!profile || profile.score >= 100) return null;

  const last = profile.scoreHistory[profile.scoreHistory.length - 1];
  const TEN_MIN = 10 * 60 * 1000;
  if (last && Date.now() - new Date(last.timestamp).getTime() < TEN_MIN) {
    return null;
  }

  const now = new Date();
  const updated = await DriverProfile.findOneAndUpdate(
    { userId, score: { $lt: 100 } },
    [
      { $set: { score: { $min: [100, { $add: ['$score', 1] }] } } },
      {
        $set: {
          scoreHistory: {
            $concatArrays: [
              '$scoreHistory',
              [{ score: '$score', reason: 'Temiz Sürüş', change: 1, timestamp: now }]
            ]
          }
        }
      }
    ],
    { new: true }
  );

  if (updated && io) {
    io.emit('scoreUpdate', {
      userId: String(userId),
      newScore: updated.score,
      change: 1,
      reason: 'Temiz Sürüş'
    });
  }
  return updated;
};

module.exports = detectAnomaly;
module.exports.applyAlarmPenalty = applyAlarmPenalty;
module.exports.rewardCleanDriving = rewardCleanDriving;
module.exports.SCORE_PENALTIES = SCORE_PENALTIES;
module.exports.REASON_LABELS = REASON_LABELS;
