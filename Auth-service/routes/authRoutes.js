const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Authentication routes
router.post('/login', authController.login);

// User management routes
router.get('/users', authController.getUsers);
router.get('/users/:id', authController.getUserById);

module.exports = router;
