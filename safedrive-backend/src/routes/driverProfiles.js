const express = require('express');
const DriverProfile = require('../models/DriverProfile');
const Device = require('../models/Device');
const Alarm = require('../models/Alarm');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

const GUN_ADLARI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

// GET /api/driver-profiles/chart — Son 7 günlük skor ortalaması (grafik için)
// Not: ':id' benzeri route'lardan önce tanımlanır (çakışma olmaması için).
router.get('/chart', auth, requireRole('company'), async (req, res) => {
  try {
    const profiles = await DriverProfile.find({ companyId: req.user.companyId });

    // Son 7 günün gün sonları ve etiketleri
    const days = [];
    const labels = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(23, 59, 59, 999);
      d.setDate(d.getDate() - i);
      days.push(d);
      labels.push(GUN_ADLARI[d.getDay()]);
    }

    const datasets = profiles.map((p) => {
      const history = [...p.scoreHistory].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      const data = days.map((dayEnd) => {
        // O günün sonuna kadarki en güncel skoru bul
        let val = 100; // varsayılan başlangıç skoru
        for (const h of history) {
          if (new Date(h.timestamp) <= dayEnd) {
            val = h.score;
          } else {
            break;
          }
        }
        return val;
      });
      return { driverName: `${p.firstName} ${p.lastName}`, data };
    });

    return res.status(200).json({ labels, datasets });
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GET /api/driver-profiles — Şirkete ait tüm sürücü profilleri (skora göre azalan)
router.get('/', auth, requireRole('company'), async (req, res) => {
  try {
    const profiles = await DriverProfile.find({ companyId: req.user.companyId }).sort({
      score: -1
    });

    const result = await Promise.all(
      profiles.map(async (p) => {
        // Sürücünün cihazlarındaki son alarm zamanı
        const devices = await Device.find({ owner: p.userId }).select('_id');
        const ids = devices.map((d) => d._id);
        let lastAlarm = null;
        if (ids.length) {
          const a = await Alarm.findOne({ deviceId: { $in: ids } }).sort({ timestamp: -1 });
          lastAlarm = a ? a.timestamp : null;
        }
        return {
          userId: p.userId,
          firstName: p.firstName,
          lastName: p.lastName,
          score: p.score,
          totalTrips: p.totalTrips,
          lastAlarm
        };
      })
    );

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
