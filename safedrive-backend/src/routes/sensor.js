const express = require('express');
const { body, validationResult } = require('express-validator');
const SensorData = require('../models/SensorData');
const Alarm = require('../models/Alarm');
const Device = require('../models/Device');
const detectAnomaly = require('../services/anomalyDetector');
const { auth } = require('../middleware/auth');

const router = express.Router();

const TEN_MIN = 10 * 60 * 1000;

// Overpass aynaları (ilki yavaş/dolu olursa sıradakine geçilir)
const OVERPASS_HOSTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

/**
 * OpenStreetMap Overpass API ile konumdaki hız sınırını (km/h) sorgular.
 * Her ayna için 5 saniye timeout; hiçbiri cevap vermezse null döner (hata fırlatmaz).
 */
async function getSpeedLimit(lat, lng) {
  const q = `[out:json];way(around:30,${lat},${lng})[maxspeed];out;`;
  for (const host of OVERPASS_HOSTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      // Overpass User-Agent göndermeyen isteklere 406 döndürür; başlık zorunlu.
      const res = await fetch(`${host}?data=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SafeDrive/1.0 (driver-behavior-platform)' }
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      for (const el of data.elements || []) {
        const ms = el.tags && el.tags.maxspeed;
        if (ms) {
          // "30", "50 km/h", "30 mph" -> sadece sayı
          const n = parseInt(String(ms).replace(/[^0-9]/g, ''), 10);
          if (n) return n;
        }
      }
      return null; // ayna cevap verdi ama bu noktada hız sınırı yok
    } catch (err) {
      // timeout / ağ hatası -> sıradaki aynayı dene
    }
  }
  return null;
}

// POST /api/sensor-data
router.post(
  '/',
  auth,
  [
    body('deviceId').notEmpty().withMessage('deviceId zorunludur'),
    body('timestamp').notEmpty().withMessage('timestamp zorunludur')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { deviceId, timestamp, accelerometer, gyroscope, location } = req.body;

      // deviceId'nin geçerli bir cihaza ait olduğunu doğrula
      const device = await Device.findById(deviceId);
      if (!device) {
        return res.status(404).json({ error: 'Cihaz bulunamadı' });
      }

      const sensorData = await SensorData.create({
        deviceId,
        timestamp,
        accelerometer,
        gyroscope,
        location
      });

      // Cihazın son görülme zamanını güncelle
      device.lastSeen = new Date();
      await device.save();

      const io = req.app.get('io');
      const createdAlarms = [];

      // 1) Sensör tabanlı anomali tespiti
      const anomaly = await detectAnomaly(sensorData);
      if (anomaly) {
        const alarm = await Alarm.create({
          deviceId: sensorData.deviceId,
          type: anomaly.type,
          severity: anomaly.severity,
          value: anomaly.value,
          timestamp: sensorData.timestamp
        });
        createdAlarms.push(alarm);
      }

      // 2) Hız sınırı kontrolü
      const loc = location || {};
      if (loc.latitude != null && loc.longitude != null && typeof loc.speed === 'number' && loc.speed > 0) {
        // Mobil istemci hızı km/h olarak gönderir.
        const speedKmh = loc.speed;
        // İstemci speedLimit gönderdiyse (simülasyon) onu kullan — Overpass'a gitme.
        // Aksi halde gerçek sürüşte konumdan Overpass ile hız sınırını sorgula.
        const speedLimit =
          typeof req.body.speedLimit === 'number'
            ? req.body.speedLimit
            : await getSpeedLimit(loc.latitude, loc.longitude);
        if (speedLimit && speedKmh > speedLimit) {
          const speedAlarm = await Alarm.create({
            deviceId: sensorData.deviceId,
            type: 'SPEED_LIMIT_EXCEEDED',
            severity: 'high',
            value: Math.round(speedKmh),
            speedLimit,
            timestamp: sensorData.timestamp
          });
          createdAlarms.push(speedAlarm);
          if (io) {
            io.emit('speedWarning', {
              deviceId: String(device._id),
              userId: String(device.owner),
              currentSpeed: Math.round(speedKmh),
              speedLimit,
              excess: Math.round(speedKmh - speedLimit)
            });
          }
        }
      }

      // 3) Skor güncelleme: her alarm için ceza uygula
      for (const alarm of createdAlarms) {
        await detectAnomaly.applyAlarmPenalty(device.owner, alarm.type, io);
      }

      // 4) Temiz sürüş ödülü: bu turda alarm yoksa ve son 10 dk'da alarm yoksa +1
      if (createdAlarms.length === 0) {
        const recentAlarm = await Alarm.findOne({
          deviceId: device._id,
          timestamp: { $gte: new Date(Date.now() - TEN_MIN) }
        });
        if (!recentAlarm) {
          await detectAnomaly.rewardCleanDriving(device.owner, io);
        }
      }

      // 5) Socket.io olayları
      if (io) {
        io.emit('newData', sensorData);
        for (const alarm of createdAlarms) {
          io.emit('newAlarm', alarm);
        }
      }

      return res.status(201).json({ sensorData, alarms: createdAlarms });
    } catch (err) {
      return res.status(500).json({ error: 'Sunucu hatası' });
    }
  }
);

// GET /api/sensor-data
// - Şirket: kendi araçlarının verisi (companyId token'dan)
// - Admin/Driver: deviceId zorunlu
router.get('/', auth, async (req, res) => {
  try {
    const { deviceId, startDate, endDate } = req.query;
    const limit = parseInt(req.query.limit, 10) || 50;

    const filter = {};

    if (req.user.role === 'company') {
      // Şirkete ait cihazların id'lerini bul (companyId güvenlik için token'dan)
      const devices = await Device.find({ companyId: req.user.companyId }).select('_id');
      const ids = devices.map((d) => d._id);

      if (deviceId) {
        if (!ids.some((id) => id.toString() === deviceId)) {
          return res.status(403).json({ error: 'Bu araca erişim yetkiniz yok' });
        }
        filter.deviceId = deviceId;
      } else {
        filter.deviceId = { $in: ids };
      }
    } else {
      // Admin/Driver için deviceId zorunlu
      if (!deviceId) {
        return res.status(400).json({ error: 'deviceId zorunludur' });
      }
      filter.deviceId = deviceId;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const data = await SensorData.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
