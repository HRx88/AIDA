const Task = require('../models/taskModel');
const googleCalendarService = require('../services/googleCalendarService');
const Schedule = require('../models/scheduleModel');

/**
 * Create a new task
 */
const createTask = async (req, res) => {
    let { scheduleId, userId, title, description, dayOfWeek, timeSlot, category, isRoutine, orderIndex, targetDate } = req.body;

    const parseLocalDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) {
            return new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }

        const datePart = String(value).split('T')[0];
        const parts = datePart.split('-').map(Number);
        if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;

        const [y, m, d] = parts;
        return new Date(y, m - 1, d);
    };

    const toLocalDateString = (dateObj) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
    };

    if (dayOfWeek === undefined && targetDate) {
        const parsed = parseLocalDate(targetDate);
        if (parsed) dayOfWeek = parsed.getDay();
    }

    if (!userId || !title || dayOfWeek === undefined) {
        return res.status(400).json({ error: 'userId, title, and dayOfWeek are required' });
    }

    try {
        // If no scheduleId provided, find or create one for the target date's week
        if (!scheduleId) {
            const baseDate = parseLocalDate(targetDate) || new Date();
            const baseLocal = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

            // Calculate week start (Sunday) based on target date (or today)
            const weekStart = new Date(baseLocal);
            weekStart.setDate(baseLocal.getDate() - baseLocal.getDay());
            const weekStartStr = toLocalDateString(weekStart);

            // Find schedule for this specific week (not just current week)
            const existingSchedule = await Schedule.findByUserAndWeekStart(userId, weekStartStr);

            if (existingSchedule) {
                scheduleId = existingSchedule.id;
            } else {
                const newSchedule = await Schedule.create({
                    userId,
                    weekStart: weekStartStr
                });
                scheduleId = newSchedule.id;
            }
        }

        const task = await Task.create({
            scheduleId,
            userId,
            title,
            description,
            dayOfWeek,
            timeSlot,
            category,
            isRoutine,
            orderIndex
        });

        // Sync to Google Calendar if authenticated
        // ... (rest of sync logic)
        // Sync to Google Calendar logic moved to Frontend (on-demand via /create-event)
        // This prevents duplicate events since Frontend calls createEvent manually
        /*
        if (googleCalendarService.isUserAuthenticated(userId)) {
            try {
                // ... logic preserved for reference ...
                let resultDate;
                if (targetDate) {
                    resultDate = new Date(targetDate);
                } else {
                    const today = new Date();
                    resultDate = new Date(today);
                    const currentDay = today.getDay();
                    const diff = (dayOfWeek - currentDay + 7) % 7;
                    resultDate.setDate(today.getDate() + diff);
                }

                await googleCalendarService.createEventFromTask(userId, task, resultDate);
                console.log(`Synced task "${title}" to Google Calendar for user ${userId}`);
            } catch (syncErr) {
                console.error('Error syncing individual task to Google Calendar:', syncErr);
            }
        }
        */

        res.status(201).json(task);
    } catch (err) {
        console.error('Error creating task:', err);
        res.status(500).json({ error: 'Failed to create task' });
    }
};

/**
 * Get all tasks for a schedule
 */
const getTasksBySchedule = async (req, res) => {
    const { scheduleId } = req.params;

    try {
        const tasks = await Task.findByScheduleId(scheduleId);
        res.json(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

/**
 * Get tasks for a user on a specific date
 */
const getTasksByUserAndDate = async (req, res) => {
    const { userId, date } = req.params;

    try {
        const tasks = await Task.findByUserAndDate(userId, date);
        res.json(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

/**
 * Get tasks for a specific month
 */
const getTasksByMonth = async (req, res) => {
    const { userId, year, month } = req.params;

    try {
        const tasks = await Task.findByUserAndMonth(userId, year, month);
        res.json(tasks);
    } catch (err) {
        console.error('Error fetching monthly tasks:', err);
        res.status(500).json({ error: 'Failed to fetch monthly tasks' });
    }
};

/**
 * Get task by ID
 */
const getTaskById = async (req, res) => {
    const { id } = req.params;

    try {
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (err) {
        console.error('Error fetching task:', err);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
};

/**
 * Update a task
 */
const updateTask = async (req, res) => {
    const { id } = req.params;
    const { title, description, dayOfWeek, timeSlot, category, isRoutine, orderIndex } = req.body;

    try {
        const task = await Task.update(id, {
            title,
            description,
            dayOfWeek,
            timeSlot,
            category,
            isRoutine,
            orderIndex
        });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).json({ error: 'Failed to update task' });
    }
};

/**
 * Reorder a task
 */
const reorderTask = async (req, res) => {
    const { id } = req.params;
    const { newOrder } = req.body;

    if (newOrder === undefined) {
        return res.status(400).json({ error: 'newOrder is required' });
    }

    try {
        const task = await Task.reorder(id, newOrder);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (err) {
        console.error('Error reordering task:', err);
        res.status(500).json({ error: 'Failed to reorder task' });
    }
};

/**
 * Delete a task
 */
const deleteTask = async (req, res) => {
    const { id } = req.params;

    try {
        const task = await Task.delete(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ message: 'Task deleted', task });
    } catch (err) {
        console.error('Error deleting task:', err);
        res.status(500).json({ error: 'Failed to delete task' });
    }
};

/**
 * Get routine tasks for a user (used for AI scheduling)
 */
const getRoutineTasks = async (req, res) => {
    const { userId } = req.params;

    try {
        const tasks = await Task.getRoutineTasks(userId);
        res.json(tasks);
    } catch (err) {
        console.error('Error fetching routine tasks:', err);
        res.status(500).json({ error: 'Failed to fetch routine tasks' });
    }
};

/**
 * Bulk create tasks
 */
const bulkCreateTasks = async (req, res) => {
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'tasks array is required' });
    }

    try {
        const createdTasks = await Task.bulkCreate(tasks);
        res.status(201).json(createdTasks);
    } catch (err) {
        console.error('Error creating tasks:', err);
        res.status(500).json({ error: 'Failed to create tasks' });
    }
};

module.exports = {
    createTask,
    getTasksBySchedule,
    getTasksByUserAndDate,
    getTasksByMonth,
    getTaskById,
    updateTask,
    reorderTask,
    deleteTask,
    getRoutineTasks,
    bulkCreateTasks
};
