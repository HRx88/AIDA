// Client Dashboard JavaScript
const VIDEO_SERVICE = '/calls/api/calls';

const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user'));

if (!token || !currentUser) {
    window.location.href = '/';
}
let emergencyReason = 'Emergency assistance needed';
let previousScheduledIds = [];
let currentIncomingCall = null;
let ringtone = null;
let callingSound = null;

// Track notification attempts per call (max 3) - persisted across refresh
const MAX_NOTIFICATION_ATTEMPTS = 3;
function getNotificationAttempts() {
    const stored = localStorage.getItem('callNotificationAttempts');
    return stored ? JSON.parse(stored) : {};
}
function saveNotificationAttempts(attempts) {
    localStorage.setItem('callNotificationAttempts', JSON.stringify(attempts));
}

let emergencyPollInterval = null;
let isInCall = false; // Tracks if client is currently in a video call

// Toast notification system (replaces alerts)
function showToast(message, type = 'info') {
    // Remove any existing toast
    const existing = document.getElementById('toastNotification');
    if (existing) existing.remove();

    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        warning: 'bg-amber-500',
        info: 'bg-blue-500'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.className = `fixed top-6 right-6 z-[9999] ${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-slide-in max-w-md`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type]} text-xl"></i>
        <span class="font-medium">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 hover:opacity-70 transition-opacity">
            <i class="fa-solid fa-times"></i>
        </button>
    `;
    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => toast.remove(), 5000);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    ringtone = document.getElementById('ringtone');
    callingSound = document.getElementById('callingSound');

    document.getElementById('userName').textContent = currentUser.fullName || 'Client';

    // Display profile image in sidebar if available
    if (currentUser.profileImageUrl) {
        const avatarContainer = document.querySelector('.user-details')?.previousElementSibling;
        if (avatarContainer && avatarContainer.classList.contains('bg-slate-200')) {
            const fullUrl = currentUser.profileImageUrl.startsWith('http')
                ? currentUser.profileImageUrl
                : `/auth${currentUser.profileImageUrl}`;
            avatarContainer.innerHTML = `<img src="${fullUrl}" class="w-full h-full object-cover rounded-full">`;
        }
    }

    loadCalls();
    // Poll for active calls every 10 seconds
    setInterval(checkForActiveCalls, 10000);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

async function loadCalls() {
    try {
        const response = await fetch(`${VIDEO_SERVICE}/client/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const now = new Date();
        const EXPIRY_HOURS = 2; // Calls move to history after 2 hours past scheduled time

        // Filter scheduled calls - show if status is 'scheduled' or 'active' AND not stale
        const scheduled = data.calls.filter(c => {
            if (c.call_type !== 'checkin') return false;
            // Completed or cancelled always go to history
            if (['completed', 'cancelled'].includes(c.status)) return false;

            const callTime = new Date(c.scheduled_time);
            const diffHours = (now - callTime) / 3600000;
            // Show scheduled or active calls if within 2 hours after scheduled time
            return diffHours < EXPIRY_HOURS;
        });

        // History - completed, cancelled, OR any call past 2 hours after scheduled time
        const history = data.calls.filter(c => {
            // Explicitly finalized calls always go to history
            if (['completed', 'cancelled'].includes(c.status)) return true;

            if (c.call_type === 'checkin') {
                const callTime = new Date(c.scheduled_time);
                const diffHours = (now - callTime) / 3600000;
                // If 2+ hours past scheduled time (stale), move to history
                return diffHours >= EXPIRY_HOURS;
            }
            return false;
        });

        previousScheduledIds = scheduled.map(c => c.id);

        renderScheduledCalls(scheduled);
        renderHistory(history);

        return scheduled;
    } catch (err) {
        console.error('Failed to load calls:', err);
        document.getElementById('scheduledList').innerHTML =
            '<p class="text-blue-200">No scheduled calls</p>';
        return [];
    }
}

