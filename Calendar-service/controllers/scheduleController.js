const Schedule = require('../models/scheduleModel');
const Task = require('../models/taskModel');
const googleCalendarService = require('../services/googleCalendarService');

/**
 * Create a new weekly schedule
 */
const createSchedule = async (req, res) => {
    const { userId, weekStart, isTemplate } = req.body;

    if (!userId || !weekStart) {
        return res.status(400).json({ error: 'userId and weekStart are required' });
    }

    try {
        const schedule = await Schedule.create({
            userId,
            weekStart,
            createdBy: 'user',
            isTemplate: isTemplate || false
        });
        res.status(201).json(schedule);
    } catch (err) {
        console.error('Error creating schedule:', err);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
};

/**
 * Get all schedules for a user
 */
const getSchedulesByUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const schedules = await Schedule.findByUserId(userId);
        res.json(schedules);
    } catch (err) {
        console.error('Error fetching schedules:', err);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
};

/**
 * Get current week's schedule for a user
 */
const getCurrentSchedule = async (req, res) => {
    const { userId } = req.params;

    try {
        let schedule = await Schedule.findCurrentWeek(userId);

        // If no current schedule, optionally create one from template
        if (!schedule) {
            return res.json({ message: 'No schedule found for current week', schedule: null });
        }

        // Get tasks for this schedule
        const tasks = await Task.findByScheduleId(schedule.id);

        res.json({ schedule, tasks });
    } catch (err) {
        console.error('Error fetching current schedule:', err);
        res.status(500).json({ error: 'Failed to fetch current schedule' });
    }
};

/**
 * Get schedule by ID
 */
const getScheduleById = async (req, res) => {
    const { id } = req.params;

    try {
        const schedule = await Schedule.findById(id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        const tasks = await Task.findByScheduleId(id);
        res.json({ schedule, tasks });
    } catch (err) {
        console.error('Error fetching schedule:', err);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
};

/**
 * Update a schedule
 */
const updateSchedule = async (req, res) => {
    const { id } = req.params;
    const { weekStart, isTemplate } = req.body;

    try {
        const schedule = await Schedule.update(id, { weekStart, isTemplate });
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        res.json(schedule);
    } catch (err) {
        console.error('Error updating schedule:', err);
        res.status(500).json({ error: 'Failed to update schedule' });
    }
};

/**
 * Delete a schedule
 */
const deleteSchedule = async (req, res) => {
    const { id } = req.params;

    try {
        const schedule = await Schedule.delete(id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        res.json({ message: 'Schedule deleted', schedule });
    } catch (err) {
        console.error('Error deleting schedule:', err);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
};

/**
 * Generate AI schedule from template/routine tasks
 * Creates a new week schedule based on user's routine preferences
 */
const generateAISchedule = async (req, res) => {
    const { userId } = req.params;
    const { weekStart } = req.body;

    if (!weekStart) {
        return res.status(400).json({ error: 'weekStart is required' });
    }

    try {
        // Get user's routine tasks
        const routineTasks = await Task.getRoutineTasks(userId);

        if (routineTasks.length === 0) {
            // Create default routine if none exists
            return res.status(400).json({
                error: 'No routine tasks found. Please create some routine tasks first.',
                suggestion: 'Create routine tasks with isRoutine: true to enable AI scheduling'
            });
        }

        // Create new schedule
        const schedule = await Schedule.create({
            userId,
            weekStart,
            createdBy: 'ai',
            isTemplate: false
        });

        // Copy routine tasks to new schedule
        const newTasks = routineTasks.map((task, index) => ({
            scheduleId: schedule.id,
            userId: parseInt(userId),
            title: task.title,
            description: task.description,
            dayOfWeek: task.day_of_week,
            timeSlot: task.time_slot,
            category: task.category,
            isRoutine: false, // Not a template, actual task
            orderIndex: index
        }));

        const createdTasks = await Task.bulkCreate(newTasks);

        // Sync to Google Calendar if authenticated
        let syncResult = null;
        if (googleCalendarService.isUserAuthenticated(userId)) {
            try {
                syncResult = await googleCalendarService.syncWeekToCalendar(userId, createdTasks, weekStart);
            } catch (syncErr) {
                console.error('Google Calendar sync error:', syncErr);
                syncResult = { error: 'Calendar sync failed, tasks created locally' };
            }
        }

        res.status(201).json({
            message: 'AI schedule generated successfully',
            schedule,
            tasks: createdTasks,
            googleCalendarSync: syncResult
        });
    } catch (err) {
        console.error('Error generating AI schedule:', err);
        res.status(500).json({ error: 'Failed to generate AI schedule' });
    }
};

/**
 * Sync schedule to Google Calendar
 */
const syncToGoogleCalendar = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    try {
        if (!googleCalendarService.isUserAuthenticated(userId)) {
            return res.status(401).json({
                error: 'Not authenticated with Google Calendar',
                authUrl: googleCalendarService.getAuthUrl(userId)
            });
        }

        const schedule = await Schedule.findById(id);
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        const tasks = await Task.findByScheduleId(id);
        const syncResult = await googleCalendarService.syncWeekToCalendar(userId, tasks, schedule.week_start);

        res.json({ message: 'Sync complete', results: syncResult });
    } catch (err) {
        console.error('Error syncing to Google Calendar:', err);
        res.status(500).json({ error: 'Failed to sync to Google Calendar' });
    }
};

module.exports = {
    createSchedule,
    getSchedulesByUser,
    getCurrentSchedule,
    getScheduleById,
    updateSchedule,
    deleteSchedule,
    generateAISchedule,
    syncToGoogleCalendar
};
