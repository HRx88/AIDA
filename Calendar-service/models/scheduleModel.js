const db = require('../config/db');

/**
 * Create a new weekly schedule
 */
const create = async (scheduleData) => {
    const { userId, weekStart, createdBy, isTemplate } = scheduleData;

    const result = await db.query(
        `INSERT INTO schedules (user_id, week_start, created_by, is_template)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, weekStart, createdBy || 'user', isTemplate || false]
    );
    return result.rows[0];
};

/**
 * Find all schedules for a user
 */
const findByUserId = async (userId) => {
    const result = await db.query(
        `SELECT * FROM schedules 
         WHERE user_id = $1 
         ORDER BY week_start DESC`,
        [userId]
    );
    return result.rows;
};

/**
 * Find current week's schedule for a user
 */
const findCurrentWeek = async (userId) => {
    const result = await db.query(
        `SELECT * FROM schedules 
         WHERE user_id = $1 
         AND week_start <= CURRENT_DATE 
         AND week_start + INTERVAL '7 days' > CURRENT_DATE
         ORDER BY week_start DESC
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
};

/**
 * Find schedule by user and exact week_start date
 */
const findByUserAndWeekStart = async (userId, weekStart) => {
    const result = await db.query(
        `SELECT * FROM schedules
         WHERE user_id = $1
         AND week_start = $2::date
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, weekStart]
    );
    return result.rows[0] || null;
};

/**
 * Find schedule by ID
 */
const findById = async (id) => {
    const result = await db.query('SELECT * FROM schedules WHERE id = $1', [id]);
    return result.rows[0] || null;
};

/**
 * Update a schedule
 */
const update = async (scheduleId, scheduleData) => {
    const { weekStart, isTemplate } = scheduleData;

    const result = await db.query(
        `UPDATE schedules 
         SET week_start = COALESCE($1, week_start),
             is_template = COALESCE($2, is_template),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [weekStart, isTemplate, scheduleId]
    );
    return result.rows[0] || null;
};

/**
 * Delete a schedule
 */
const deleteSchedule = async (scheduleId) => {
    const result = await db.query(
        'DELETE FROM schedules WHERE id = $1 RETURNING *',
        [scheduleId]
    );
    return result.rows[0] || null;
};

/**
 * Get template schedules for AI generation
 */
const getTemplates = async (userId) => {
    const result = await db.query(
        `SELECT * FROM schedules 
         WHERE user_id = $1 AND is_template = true
         ORDER BY created_at DESC`,
        [userId]
    );
    return result.rows;
};

module.exports = {
    create,
    findByUserId,
    findCurrentWeek,
    findByUserAndWeekStart,
    findById,
    update,
    delete: deleteSchedule,
    getTemplates
};
