const TaskLog = require('../models/taskLogModel');
const Points = require('../models/pointsModel');
const Task = require('../models/taskModel');

// Points per task completion (can be made configurable later)
const POINTS_PER_TASK = 10;

const getLocalDateString = () => {
  // Singapore time (UTC+8). If you deploy elsewhere later, you can change this.
  const now = new Date();
  const sg = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  return sg.toISOString().split("T")[0];
};

/**
 * Mark a task as complete (DONE button clicked)
 * This is the main cloud logging endpoint
 */
const completeTask = async (req, res) => {
    
    const { taskId, userId, scheduledDate, notes } = req.body;

    if (!taskId || !userId) {
        return res.status(400).json({ error: 'taskId and userId are required' });
    }

    // Use current date if not provided
    const date = scheduledDate || getLocalDateString();

    try {
        // Check if task exists
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if already completed today
        const alreadyCompleted = await TaskLog.isTaskCompleted(taskId, date);
        if (alreadyCompleted) {
            return res.status(400).json({ error: 'Task already completed for this date' });
        }

        // Log completion
        const log = await TaskLog.logCompletion({
            taskId,
            userId,
            scheduledDate: date,
            status: 'done',
            notes
        });

        // Award points
        const pointsAwarded = await Points.addPoints({
            userId,
            points: POINTS_PER_TASK,
            reason: `Completed: ${task.title}`,
            taskId
        });

        // Get updated totals
        const totalPoints = await Points.getBalance(userId);
        const todayPoints = await Points.getTodayPoints(userId);

        res.status(201).json({
            message: 'Task completed successfully!',
            log,
            points: {
                awarded: POINTS_PER_TASK,
                today: todayPoints,
                total: totalPoints
            }
        });
    } catch (err) {
        console.error('Error completing task:', err);
        res.status(500).json({ error: 'Failed to complete task' });
    }
};

/**
 * Get completion logs for a user on a specific date
 */
const getLogsByDate = async (req, res) => {
    const { userId, date } = req.params;

    try {
        const logs = await TaskLog.findByUserAndDate(userId, date);
        res.json(logs);
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};

/**
 * Get completion logs for a user in a week
 */
const getLogsByWeek = async (req, res) => {
    const { userId, weekStart } = req.params;

    try {
        const logs = await TaskLog.findByUserAndWeek(userId, weekStart);
        res.json(logs);
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};

/**
 * Get completion statistics for a user
 */
const getStats = async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    try {
        const stats = await TaskLog.getStats(userId, startDate, endDate);
        const dailyBreakdown = startDate && endDate
            ? await TaskLog.getDailyBreakdown(userId, startDate, endDate)
            : null;

        res.json({ stats, dailyBreakdown });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

/**
 * Get today's task completion status
 */
const getTodayStatus = async (req, res) => {
    const { userId } = req.params;
    const { date } = req.query;

    // Use provided date or default to today (Singapore time)
    const today = date || getLocalDateString();

    try {
        // Get tasks for the target date
        const tasks = await Task.findByUserAndDate(userId, today);

        // Get completed tasks for the target date
        const logs = await TaskLog.findByUserAndDate(userId, today);
        const completedTaskIds = new Set(logs.map(l => l.task_id));

        // Mark which tasks are completed
        const tasksWithStatus = tasks.map(task => ({
            ...task,
            isCompleted: completedTaskIds.has(task.id)
        }));

        const completed = tasksWithStatus.filter(t => t.isCompleted).length;
        const total = tasksWithStatus.length;

        res.json({
            date: today,
            tasks: tasksWithStatus,
            summary: {
                total,
                completed,
                remaining: total - completed,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
            }
        });
    } catch (err) {
        console.error("Error fetching today status FULL:", err?.stack || err);
        res.status(500).json({ error: 'Failed to fetch today status' });
    }
};

module.exports = {
    completeTask,
    getLogsByDate,
    getLogsByWeek,
    getStats,
    getTodayStatus
};
