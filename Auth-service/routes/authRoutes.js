const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const { authenticateJWT } = require('../middleware/authMiddleware');

// Authentication routes
router.get('/test-routes', (req, res) => {
    res.json(router.stack.map(r => r.route ? { path: r.route.path, methods: r.route.methods } : 'non-route'));
});
router.post('/login', authController.login);
router.put('/change-password', authenticateJWT, authController.changePassword);
router.put('/update-profile', authenticateJWT, authController.updateProfile);
router.post('/upload-avatar', authenticateJWT, authController.uploadAvatar);

// User management routes
router.get('/users', authController.getUsers);
router.post('/users', authController.register);
router.get('/users/:id', authController.getUserById);
router.put('/users/:id', authController.updateUser);
router.post('/users/:id/avatar', authController.uploadUserAvatar);

module.exports = router;
