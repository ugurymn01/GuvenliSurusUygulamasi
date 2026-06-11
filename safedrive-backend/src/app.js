require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const path = require('path');

const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const sensorRoutes = require('./routes/sensor');
const alarmRoutes = require('./routes/alarm');
const deviceRoutes = require('./routes/device');
const userRoutes = require('./routes/user');
const companyRoutes = require('./routes/company');
const applicationRoutes = require('./routes/application');
const driverProfileRoutes = require('./routes/driverProfile');
const driverProfilesRoutes = require('./routes/driverProfiles');

const app = express();
const server = http.createServer(app);

// Socket.io kurulumu (geliştirme için CORS *)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH']
  }
});

// io'yu route'lardan erişilebilir yap
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`Yeni client bağlandı: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client ayrıldı: ${socket.id}`);
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Statik dosyalar (canlı panel: /panel.html)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Sağlık kontrolü
app.get('/', (req, res) => {
  res.status(200).json({ message: 'SafeDrive Backend çalışıyor' });
});

// Route'lar
app.use('/auth', authRoutes);
app.use('/api/sensor-data', sensorRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/driver-profile', driverProfileRoutes);
app.use('/api/driver-profiles', driverProfilesRoutes);

// 404 yakalayıcı
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Genel hata yakalayıcı
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

const PORT = process.env.PORT || 5000;

// Önce DB'ye bağlan, sonra sunucuyu başlat
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
  });
});

module.exports = { app, server, io };
