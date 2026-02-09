const Rewards = require('../models/rewardsModel');

// GET /api/rewards/items
exports.list = async (req, res) => {
  try {
    const items = await Rewards.listActiveRewards();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load rewards', details: err.message });
  }
};

// POST /api/rewards/redeem
exports.redeem = async (req, res) => {
  try {
    // depending on your Auth-service token payload
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Missing user id in token' });
    }

    const result = await Rewards.redeemReward(userId, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET /api/rewards/me
exports.myHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Missing user id in token' });
    }

    const rows = await Rewards.getMyRedemptions(userId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load redemption history', details: err.message });
  }
};
