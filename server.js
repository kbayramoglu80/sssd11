const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Statik dosyaları sun
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Basit bir API örneği (gerekirse)
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from API!' });
});

// Örnek rezervasyon endpointleri (gerekirse)
app.get('/api/reservations', (req, res) => {
  const filePath = path.join(__dirname, 'reservations.json');
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    res.json(JSON.parse(data));
  } else {
    res.json([]);
  }
});

app.post('/api/reservations', (req, res) => {
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
app.get('/api/directions', async (req, res) => {
  const { origin, destination } = req.query;
  const apiKey = 'AIzaSyBkJ3vKDMhGztkTtTIvkynaMu-xEnZKw4g';
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

app.delete('/api/reservations/:id', (req, res) => {
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

// SPA ise, diğer tüm isteklerde index.html döndür
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 