const googleCalendarService = require('../services/googleCalendarService');

/**
 * Get OAuth authorization URL
 */
const getAuthUrl = async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    try {
        const authUrl = googleCalendarService.getAuthUrl(userId);
        res.json({ authUrl });
    } catch (err) {
        console.error('Error generating auth URL:', err);
        res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
};

/**
 * OAuth callback handler
 */
const handleCallback = async (req, res) => {
    const { code, state } = req.query; // state contains userId

    if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
        const tokens = await googleCalendarService.getTokensFromCode(code);
        googleCalendarService.setUserTokens(state, tokens);

        // Redirect back to Frontend-service calendar dashboard
        const frontendPort = process.env.FRONTEND_PORT || 5000;
        res.redirect(`http://localhost:${frontendPort}/calendar-dashboard.html?userId=${state}&connected=true`);
    } catch (err) {
        console.error('Error handling OAuth callback:', err);
        res.status(500).json({ error: 'Failed to complete authorization' });
    }
};

/**
 * Check if user is authenticated with Google Calendar
 */
const checkAuth = async (req, res) => {
    const { userId } = req.params;

    try {
        const isAuthenticated = googleCalendarService.isUserAuthenticated(userId);
        let email = null;
        if (isAuthenticated) {
            email = await googleCalendarService.getUserEmail(userId);
        }

        res.json({
            isAuthenticated,
            email,
            authUrl: isAuthenticated ? null : googleCalendarService.getAuthUrl(userId)
        });
    } catch (err) {
        console.error('Error checking auth:', err);
        res.status(500).json({ error: 'Failed to check authentication status' });
    }
};

/**
 * Get events from Google Calendar for a date range
 */
const getEvents = async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    try {
        if (!googleCalendarService.isUserAuthenticated(userId)) {
            return res.status(401).json({
                error: 'Not authenticated',
                authUrl: googleCalendarService.getAuthUrl(userId)
            });
        }

        const events = await googleCalendarService.getEventsForDateRange(userId, startDate, endDate);
        res.json(events);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ error: 'Failed to fetch events from Google Calendar' });
    }
};

/**
 * Manually create an event (Endpoint requested by user)
 */
const createEvent = async (req, res) => {
    const { userId, taskId, summary, title, description, date, timeSlot } = req.body;
    const finalSummary = summary || title;

    if (!userId || !finalSummary || !date) {
        return res.status(400).json({ error: 'userId, summary/title, and date are required' });
    }

    try {
        if (!googleCalendarService.isUserAuthenticated(userId)) {
            return res.status(401).json({
                error: 'Not authenticated with Google Calendar',
                authUrl: googleCalendarService.getAuthUrl(userId)
            });
        }

        const { timezoneOffset } = req.body;

        // Map request body to task-like object expected by service
        const taskData = {
            id: taskId,
            title: finalSummary,
            description: description,
            time_slot: timeSlot,
            category: 'manual'
        };

        // Service expects date as Date object or string. Pass string YYYY-MM-DD
        const result = await googleCalendarService.createEventFromTask(userId, taskData, date, timezoneOffset);
        res.json({ eventId: result.id, htmlLink: result.htmlLink });
    } catch (err) {
        console.error('Error creating event:', err);
        res.status(500).json({
            error: 'Failed to create Google Calendar event',
            details: err.message,
            apiError: err.response?.data
        });
    }
};

module.exports = {
    getAuthUrl,
    handleCallback,
    checkAuth,
    getEvents,
    createEvent
};
