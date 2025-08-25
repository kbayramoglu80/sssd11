require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Trust proxy if behind one (needed for secure cookies on some hosts)
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Sessions for admin auth
const secureCookie = String(process.env.SESSION_COOKIE_SECURE || '0') === '1';
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'change-me-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    maxAge: 1000 * 60 * 60 * 4
  }
}));

// Parsers
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Basit bir API örneği (gerekirse)
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from API!' });
});

// Public config for frontend (safe values only)
app.get('/config/maps-key', (req, res) => {
  res.json({ browserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '' });
});

// Örnek rezervasyon endpointleri (gerekirse)
// Auth middleware for admin-only endpoints
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 120 });

// Rezervasyonları listele (admin)
app.get('/api/reservations', requireAdmin, apiLimiter, (req, res) => {
  const filePath = path.join(__dirname, 'reservations.json');
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    res.json(JSON.parse(data));
  } else {
    res.json([]);
  }
});

// Yeni rezervasyon oluşturma (public)
app.post('/api/reservations', apiLimiter, (req, res) => {
  const filePath = path.join(__dirname, 'reservations.json');
  let reservations = [];
  if (fs.existsSync(filePath)) {
    reservations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  const newRes = { id: Date.now(), ...req.body };
  reservations.push(newRes);
  fs.writeFileSync(filePath, JSON.stringify(reservations, null, 2));
  res.status(201).json({ success: true, reservation: newRes });
});

// Google Directions API ile mesafe hesaplama endpointi
app.get('/api/directions', apiLimiter, async (req, res) => {
  const { origin, destination } = req.query;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBkJ3vKDMhGztkTtTIvkynaMu-xEnZKw4g';
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${apiKey}`;
    const response = await axios.get(url);
    console.log('Google Directions yanıtı:', response.data);
    res.json(response.data);
  } catch (err) {
    console.error('Directions API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Directions API error', details: err.message });
  }
});

// Rezervasyon silme (admin)
app.delete('/api/reservations/:id', requireAdmin, apiLimiter, (req, res) => {
  const filePath = path.join(__dirname, 'reservations.json');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Reservations file not found' });
  }
  let reservations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const before = reservations.length;
  reservations = reservations.filter(r => String(r.id) !== String(req.params.id));
  fs.writeFileSync(filePath, JSON.stringify(reservations, null, 2));
  res.json({ success: reservations.length < before });
});

// --- Admin Authentication ---
// GET: Admin login page (served as static file under public)
app.get('/admin/login', (req, res) => {
  // If already authenticated, redirect to admin panel
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// POST: Admin login
app.post('/admin/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
    const plainPassword = (process.env.ADMIN_PASSWORD || 'LxN!2024$VIP@Trnsf3r');

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    }
    if (username !== expectedUsername) {
      return res.status(401).json({ error: 'Geçersiz bilgiler' });
    }
    let ok = false;
    if (passwordHash) {
      ok = await bcrypt.compare(password, passwordHash);
    } else if (plainPassword) {
      // Timing-safe karşılaştırma
      const a = Buffer.from(password);
      const b = Buffer.from(plainPassword);
      ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    } else {
      return res.status(500).json({ error: 'Admin şifre yapılandırılmamış' });
    }
    if (!ok) return res.status(401).json({ error: 'Geçersiz bilgiler' });
    req.session.isAdmin = true;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Giriş başarısız' });
  }
});

// POST: Admin logout
app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ success: true });
  });
});

// GET: Admin panel (protected)
app.get('/admin', (req, res) => {
  if (!(req.session && req.session.isAdmin)) {
    return res.redirect('/admin/login');
  }
  res.sendFile(path.join(__dirname, 'server', 'admin.html'));
});

// SPA ise, diğer tüm isteklerde index.html döndür
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 