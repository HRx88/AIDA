const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { authenticateJWT } = require('./middleware/authMiddleware');
const petController = require('./controllers/petController');

const app = express();
const PORT = process.env.PET_SERVICE_PORT || 5004;

app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend-service/views/pet-view.html'));
});

app.get('/health', (req, res) => {
    res.json({ service: 'Pet-Asset-Service', status: 'running', port: PORT });
});

app.get('/api/pet/mood', authenticateJWT, petController.getPetMood);

// Static files (Images, CSS, etc.)
app.use(express.static(__dirname));
app.use('/Happy', express.static(path.join(__dirname, 'Happy')));
app.use('/Bored', express.static(path.join(__dirname, 'Bored')));
app.use('/Dirty', express.static(path.join(__dirname, 'Dirty')));
app.use('/Playing', express.static(path.join(__dirname, 'Playing')));

// Shared Static files from Frontend-service
app.use('/css', express.static(path.join(__dirname, '../Frontend-service/css')));
app.use('/js', express.static(path.join(__dirname, '../Frontend-service/js')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pet Service running on http://0.0.0.0:${PORT}`);
});