async function checkForActiveCalls() {
    try {
        const response = await fetch(`${VIDEO_SERVICE}/client/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const now = new Date();
        const EXPIRY_HOURS = 2;

        // Filter scheduled calls for internal tracking
        const scheduled = data.calls.filter(c => {
            if (c.call_type !== 'checkin') return false;
            if (['completed', 'cancelled'].includes(c.status)) return false;
            const callTime = new Date(c.scheduled_time);
            const diffHours = (now - callTime) / 3600000;
            return diffHours < EXPIRY_HOURS;
        });
        const activeCalls = data.calls.filter(c => c.status === 'active' && c.call_type === 'checkin');

        // Check for active calls (staff clicked 'Start Call')
        // Skip if client is already in a call
        if (activeCalls.length > 0 && !isInCall) {
            const activeCall = activeCalls[0];
            const attempts = getNotificationAttempts();

            // Initialize attempt counter for this call
            if (!attempts[activeCall.id]) {
                attempts[activeCall.id] = 0;
            }

            // Increment attempt on every poll cycle while call is active
            if (attempts[activeCall.id] < MAX_NOTIFICATION_ATTEMPTS) {
                attempts[activeCall.id]++;
                saveNotificationAttempts(attempts);
                console.log(`Call notification attempt ${attempts[activeCall.id]}/${MAX_NOTIFICATION_ATTEMPTS}`);

                // Show notification if not already showing (prevents flickering)
                if (!currentIncomingCall || currentIncomingCall.id !== activeCall.id) {
                    showIncomingCallNotification(activeCall);
                } else {
                    // Just ensure modal is visible if it was closed by mistake
                    const modal = document.getElementById('incomingCallModal');
                    if (modal && modal.classList.contains('hidden')) {
                        showIncomingCallNotification(activeCall);
                    }
                }
            } else if (attempts[activeCall.id] === MAX_NOTIFICATION_ATTEMPTS) {
                // Max attempts reached - mark as missed and stop
                console.log('Max notification attempts reached - marking call as missed');
                attempts[activeCall.id]++;
                saveNotificationAttempts(attempts);
                markCallAsMissed(activeCall.id);
            }
        }

        // Clean up old attempt entries for calls no longer active
        const cleanupAttempts = getNotificationAttempts();
        const currentActiveIds = new Set(activeCalls.map(c => c.id.toString()));
        let changed = false;
        for (const id of Object.keys(cleanupAttempts)) {
            if (!currentActiveIds.has(id)) {
                delete cleanupAttempts[id];
                changed = true;
            }
        }
        if (changed) saveNotificationAttempts(cleanupAttempts);

        previousScheduledIds = scheduled.map(c => c.id);
        renderScheduledCalls(scheduled);

    } catch (err) {
        console.error('Error checking calls:', err);
    }
}

// Mark call as missed after max attempts (uses 'cancelled' status)
async function markCallAsMissed(callId) {
    try {
        await fetch(`${VIDEO_SERVICE}/${callId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'cancelled', notes: 'Call not answered after 3 attempts' })
        });
        // Hide notification modal if showing
        if (ringtone) ringtone.pause();
        document.getElementById('incomingCallModal').classList.add('hidden');
        currentIncomingCall = null;
        console.log('Call marked as cancelled (not answered)');
    } catch (err) {
        console.error('Error marking call as missed:', err);
    }
}

function showIncomingCallNotification(call) {
    currentIncomingCall = call;

    // Update modal content
    document.getElementById('callerName').textContent = call.staff_name || 'Staff Member';

    // Show modal and play ringtone
    document.getElementById('incomingCallModal').classList.remove('hidden');

    // Play ringtone
    if (ringtone) {
        ringtone.currentTime = 0;
        ringtone.play().catch(e => console.log('Audio autoplay blocked:', e));
    }

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Incoming Call - AIDA', {
            body: `${call.staff_name || 'Staff'} is calling for your check-in`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3616/3616215.png'
        });
    }
}

function answerIncomingCall() {
    if (ringtone) ringtone.pause();
    document.getElementById('incomingCallModal').classList.add('hidden');

    if (currentIncomingCall && currentIncomingCall.room_url) {
        // Save call ID so endCall can mark it as completed
        localStorage.setItem('currentCallId', currentIncomingCall.id);
        joinCall(currentIncomingCall.room_url);
    }
    currentIncomingCall = null;
}

