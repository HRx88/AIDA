const db = require('../config/db');

/**
 * Log task completion (when DONE button is clicked)
 */
const logCompletion = async (logData) => {
    const { taskId, userId, scheduledDate, status, notes } = logData;

    const result = await db.query(
        `INSERT INTO task_logs (task_id, user_id, scheduled_date, status, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [taskId, userId, scheduledDate, status || 'done', notes || null]
    );
    return result.rows[0];
};

/**
 * Find logs for a user on a specific date
 */
const findByUserAndDate = async (userId, date) => {
    const result = await db.query(
        `SELECT tl.*, t.title as task_title, t.category 
         FROM task_logs tl
         JOIN tasks t ON tl.task_id = t.id
         WHERE tl.user_id = $1 AND tl.scheduled_date = $2::date
         ORDER BY tl.completed_at DESC`,
        [userId, date]
    );
    return result.rows;
};

/**
 * Find logs for a user in a week
 */
const findByUserAndWeek = async (userId, weekStart) => {
    const result = await db.query(
        `SELECT tl.*, t.title as task_title, t.category, t.day_of_week
         FROM task_logs tl
         JOIN tasks t ON tl.task_id = t.id
         WHERE tl.user_id = $1 
         AND tl.scheduled_date >= $2::date
         AND tl.scheduled_date < $2::date + INTERVAL '7 days'
         ORDER BY tl.scheduled_date, tl.completed_at`,
        [userId, weekStart]
    );
    return result.rows;
};

/**
 * Check if a task is already completed for a date
 */
const isTaskCompleted = async (taskId, scheduledDate) => {
    const result = await db.query(
        `SELECT id FROM task_logs 
         WHERE task_id = $1 AND scheduled_date = $2::date AND status = 'done'
         LIMIT 1`,
        [taskId, scheduledDate]
    );
    return result.rows.length > 0;
};

/**
 * Get completion statistics for a user
 */
const getStats = async (userId, startDate = null, endDate = null) => {
    let query = `
        SELECT 
            COUNT(*) as total_completed,
            COUNT(DISTINCT scheduled_date) as days_active,
            DATE_TRUNC('day', MIN(completed_at)) as first_completion,
            DATE_TRUNC('day', MAX(completed_at)) as last_completion
        FROM task_logs
        WHERE user_id = $1 AND status = 'done'
    `;
    const params = [userId];

    if (startDate) {
        query += ` AND scheduled_date >= $${params.length + 1}`;
        params.push(startDate);
    }
    if (endDate) {
        query += ` AND scheduled_date <= $${params.length + 1}`;
        params.push(endDate);
    }

    const result = await db.query(query, params);
    return result.rows[0];
};

/**
 * Get daily completion breakdown
 */
const getDailyBreakdown = async (userId, startDate, endDate) => {
    const result = await db.query(
        `SELECT 
            scheduled_date,
            COUNT(*) as tasks_completed,
            ARRAY_AGG(t.category) as categories
         FROM task_logs tl
         JOIN tasks t ON tl.task_id = t.id
         WHERE tl.user_id = $1 
         AND tl.scheduled_date >= $2 
         AND tl.scheduled_date <= $3
         AND tl.status = 'done'
         GROUP BY scheduled_date
         ORDER BY scheduled_date`,
        [userId, startDate, endDate]
    );
    return result.rows;
};

module.exports = {
    logCompletion,
    findByUserAndDate,
    findByUserAndWeek,
    isTaskCompleted,
    getStats,
    getDailyBreakdown
};
