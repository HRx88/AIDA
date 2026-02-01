const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Google Calendar Service
 * Handles OAuth2 authentication and calendar operations
 */

// OAuth2 Client Configuration
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5003/api/google-calendar/callback'
);

// Calendar API instance
let calendar = null;

/**
 * Store user tokens (in production, save to database)
 * Map: userId -> tokens
 */
const userTokens = new Map();

/**
 * Generate OAuth2 authorization URL
 */
const getAuthUrl = (userId) => {
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: userId.toString(), // Pass userId for callback
        prompt: 'consent' // Force consent to get refresh token
    });
};

/**
 * Exchange authorization code for tokens
 */
const getTokensFromCode = async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

/**
 * Set user's OAuth tokens
 */
const setUserTokens = (userId, tokens) => {
    userTokens.set(userId.toString(), tokens);
    oauth2Client.setCredentials(tokens);
    calendar = google.calendar({ version: 'v3', auth: oauth2Client });
};

/**
 * Get authenticated calendar instance for a user
 */
const getCalendarForUser = (userId) => {
    const tokens = userTokens.get(userId.toString());
    if (!tokens) {
        throw new Error('User not authenticated with Google Calendar');
    }
    oauth2Client.setCredentials(tokens);
    return google.calendar({ version: 'v3', auth: oauth2Client });
};

/**
 * Check if user is authenticated
 */
const isUserAuthenticated = (userId) => {
    return userTokens.has(userId.toString());
};

/**
 * Create a calendar event from a task
 */
const createEventFromTask = async (userId, task, date, timezoneOffset = '+08:00') => {
    const cal = getCalendarForUser(userId);

    // Build event start/end times
    let dateStr;
    const pad = n => String(n).padStart(2, '0');

    if (date instanceof Date) {
        // Ensure we get YYYY-MM-DD relative to local date parts
        dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    } else {
        dateStr = String(date).split('T')[0];
    }

    let timeStr = '09:00:00';
    if (task.time_slot) {
        timeStr = `${task.time_slot}:00`;
    }

    // Construct RFC3339 string with provided offset
    const startDateTimeStr = `${dateStr}T${timeStr}${timezoneOffset}`;

    // End time (1 hour later)
    let endHours = parseInt(timeStr.split(':')[0]) + 1;
    let endMinutes = timeStr.split(':')[1];
    let endDateStr = dateStr;

    if (endHours >= 24) {
        endHours -= 24;
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 1);
        endDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    const endDateTimeStr = `${endDateStr}T${pad(endHours)}:${endMinutes}:00${timezoneOffset}`;

    const event = {
        summary: task.title,
        description: task.description || `Category: ${task.category}`,
        start: {
            dateTime: startDateTimeStr
        },
        end: {
            dateTime: endDateTimeStr
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'popup', minutes: 15 }
            ]
        }
    };

    const response = await cal.events.insert({
        calendarId: 'primary',
        resource: event
    });

    return response.data;
};

/**
 * Sync all tasks for a week to Google Calendar
 */
const syncWeekToCalendar = async (userId, tasks, weekStart) => {
    const cal = getCalendarForUser(userId);
    const results = [];

    for (const task of tasks) {
        try {
            // Calculate the actual date for this task
            const taskDate = new Date(weekStart);
            taskDate.setDate(taskDate.getDate() + task.day_of_week);

            const event = await createEventFromTask(userId, task, taskDate);
            results.push({ taskId: task.id, eventId: event.id, status: 'created' });
        } catch (err) {
            results.push({ taskId: task.id, error: err.message, status: 'failed' });
        }
    }

    return results;
};

/**
 * Get events from Google Calendar for a date range
 */
const getEventsForDateRange = async (userId, startDate, endDate) => {
    const cal = getCalendarForUser(userId);

    const response = await cal.events.list({
        calendarId: 'primary',
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate).toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
    });

    return response.data.items;
};

/**
 * Delete an event from Google Calendar
 */
const deleteEvent = async (userId, eventId) => {
    const cal = getCalendarForUser(userId);

    await cal.events.delete({
        calendarId: 'primary',
        eventId: eventId
    });

    return true;
};

/**
 * Update an event in Google Calendar
 */
const updateEvent = async (userId, eventId, updates) => {
    const cal = getCalendarForUser(userId);

    // Get existing event
    const existing = await cal.events.get({
        calendarId: 'primary',
        eventId: eventId
    });

    // Merge updates
    const updatedEvent = {
        ...existing.data,
        ...updates
    };

    const response = await cal.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: updatedEvent
    });

    return response.data;
};

/**
 * Get user email (Principal ID of primary calendar)
 */
const getUserEmail = async (userId) => {
    try {
        const cal = getCalendarForUser(userId);
        const response = await cal.calendars.get({ calendarId: 'primary' });
        return response.data.id;
    } catch (err) {
        console.error('Error fetching user email:', err);
        return 'primary';
    }
};

module.exports = {
    getAuthUrl,
    getTokensFromCode,
    setUserTokens,
    isUserAuthenticated,
    createEventFromTask,
    syncWeekToCalendar,
    getEventsForDateRange,
    deleteEvent,
    updateEvent,
    getUserEmail
};
