const db = require('../config/db');

/**
 * Create a new task
 */
const create = async (taskData) => {
    const { scheduleId, userId, title, description, dayOfWeek, timeSlot, category, isRoutine, orderIndex } = taskData;

    const result = await db.query(
        `INSERT INTO tasks (schedule_id, user_id, title, description, day_of_week, time_slot, category, is_routine, order_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [scheduleId, userId, title, description || '', dayOfWeek, timeSlot || null, category || 'general', isRoutine || false, orderIndex || 0]
    );
    return result.rows[0];
};

/**
 * Find all tasks for a schedule
 */
const findByScheduleId = async (scheduleId) => {
    const result = await db.query(
        `SELECT * FROM tasks 
         WHERE schedule_id = $1 
         ORDER BY day_of_week, time_slot, order_index`,
        [scheduleId]
    );
    return result.rows;
};

/**
 * Find tasks for a user on a specific date
 */
const findByUserAndDate = async (userId, date) => {
    // Get day of week (0=Sunday, 1=Monday, etc.)
    const result = await db.query(
        `SELECT t.* FROM tasks t
         JOIN schedules s ON t.schedule_id = s.id
         WHERE t.user_id = $1
         AND s.week_start <= $2::date
         AND s.week_start + INTERVAL '7 days' > $2::date
         AND t.day_of_week = EXTRACT(DOW FROM $2::date)
         ORDER BY t.time_slot, t.order_index`,
        [userId, date]
    );
    return result.rows;
};

/**
 * Find tasks for a user in a specific month
 */
const findByUserAndMonth = async (userId, year, month) => {
    // Construct start and end dates of the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Last day logic handled by database date truncation or JS
    // Simpler: BETWEEN start_date AND (start_date + 1 month)

    const result = await db.query(
        `SELECT t.*, s.week_start, 
         ((s.week_start + (t.day_of_week || ' days')::interval)::date)::text as task_date
         FROM tasks t
         JOIN schedules s ON t.schedule_id = s.id
         WHERE t.user_id = $1
         AND (s.week_start + (t.day_of_week || ' days')::interval)::date >= $2::date
         AND (s.week_start + (t.day_of_week || ' days')::interval)::date < ($2::date + INTERVAL '1 month')
         ORDER BY task_date, t.time_slot`,
        [userId, startDate]
    );
    return result.rows;
};

/**
 * Find task by ID
 */
const findById = async (id) => {
    const result = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    return result.rows[0] || null;
};

/**
 * Update a task
 */
const update = async (taskId, taskData) => {
    const { title, description, dayOfWeek, timeSlot, category, isRoutine, orderIndex } = taskData;

    const result = await db.query(
        `UPDATE tasks 
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             day_of_week = COALESCE($3, day_of_week),
             time_slot = COALESCE($4, time_slot),
             category = COALESCE($5, category),
             is_routine = COALESCE($6, is_routine),
             order_index = COALESCE($7, order_index),
             updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [title, description, dayOfWeek, timeSlot, category, isRoutine, orderIndex, taskId]
    );
    return result.rows[0] || null;
};

/**
 * Reorder a task
 */
const reorder = async (taskId, newOrder) => {
    const result = await db.query(
        `UPDATE tasks SET order_index = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newOrder, taskId]
    );
    return result.rows[0] || null;
};

/**
 * Delete a task
 */
const deleteTask = async (taskId) => {
    const result = await db.query(
        'DELETE FROM tasks WHERE id = $1 RETURNING *',
        [taskId]
    );
    return result.rows[0] || null;
};

/**
 * Get routine tasks (for AI schedule generation)
 */
const getRoutineTasks = async (userId) => {
    const result = await db.query(
        `SELECT * FROM tasks 
         WHERE user_id = $1 AND is_routine = true
         ORDER BY day_of_week, time_slot`,
        [userId]
    );
    return result.rows;
};

/**
 * Bulk create tasks (for AI generation)
 */
const bulkCreate = async (tasks) => {
    const values = tasks.map((t, i) => {
        const base = i * 9;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
    }).join(', ');

    const params = tasks.flatMap(t => [
        t.scheduleId, t.userId, t.title, t.description || '',
        t.dayOfWeek, t.timeSlot || null, t.category || 'general',
        t.isRoutine || false, t.orderIndex || 0
    ]);

    const result = await db.query(
        `INSERT INTO tasks (schedule_id, user_id, title, description, day_of_week, time_slot, category, is_routine, order_index)
         VALUES ${values}
         RETURNING *`,
        params
    );
    return result.rows;
};

module.exports = {
    create,
    findByScheduleId,
    findByUserAndDate,
    findByUserAndMonth,
    findById,
    update,
    reorder,
    delete: deleteTask,
    getRoutineTasks,
    bulkCreate
};
