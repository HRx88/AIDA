const Points = require('../models/pointsModel');

/**
 * Get user's point balance
 */
const getBalance = async (req, res) => {
    const { userId } = req.params;

    try {
        const balance = await Points.getBalance(userId);
        const todayPoints = await Points.getTodayPoints(userId);
        const weekPoints = await Points.getWeekPoints(userId);

        res.json({
            userId: parseInt(userId),
            total: balance,
            today: todayPoints,
            thisWeek: weekPoints
        });
    } catch (err) {
        console.error('Error fetching points:', err);
        res.status(500).json({ error: 'Failed to fetch points' });
    }
};

/**
 * Get user's points history
 */
const getHistory = async (req, res) => {
    const { userId } = req.params;
    const { limit } = req.query;

    try {
        const history = await Points.getHistory(userId, limit ? parseInt(limit) : 50);
        res.json(history);
    } catch (err) {
        console.error('Error fetching points history:', err);
        res.status(500).json({ error: 'Failed to fetch points history' });
    }
};

/**
 * Get leaderboard
 */
const getLeaderboard = async (req, res) => {
    const { limit } = req.query;

    try {
        const leaderboard = await Points.getLeaderboard(limit ? parseInt(limit) : 10);
        res.json(leaderboard);
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
};

/**
 * Get points breakdown by category
 */
const getBreakdownByCategory = async (req, res) => {
    const { userId } = req.params;

    try {
        const breakdown = await Points.getPointsByCategory(userId);
        const total = await Points.getBalance(userId);

        res.json({
            total,
            byCategory: breakdown
        });
    } catch (err) {
        console.error('Error fetching points breakdown:', err);
        res.status(500).json({ error: 'Failed to fetch points breakdown' });
    }
};

module.exports = {
    getBalance,
    getHistory,
    getLeaderboard,
    getBreakdownByCategory
};