function declineIncomingCall() {
    if (ringtone) ringtone.pause();
    document.getElementById('incomingCallModal').classList.add('hidden');
    currentIncomingCall = null;
}

function renderScheduledCalls(calls) {
    const list = document.getElementById('scheduledList');

    if (calls.length === 0) {
        list.innerHTML = `
            <div class="card p-12 text-center border-dashed">
                <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-calendar-xmark text-2xl text-slate-400"></i>
                </div>
                <p class="text-slate-900 font-bold">Your schedule is clear</p>
                <p class="text-slate-500 text-sm mt-1">No upcoming calls at the moment.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = calls.map(call => {
        const callTime = new Date(call.scheduled_time);
        const now = new Date();
        const diffMinutes = (callTime - now) / 60000;

        let statusText = 'Scheduled';
        let badgeClass = 'badge-primary';
        let isNow = false;

        if (call.status === 'active') {
            statusText = 'Live';
            badgeClass = 'badge-success animate-pulse';
            isNow = true;
        } else if (diffMinutes < 0) {
            statusText = 'Overdue';
            badgeClass = 'badge-danger';
            isNow = true; // Use the same styling as 'Live' for urgency
        } else if (diffMinutes <= 15) {
            statusText = 'Live';
            badgeClass = 'badge-success';
            isNow = true;
        }

        return `
        <div class="card p-5 flex flex-col sm:flex-row justify-between items-center ${isNow ? 'border-blue-200 bg-blue-50/30' : ''}">
            <div class="flex items-center space-x-4 mb-4 sm:mb-0 w-full sm:w-auto">
                <div class="call-icon ${isNow ? 'now' : 'upcoming'}">
                    <i class="fa-solid ${isNow ? 'fa-video' : 'fa-calendar'}"></i>
                </div>
                <div>
                    <div class="flex items-center space-x-2 mb-0.5">
                        <h3 class="font-bold text-slate-900 text-base">Check-in with ${call.staff_name || 'Staff'}</h3>
                        <span class="badge ${badgeClass}">
                            ${statusText}
                        </span>
                    </div>
                    <p class="text-slate-500 flex items-center text-xs font-medium">
                        <i class="fa-solid fa-clock-rotate-left mr-1.5 opacity-50"></i>
                        ${new Date(call.scheduled_time).toLocaleString('en-SG', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })}
                    </p>
                    ${call.notes ? `<p class="text-slate-400 text-[11px] mt-2 italic leading-relaxed">"${call.notes}"</p>` : ''}
                </div>
            </div>
            <button onclick="joinCall('${call.room_url}', ${call.id})"
                class="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm ${isNow
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }">
                <i class="fa-solid fa-video mr-2"></i> Join
            </button>
        </div>
    `}).join('');
}

function renderHistory(calls) {
    const list = document.getElementById('historyList');

    if (calls.length === 0) {
        list.innerHTML = `
            <div class="p-6 text-center text-slate-500 italic text-sm">
                <p>No past calls recorded.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = calls.map(call => {
        const isCancelled = call.status === 'cancelled';
        return `
        <div class="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg ${call.call_type === 'emergency' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}">
                    <i class="fa-solid ${call.call_type === 'emergency' ? 'fa-truck-medical' : 'fa-calendar-check'}"></i>
                </div>
                <div>
                    <p class="font-bold text-sm text-slate-900">
                        ${call.call_type === 'emergency' ? 'Emergency SOS' : 'Check-in'}
                    </p>
                    <p class="text-xs text-slate-500">with ${call.staff_name || 'Staff'}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-xs font-bold text-slate-600">
                    ${new Date(call.created_at || call.scheduled_time).toLocaleDateString('en-SG', {
            day: 'numeric',
            month: 'short'
        })}
                </p>
                <div class="flex items-center justify-end text-[10px] font-bold ${isCancelled ? 'text-red-500' : 'text-green-600'} uppercase">
                    <i class="fa-solid ${isCancelled ? 'fa-xmark-circle' : 'fa-check-circle'} mr-1"></i>
                    ${isCancelled ? 'Missed' : 'Done'}
                </div>
            </div>
        </div>
    `}).join('');
}

