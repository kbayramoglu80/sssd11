const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const RES_FILE = path.join(__dirname, 'reservations.json');

// Statik dosyaları ana dizinden sun
app.use(express.static(path.join(__dirname, '../')));
app.use(cors());
app.use(bodyParser.json());

// Rezervasyonları oku
function readReservations() {
  if (!fs.existsSync(RES_FILE)) return [];
  const data = fs.readFileSync(RES_FILE, 'utf-8');
  try { return JSON.parse(data); } catch { return []; }
}
// Rezervasyonları kaydet
function writeReservations(reservations) {
  fs.writeFileSync(RES_FILE, JSON.stringify(reservations, null, 2), 'utf-8');
}

// Tüm rezervasyonları getir
app.get('/reservations', (req, res) => {
  res.json(readReservations());
});
// Yeni rezervasyon ekle
app.post('/reservations', (req, res) => {
  const reservations = readReservations();
  const newRes = { id: Date.now(), ...req.body };
  reservations.push(newRes);
  writeReservations(reservations);
  res.status(201).json({ success: true, reservation: newRes });
});
// Rezervasyon sil
app.delete('/reservations/:id', (req, res) => {
  let reservations = readReservations();
  const id = parseInt(req.params.id);
  const before = reservations.length;
  reservations = reservations.filter(r => r.id !== id);
  writeReservations(reservations);
  res.json({ success: reservations.length < before });
});

app.listen(PORT, () => {
  console.log(`Rezervasyon API http://localhost:${PORT}`);
}); 