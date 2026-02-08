/**
 * Calendar Dashboard JavaScript
 * Handles task display, completion, and Google Calendar integration
 */

// API Base URL - Calendar Service
const CALENDAR_API = '/calendar/api';

// Current state
let currentDate = new Date();
let currentUserId = null;
let tasks = [];
let fallbackMonth = new Date(); // Track month for fallback calendar
let currentViewMonth = null; // Track loaded Google Calendar month
let monthlyTasks = {}; // Track monthly tasks for dots
let calendarMode = 'WEEK'; // Default view for Google Calendar (Round 4 Reset)

/**
 * Helper: Get YYYY-MM-DD string from local date parts
 */
function getLocalDateString(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// DOM Elements
const elements = {
    tasksList: document.getElementById('tasksList'),
    emptyState: document.getElementById('emptyState'),
    allDoneState: document.getElementById('allDoneState'),
    currentDateDisplay: document.getElementById('currentDateDisplay'),
    dateString: document.getElementById('dateString'),
    progressFill: document.getElementById('progressFill'),
    progressPercent: document.getElementById('progressPercent'),
    completedCount: document.getElementById('completedCount'),
    totalCount: document.getElementById('totalCount'),
    totalPoints: document.getElementById('totalPoints'),
    todayPoints: document.getElementById('todayPoints'),
    weekPoints: document.getElementById('weekPoints'),
    addTaskModal: document.getElementById('addTaskModal'),
    celebration: document.getElementById('celebration'),
    googleCalendarBtn: document.getElementById('googleCalendarBtn'),
    calendarSection: document.getElementById('calendarSection'),
    googleCalendarFrame: document.getElementById('googleCalendarFrame'),
    fallbackCalendarSection: document.getElementById('fallbackCalendarSection'),
    calMonthYear: document.getElementById('calMonthYear'),
    calendarGrid: document.getElementById('calendarGrid'),
    calPrevMonth: document.getElementById('calPrevMonth'),
    calNextMonth: document.getElementById('calNextMonth'),
    earnedPoints: document.getElementById('earnedPoints'),
    viewButtons: document.querySelectorAll('.view-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get user ID from localStorage or URL
    const urlParams = new URLSearchParams(window.location.search);
    currentUserId = localStorage.getItem('userId') || urlParams.get('userId') || 2; // Default to 2 for testing

    initializeEventListeners();
    updateDateDisplay();
    initCalendarViewSelector();
    loadTasks();
    loadPoints();
    loadMonthTasks();
    checkGoogleCalendarAuth();
});

/**
 * Handle date change (shared by all navigation)
 */
function handleDateChange() {
    updateDateDisplay();
    loadTasks();
    renderFallbackCalendar();
    updateGoogleCalendarView();
}

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
    // Date navigation
    document.getElementById('prevDay')?.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        handleDateChange();
    });

    document.getElementById('nextDay')?.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        handleDateChange();
    });

    // Add task modal
    document.getElementById('addTaskBtn')?.addEventListener('click', () => {
        if (elements.addTaskModal) {
            elements.addTaskModal.classList.add('active');
        }
    });

    document.getElementById('closeModal')?.addEventListener('click', () => {
        elements.addTaskModal?.classList.remove('active');
    });

    document.getElementById('cancelTask')?.addEventListener('click', () => {
        elements.addTaskModal?.classList.remove('active');
    });

    // Add task form submission
    document.getElementById('addTaskForm')?.addEventListener('submit', handleAddTask);

    // Google Calendar button
    elements.googleCalendarBtn?.addEventListener('click', connectGoogleCalendar);

    // Fallback Calendar Navigation
    elements.calPrevMonth?.addEventListener('click', () => {
        fallbackMonth.setMonth(fallbackMonth.getMonth() - 1);
        loadMonthTasks();
        renderFallbackCalendar();
    });

    elements.calNextMonth?.addEventListener('click', () => {
        fallbackMonth.setMonth(fallbackMonth.getMonth() + 1);
        loadMonthTasks();
        renderFallbackCalendar();
    });
}

/**
 * Update the date display
 */
