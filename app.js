const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/arac-sec', (req, res) => {
    res.sendFile(path.join(__dirname, 'arac-sec.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'server/admin.html'));
});

// API Routes
app.get('/api/reservations', (req, res) => {
    try {
        const reservationsPath = path.join(__dirname, 'server/reservations.json');
        if (fs.existsSync(reservationsPath)) {
            const data = fs.readFileSync(reservationsPath, 'utf8');
            const reservations = JSON.parse(data);
            res.json(reservations);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error reading reservations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/reservations', (req, res) => {
    try {
        const reservationsPath = path.join(__dirname, 'server/reservations.json');
        let reservations = [];
        
        if (fs.existsSync(reservationsPath)) {
            const data = fs.readFileSync(reservationsPath, 'utf8');
            reservations = JSON.parse(data);
        }
        
        const newReservation = {
            id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        
        reservations.push(newReservation);
        
        fs.writeFileSync(reservationsPath, JSON.stringify(reservations, null, 2));
        
        res.json({ success: true, reservation: newReservation });
    } catch (error) {
        console.error('Error saving reservation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/reservations/:id', (req, res) => {
    try {
        const reservationsPath = path.join(__dirname, 'server/reservations.json');
        if (fs.existsSync(reservationsPath)) {
            const data = fs.readFileSync(reservationsPath, 'utf8');
            let reservations = JSON.parse(data);
            
            reservations = reservations.filter(reservation => reservation.id !== req.params.id);
            
            fs.writeFileSync(reservationsPath, JSON.stringify(reservations, null, 2));
            
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Reservations file not found' });
        }
    } catch (error) {
        console.error('Error deleting reservation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit: http://localhost:${PORT}`);
});
