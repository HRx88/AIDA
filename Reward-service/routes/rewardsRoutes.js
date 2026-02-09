const express = require('express');
const router = express.Router();
const rewardsController = require('../controllers/rewardsController');

// list rewards
router.get('/items', rewardsController.list);

// redeem
router.post('/redeem', rewardsController.redeem);

// my redemption history
router.get('/me', rewardsController.myHistory);

module.exports = router;