function updateDateDisplay() {
    if (!elements.currentDateDisplay) return;

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const currentStr = getLocalDateString(currentDate);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrow);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    if (currentStr === todayStr) {
        elements.currentDateDisplay.textContent = 'Today';
    } else if (currentStr === tomorrowStr) {
        elements.currentDateDisplay.textContent = 'Tomorrow';
    } else if (currentStr === yesterdayStr) {
        elements.currentDateDisplay.textContent = 'Yesterday';
    } else {
        elements.currentDateDisplay.textContent = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    }

    if (elements.dateString) {
        elements.dateString.textContent = currentDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

/**
 * Helper: Get day of week for YYYY-MM-DD without timezone shift
 */
function getLocalDateDay(dateStr) {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3) return new Date().getDay();
    // Using new Date(y, m-1, d) constructor is locale-safe/local-time
    return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
}

/**
 * Helper: Get local date string YYYY-MM-DD
 */
function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Load tasks for the current date
 */
async function loadTasks() {
    try {
        const dateStr = getLocalDateString(currentDate);
        const response = await fetch(`${CALENDAR_API}/logs/today/${currentUserId}?date=${dateStr}`);

        if (response.ok) {
            const data = await response.json();
            tasks = data.tasks || [];
            renderTasks(tasks);
            updateProgress(data.summary || { completed: 0, total: 0 });
        } else {
            // Try loading from tasks endpoint
            const tasksResponse = await fetch(`${CALENDAR_API}/tasks/day/${currentUserId}/${dateStr}`);
            if (tasksResponse.ok) {
                tasks = await tasksResponse.json();
                renderTasks(tasks);
                updateProgress({ completed: 0, total: tasks.length });
            } else {
                showEmptyState();
            }
        }
    } catch (err) {
        console.error('Error loading tasks:', err);
        showEmptyState();
    }
}

/**
 * Render tasks to the DOM
 */
function renderTasks(taskList) {
    if (!elements.tasksList) return;

    if (!taskList || taskList.length === 0) {
        showEmptyState();
        return;
    }

    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.allDoneState) elements.allDoneState.style.display = 'none';

    elements.tasksList.innerHTML = taskList.map((task, index) => {
        const relativeTime = getRelativeTimeLabel(task.time_slot);

        return `
            <div class="task-card task-card-anim ${task.isCompleted ? 'completed' : ''} cat-${(task.category || 'general').toLowerCase()}" 
                 data-task-id="${task.id}"
                 title="${task.description || ''}"
                 style="animation-delay: ${index * 0.1}s">
                <div class="task-checkbox-container" onclick="toggleTask(${task.id}, ${!task.isCompleted})">
                     <div class="checkbox-custom">
                        ${task.isCompleted ? '✓' : ''}
                     </div>
                </div>
                <div class="task-content">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem;">
                        <h4 style="margin: 0; letter-spacing: -0.01em;">${escapeHtml(task.title)}</h4>
                        ${relativeTime && !task.isCompleted ? `<span class="tag" style="background: var(--primary); color: white;">${relativeTime}</span>` : ''}
                    </div>
                    ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                    <div class="task-meta">
                        ${task.time_slot ? `<span style="font-weight: 700; color: var(--primary);">🕒 ${formatTime(task.time_slot)}</span>` : ''}
                        <span class="tag">${getCategoryEmoji(task.category)} ${task.category || 'general'}</span>
                    </div>
                </div>
                <button class="btn-done" 
                        onclick="completeTask(${task.id})"
                        ${task.isCompleted ? 'disabled' : ''}>
                    ${task.isCompleted ? 'Done' : 'Mark Done'}
                </button>
            </div>
        `;
    }).join('');

    // Check if all done
    const allCompleted = taskList.every(t => t.isCompleted);
    if (allCompleted && taskList.length > 0 && elements.allDoneState) {
        elements.allDoneState.style.display = 'block';
    }
}

/**
 * Show empty state
 */
function showEmptyState() {
    if (elements.tasksList) elements.tasksList.innerHTML = '';
    if (elements.emptyState) elements.emptyState.style.display = 'block';
    if (elements.allDoneState) elements.allDoneState.style.display = 'none';
}

/**
 * Update progress display
 */
function updateProgress(summary) {
    if (!elements.progressFill) return;
    const { completed, total } = summary;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    elements.progressFill.style.width = `${percent}%`;
    if (elements.progressPercent) elements.progressPercent.textContent = `${percent}%`;
    if (elements.completedCount) elements.completedCount.textContent = completed;
    if (elements.totalCount) elements.totalCount.textContent = total;
}