function joinCall(url, callId) {
    if (ringtone) ringtone.pause();
    isInCall = true; // Stop incoming call notifications while in call

    // Save call ID for endCall to mark as completed
    if (callId) {
        localStorage.setItem('currentCallId', callId);
    }

    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('inCallView').classList.remove('hidden');
    document.getElementById('callFrame').src = url;
}

function setReason(reason) {
    emergencyReason = reason;
    document.querySelectorAll('.reason-btn').forEach(btn => {
        btn.classList.remove('border-red-500/50', 'bg-red-500/5', 'text-red-400');
    });
    // Add highlighting for selected reason
    const selectedBtn = event.target.closest('button');
    selectedBtn.classList.add('border-red-500/50', 'bg-red-500/5', 'text-red-400');
}

let isCallingEmergency = false; // Guard to prevent duplicate calls

async function startEmergencyCall() {
    // Prevent duplicate calls if already in progress
    if (isCallingEmergency) {
        console.log('Emergency call already in progress, ignoring duplicate click');
        return;
    }
    isCallingEmergency = true;

    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('callingView').classList.remove('hidden');

    // Play calling sound
    if (callingSound) {
        callingSound.currentTime = 0;
        callingSound.play().catch(e => console.log('Audio blocked:', e));
    }

    try {
        const response = await fetch(`${VIDEO_SERVICE}/emergency`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                clientId: currentUser.id,
                emergencyReason: emergencyReason
            })
        });

        const data = await response.json();

        if (response.ok && data.callId) {
            console.log(`Emergency created with ID: ${data.callId}. Waiting for staff to answer...`);

            // Poll for status change: wait until it becomes 'active' (staff answered)
            emergencyPollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${VIDEO_SERVICE}/${data.callId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const callData = await statusRes.json();

                    if (callData.status === 'active') {
                        if (emergencyPollInterval) clearInterval(emergencyPollInterval);
                        if (callingSound) callingSound.pause();

                        document.getElementById('callingView').classList.add('hidden');
                        document.getElementById('inCallView').classList.remove('hidden');
                        document.getElementById('callFrame').src = callData.room_url;
                    } else if (callData.status === 'cancelled' || callData.status === 'completed') {
                        // Call was declined or ended before answer
                        if (emergencyPollInterval) clearInterval(emergencyPollInterval);
                        cancelCall();
                    }
                } catch (err) {
                    console.error('Error checking emergency status:', err);
                }
            }, 3000); // Check every 3 seconds

            // Auto-cancel after 2 minutes if no one answers
            setTimeout(() => {
                if (emergencyPollInterval) clearInterval(emergencyPollInterval);
                if (document.getElementById('callingView').classList.contains('hidden')) return;
                showToast('No staff currently available. Please try again or call emergency services.', 'warning');
                cancelCall();
            }, 120000);

        } else {
            if (callingSound) callingSound.pause();
            showToast('Could not connect. Please try again.', 'error');
            cancelCall();
        }
    } catch (err) {
        console.error('Emergency call error:', err);
        if (callingSound) callingSound.pause();
        showToast('Connection error. Please try again.', 'error');
        cancelCall();
    }
}

function cancelCall() {
    if (emergencyPollInterval) clearInterval(emergencyPollInterval);
    if (callingSound) callingSound.pause();
    isCallingEmergency = false; // Allow new emergency calls
    document.getElementById('callingView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
}

async function endCall() {
    isCallingEmergency = false; // Allow new emergency calls
    isInCall = false; // Allow incoming call notifications again

    // Mark the current call as completed in the backend
    const currentCallId = localStorage.getItem('currentCallId');
    if (currentCallId) {
        try {
            await fetch(`${VIDEO_SERVICE}/${currentCallId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'completed' })
            });
            console.log(`Call ${currentCallId} marked as completed`);
            localStorage.removeItem('currentCallId');
        } catch (err) {
            console.error('Error marking call as completed:', err);
        }
    }

    document.getElementById('inCallView').classList.add('hidden');
    document.getElementById('callFrame').src = '';
    document.getElementById('mainView').classList.remove('hidden');
    loadCalls();
}

function logout() {
    localStorage.clear();
    window.location.href = '/';
}
