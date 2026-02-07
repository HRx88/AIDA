const db = require('../config/db');

/**
 * Add points for a user
 */
const addPoints = async (pointsData) => {
    const { userId, points, reason, taskId } = pointsData;

    const result = await db.query(
        `INSERT INTO user_points (user_id, points, reason, task_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, points, reason || 'Task completed', taskId || null]
    );
    return result.rows[0];
};

/**
 * Get total points balance for a user
 */
const getBalance = async (userId) => {
    const result = await db.query(
        `SELECT COALESCE(SUM(points), 0) as total_points
         FROM user_points
         WHERE user_id = $1`,
        [userId]
    );
    return parseInt(result.rows[0].total_points, 10);
};

/**
 * Get points history for a user
 */
const getHistory = async (userId, limit = 50) => {
    const result = await db.query(
        `SELECT up.*, t.title as task_title
         FROM user_points up
         LEFT JOIN tasks t ON up.task_id = t.id
         WHERE up.user_id = $1
         ORDER BY up.created_at DESC
         LIMIT $2`,
        [userId, limit]
    );
    return result.rows;
};

/**
 * Get points earned today
 */
const getTodayPoints = async (userId) => {
    const result = await db.query(
        `SELECT COALESCE(SUM(points), 0) as today_points
         FROM user_points
         WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE`,
        [userId]
    );
    return parseInt(result.rows[0].today_points, 10);
};

/**
 * Get points earned on a specific date
 */
const getDatePoints = async (userId, date) => {
    const result = await db.query(
        `SELECT COALESCE(SUM(points), 0) as date_points
         FROM user_points
         WHERE user_id = $1 AND DATE(created_at) = $2`,
        [userId, date]
    );
    return parseInt(result.rows[0].date_points, 10);
};

/**
 * Get points earned this week
 */
const getWeekPoints = async (userId) => {
    const result = await db.query(
        `SELECT COALESCE(SUM(points), 0) as week_points
         FROM user_points
         WHERE user_id = $1 
         AND created_at >= DATE_TRUNC('week', CURRENT_DATE)`,
        [userId]
    );
    return parseInt(result.rows[0].week_points, 10);
};

/**
 * Get leaderboard (top users by points)
 */
const getLeaderboard = async (limit = 10) => {
    const result = await db.query(
        `SELECT 
            up.user_id,
            u.full_name,
            u.username,
            SUM(up.points) as total_points,
            COUNT(up.id) as tasks_completed
         FROM user_points up
         JOIN users u ON up.user_id = u.id
         GROUP BY up.user_id, u.full_name, u.username
         ORDER BY total_points DESC
         LIMIT $1`,
        [limit]
    );
    return result.rows;
};

/**
 * Get points breakdown by category
 */
const getPointsByCategory = async (userId) => {
    const result = await db.query(
        `SELECT 
            t.category,
            SUM(up.points) as category_points,
            COUNT(up.id) as task_count
         FROM user_points up
         JOIN tasks t ON up.task_id = t.id
         WHERE up.user_id = $1
         GROUP BY t.category
         ORDER BY category_points DESC`,
        [userId]
    );
    return result.rows;
};

module.exports = {
    addPoints,
    getBalance,
    getHistory,
    getTodayPoints,
    getDatePoints,
    getWeekPoints,
    getLeaderboard,
    getPointsByCategory
};
