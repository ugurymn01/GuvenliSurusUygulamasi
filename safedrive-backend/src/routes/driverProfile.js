const express = require('express');
const { body, validationResult } = require('express-validator');
const DriverProfile = require('../models/DriverProfile');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/driver-profile — Sürücü ilk kez profilini oluşturur
router.post(
  '/',
  auth,
  requireRole('driver'),
  [
    body('firstName').notEmpty().withMessage('Ad zorunludur'),
    body('lastName').notEmpty().withMessage('Soyad zorunludur')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      if (!req.user.companyId) {
        return res.status(400).json({ error: 'Kullanıcının şirketi tanımlı değil' });
      }

      const existing = await DriverProfile.findOne({ userId: req.user.userId });
      if (existing) {
        return res.status(409).json({ error: 'Profil zaten mevcut' });
      }

      const profile = await DriverProfile.create({
        userId: req.user.userId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        companyId: req.user.companyId
      });

      return res.status(201).json(profile);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Profil zaten mevcut' });
      }
      return res.status(500).json({ error: 'Sunucu hatası' });
    }
  }
);

// GET /api/driver-profile — Sürücü kendi profilini getirir (User + Company birleşik)
router.get('/', auth, requireRole('driver'), async (req, res) => {
  try {
    const profile = await DriverProfile.findOne({ userId: req.user.userId }).populate(
      'companyId',
      'name'
    );
    if (!profile) {
      return res.status(404).json({ error: 'Profil bulunamadı' });
    }

    const user = await User.findById(req.user.userId).select('email');

    return res.status(200).json({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: user ? user.email : null,
      companyName: profile.companyId ? profile.companyId.name : null,
      score: profile.score,
      scoreHistory: profile.scoreHistory.slice(-10),
      totalTrips: profile.totalTrips
    });
  } catch (err) {
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