/**
 * Complete a task (DONE button clicked)
 */
async function completeTask(taskId) {
    try {
        const dateStr = getLocalDateString(currentDate);

        const response = await fetch(`${CALENDAR_API}/logs/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                userId: parseInt(currentUserId),
                scheduledDate: dateStr
            })
        });

        if (response.ok) {
            const data = await response.json();

            // Show celebration
            showCelebration();

            // Update points display
            if (data.points) {
                if (elements.totalPoints) elements.totalPoints.textContent = data.points.total;
                if (elements.todayPoints) elements.todayPoints.textContent = `+ ${data.points.today}`;
                if (elements.earnedPoints) elements.earnedPoints.textContent = `+ ${data.points.today}`;
            }

            // Reload tasks
            await loadTasks();
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to complete task');
        }
    } catch (err) {
        console.error('Error completing task:', err);
    }
}

/**
 * Toggle task completion (for checkbox)
 */
function toggleTask(taskId, complete) {
    if (complete) {
        completeTask(taskId);
    }
}

/**
 * Show celebration animation
 */
function showCelebration() {
    if (!elements.celebration) return;
    elements.celebration.classList.add('active');

    setTimeout(() => {
        elements.celebration.classList.remove('active');
    }, 2000);
}

/**
 * Load user points
 */
async function loadPoints() {
    try {
        const response = await fetch(`${CALENDAR_API}/points/${currentUserId}`);

        if (response.ok) {
            const data = await response.json();
            if (elements.totalPoints) elements.totalPoints.textContent = data.total || 0;
            if (elements.todayPoints) elements.todayPoints.textContent = `+ ${data.today || 0}`;
            if (elements.weekPoints) elements.weekPoints.textContent = data.thisWeek || 0;
        }
    } catch (err) {
        console.error('Error loading points:', err);
    }
}

/**
 * Handle add task form submission
 */
async function handleAddTask(e) {
    e.preventDefault();

    const title = document.getElementById('taskTitle').value;
    const taskDate = document.getElementById('taskDate')?.value || getLocalDateString(currentDate);
    const timeSlot = document.getElementById('taskTime').value || null;
    const category = document.getElementById('taskCategory').value;
    const description = document.getElementById('taskDescription').value;
    const isRoutine = document.getElementById('isRoutine').checked;

    const dayOfWeek = getLocalDateDay(taskDate);

    try {
        const response = await fetch(`${CALENDAR_API}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: parseInt(currentUserId),
                title,
                timeSlot,
                category,
                isRoutine,
                dayOfWeek,
                targetDate: taskDate,
                description
            })
        });

        if (response.ok) {
            const task = await response.json();
            elements.addTaskModal?.classList.remove('active');
            document.getElementById('addTaskForm').reset();

            // Critical: Push to Google Calendar in background
            syncTaskToGoogle(task, taskDate, timeSlot, description);

            await loadTasks();
            await loadMonthTasks();

            if (elements.googleCalendarFrame && elements.calendarSection.style.display !== 'none') {
                updateGoogleCalendarView({ force: true });
            }
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to add task');
        }
    } catch (err) {
        console.error('Error adding task:', err);
        alert('Failed to add task. Please try again.');
    }
}

/**
 * Push a new task to Google Calendar
 */
async function syncTaskToGoogle(task, date, timeSlot, description) {
    try {
        // Calculate timezone offset (e.g., +08:00)
        const offsetMinutes = -new Date().getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
        const offsetMins = Math.abs(offsetMinutes) % 60;
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const timezoneOffset = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

        const eventData = {
            userId: currentUserId,
            taskId: task.id,
            summary: task.title,
            description: description,
            date: date,
            timeSlot: timeSlot,
            timezoneOffset: timezoneOffset
        };

        const response = await fetch(`${CALENDAR_API}/google-calendar/create-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });

        if (!response.ok) {
            console.warn('Google Calendar sync failed, but task was created locally.');
        }
    } catch (err) {
        console.error('Network error during Google sync:', err);
    }
}

/**
 * Load tasks for entire month
 */
async function loadMonthTasks() {
    try {
        const year = fallbackMonth.getFullYear();
        const month = fallbackMonth.getMonth() + 1; // 1-indexed for API

        const response = await fetch(`${CALENDAR_API}/tasks/month/${currentUserId}/${year}/${month}`);

        if (response.ok) {
            const tasks = await response.json();

            // Group tasks by date
            monthlyTasks = {};
            tasks.forEach(task => {
                // Support multiple backend field names (task_date from model, targetDate from legacy)
                let rawDate = task.task_date || task.targetDate || task.scheduled_date;
                let dateStr = '';

                if (rawDate) {
                    // Handle if backend returns actual Date string or object
                    if (typeof rawDate === 'string') {
                        dateStr = rawDate.split('T')[0];
                    } else {
                        // Fallback often needed if JSON parser auto-converts or if handling raw objects (unlikely in fetch json but safe)
                        dateStr = String(rawDate).split('T')[0];
                    }

                    if (dateStr) {
                        if (!monthlyTasks[dateStr]) {
                            monthlyTasks[dateStr] = [];
                        }
                        monthlyTasks[dateStr].push(task);
                    }
                }
            });

            renderFallbackCalendar();
        }
    } catch (err) {
        console.error('Error loading monthly tasks:', err);
    }
}

/**
 * Check Google Calendar authentication status
 */
async function checkGoogleCalendarAuth() {
    try {
        const response = await fetch(`${CALENDAR_API}/google-calendar/check/${currentUserId}`);

        if (response.ok) {
            const data = await response.json();

            if (data.isAuthenticated) {
                if (data.email) window.connectedEmail = data.email;
                showConnectedState();
                showEmbeddedCalendar();
            } else {
                showFallbackCalendar();
            }
        } else {
            showFallbackCalendar();
        }
    } catch (err) {
        console.error('Error checking Google Calendar auth:', err);
        showFallbackCalendar();
    }
}

/**
 * Connect to Google Calendar
 * Uses page redirect instead of popup to avoid Cross-Origin-Opener-Policy issues
 */
async function connectGoogleCalendar() {
    try {
        const response = await fetch(`${CALENDAR_API}/google-calendar/auth/${currentUserId}`);

        if (response.ok) {
            const data = await response.json();

            if (data.authUrl) {
                // Redirect to Google OAuth instead of popup (avoids COOP issues)
                window.location.href = data.authUrl;
            }
        }
    } catch (err) {
        console.error('Error connecting to Google Calendar:', err);
        alert('Failed to connect to Google Calendar. Please try again.');
    }
}

/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Helper: Format time (HH:MM to 12-hour)
 */
function formatTime(timeStr) {
    if (!timeStr) return '';

    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Helper: Get relative time label (e.g., "In 2h", "Started")
 */
function getRelativeTimeLabel(timeStr) {
    if (!timeStr) return null;

    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const taskTime = new Date(now);
    taskTime.setHours(hours, minutes, 0, 0);

    const diffMs = taskTime - now;
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < -30) return null; // Too long ago
    if (diffMins < 0) return "Started";
    if (diffMins < 60) return `In ${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `In ${diffHours}h ${remMins > 0 ? remMins + 'm' : ''}`;
}

/**
 * Helper: Get emoji for category
 */
function getCategoryEmoji(category) {
    const emojis = {
        general: '📌',
        breakfast: '🍳',
        lunch: '🥗',
        dinner: '🍽️',
        hygiene: '🧼',
        exercise: '🏃',
        medication: '💊',
        social: '👥'
    };
    return emojis[(category || 'general').toLowerCase()] || '📌';
}

/**
 * UI State Switches
 */
function showConnectedState() {
    if (elements.googleCalendarBtn) {
        elements.googleCalendarBtn.innerHTML = '<span class="google-icon">✓</span> Calendar Connected';
        elements.googleCalendarBtn.style.background = '#d1fae5';
        elements.googleCalendarBtn.style.color = '#059669';
    }
    const viewSelector = document.getElementById('calendarViewSelector');
    if (viewSelector) viewSelector.style.display = 'flex';
}

function showEmbeddedCalendar() {
    if (elements.calendarSection) elements.calendarSection.style.display = 'block';
    if (elements.fallbackCalendarSection) elements.fallbackCalendarSection.style.display = 'none';
    updateGoogleCalendarView({ force: true });
}

function showFallbackCalendar() {
    if (elements.calendarSection) elements.calendarSection.style.display = 'none';
    if (elements.fallbackCalendarSection) elements.fallbackCalendarSection.style.display = 'block';
    renderFallbackCalendar();
}

/**
 * Render the custom fallback calendar
 */
function renderFallbackCalendar() {
    if (!elements.calendarGrid) return;

    const year = fallbackMonth.getFullYear();
    const month = fallbackMonth.getMonth();

    // Update header
    if (elements.calMonthYear) {
        elements.calMonthYear.textContent = fallbackMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    let html = '';

    // Empty cells for previous month
    for (let i = 0; i < startingDay; i++) {
        html += `<div class="cal-day empty"></div>`;
    }

    const today = new Date();

    for (let day = 1; day <= totalDays; day++) {
        const dateToCheck = new Date(year, month, day);
        const isToday = dateToCheck.toDateString() === today.toDateString();
        const isActive = dateToCheck.toDateString() === currentDate.toDateString();

        // Check for tasks
        const dateStr = getLocalDateString(dateToCheck);
        const tasksForDay = monthlyTasks[dateStr] || [];
        const hasTasks = tasksForDay.length > 0;

        let classes = 'cal-day';
        if (isToday) classes += ' today';
        if (isActive) classes += ' active';
        if (hasTasks) classes += ' has-task';

        // Build Task HTML
        let taskHtml = '';
        if (hasTasks) {
            taskHtml = `<div class="day-tasks">`;
            const displayTasks = tasksForDay.slice(0, 3); // Increased to 3
            taskHtml += displayTasks.map(t => {
                const catClass = t.category ? `cat-${t.category.toLowerCase()}` : '';
                const displayTime = t.time_slot ? `<span style="opacity:0.8; margin-right:4px;">${formatTime(t.time_slot)}</span>` : '';
                const fullTitle = t.description ? `${t.title}\n\n${t.description}` : t.title;
                return `<div class="task-marker ${catClass}" title="${escapeHtml(fullTitle)}">${displayTime}${escapeHtml(t.title)}</div>`;
            }).join('');

            if (tasksForDay.length > 3) {
                taskHtml += `<div class="task-marker more-badge">+${tasksForDay.length - 3} more</div>`;
            }
            taskHtml += `</div>`;
        }

        html += `
            <div class="${classes}" onclick="selectDate(${year}, ${month}, ${day})">
                <span class="day-number">${day}</span>
                ${taskHtml}
            </div>
        `;
    }

    elements.calendarGrid.innerHTML = html;
}

/**
 * Handle date selection from fallback calendar
 */
function selectDate(year, month, day) {
    currentDate = new Date(year, month, day);
    handleDateChange();
}

/**
 * Update Google Calendar Iframe View if Month Changes
 */
function updateGoogleCalendarView(options = {}) {
    if (!elements.googleCalendarFrame || !elements.calendarSection || elements.calendarSection.style.display === 'none') return;

    const { force = false } = options;
    const newMonthKey = currentDate.getFullYear() + '-' + currentDate.getMonth();

    // Allow force update if src is empty or month changed
    if (force || newMonthKey !== currentViewMonth || !elements.googleCalendarFrame.src) {
        currentViewMonth = newMonthKey;

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); // 0-indexed

        // Calculate YYYYMMDD for start and end of month
        // Month needs +1 for YYYYMM format
        const startMonthStr = String(month + 1).padStart(2, '0');
        const start = `${year}${startMonthStr}01`;

        const lastDay = new Date(year, month + 1, 0).getDate();
        const end = `${year}${startMonthStr}${String(lastDay).padStart(2, '0')}`;

        const datesParam = `${start}/${end}`;

        const timeZone = 'Asia/Singapore';
        const calendarId = window.connectedEmail || 'primary';

        // Use global calendarMode
        const baseUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=${encodeURIComponent(timeZone)}&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0&mode=${calendarMode}`;

        elements.googleCalendarFrame.src = `${baseUrl}&dates=${datesParam}&_t=${Date.now()}`;
    }
}

/**
 * Initialize View Selector Listeners
 */
function initCalendarViewSelector() {
    if (!elements.viewButtons) return;

    elements.viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-view');

            // Update UI
            elements.viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update State & Frame
            calendarMode = mode;
            updateGoogleCalendarView({ force: true });
        });
    });
}

// Export for global access
window.selectDate = selectDate;
window.completeTask = completeTask;
window.toggleTask = toggleTask;
