// Staff Calls Dashboard JavaScript
const VIDEO_SERVICE = 'http://localhost:5002/api/calls';
const AUTH_SERVICE = 'http://localhost:5001/api/auth';

let currentUser = JSON.parse(localStorage.getItem('user')) || { id: 1, fullName: 'Staff Member' };
let currentIncomingCall = null;
let ringtone = null;
let editingCallId = null;

const MAX_EMERGENCY_ATTEMPTS = 3;

// Track emergency notification attempts (persists across page refresh)
function getEmergencyAttempts() {
    const stored = localStorage.getItem('emergencyAttempts');
    return stored ? JSON.parse(stored) : {};
}

function saveEmergencyAttempts(attempts) {
    localStorage.setItem('emergencyAttempts', JSON.stringify(attempts));
}

// Toast notification system (replaces alerts)
function showToast(message, type = 'info') {
    const existing = document.getElementById('toastNotification');
    if (existing) existing.remove();

    const colors = { success: 'bg-emerald-500', error: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-blue-500' };
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

    const toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.className = `fixed top-6 right-6 z-[9999] ${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 max-w-md`;
    toast.style.animation = 'slideIn 0.3s ease-out';
    toast.innerHTML = `<i class="fa-solid ${icons[type]} text-xl"></i><span class="font-medium">${message}</span><button onclick="this.parentElement.remove()" class="ml-4 hover:opacity-70"><i class="fa-solid fa-times"></i></button>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}


// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    ringtone = document.getElementById('ringtone');

    document.getElementById('staffName').textContent = currentUser.fullName;

    switchTab('scheduled'); // default tab
    loadCalls();
    setInterval(checkForNewEmergencies, 5000);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Form submit handlers
    document.getElementById('newCallForm').addEventListener('submit', handleNewCallSubmit);

    const editForm = document.getElementById('editCallForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditCallSubmit);
    }
});

function switchTab(tab) {
    const panels = {
        emergency: document.getElementById('panelEmergency'),
        scheduled: document.getElementById('panelScheduled'),
        emergencyHistory: document.getElementById('panelEmergencyHistory'),
        history: document.getElementById('panelHistory')
    };

    const tabs = {
        emergency: document.getElementById('tabEmergency'),
        scheduled: document.getElementById('tabScheduled'),
        emergencyHistory: document.getElementById('tabEmergencyHistory'),
        history: document.getElementById('tabHistory')
    };

    Object.values(panels).forEach(p => { if (p) p.classList.add('hidden'); });
    Object.values(tabs).forEach(t => { if (t) t.classList.remove('active'); });

    panels[tab].classList.remove('hidden');
    tabs[tab].classList.add('active');
}

async function loadCalls() {
    try {
        const response = await fetch(`${VIDEO_SERVICE}/staff/${currentUser.id}`);
        const data = await response.json();
        const allCalls = data.calls || [];

        // 1. Active Emergency Calls (urgent)
        const emergencies = allCalls.filter(c => c.status === 'urgent' && c.call_type === 'emergency');

        const now = new Date();
        const EXPIRY_HOURS = 2; // Calls move to history after 2 hours past scheduled time

        // 2. Scheduled Check-ins - show if within 2 hours after scheduled time (includes completed early)
        const scheduled = allCalls.filter(c => {
            if (c.call_type !== 'checkin') return false;
            // Cancelled calls always go to history
            if (c.status === 'cancelled') return false;
            const callTime = new Date(c.scheduled_time);
            const diffHours = (now - callTime) / 3600000;
            // Show scheduled, active, OR completed calls if still within 2 hours of scheduled time
            return diffHours < EXPIRY_HOURS;
        });

        // 3. History - cancelled, OR any call past 2 hours after scheduled time
        const checkinHistory = allCalls.filter(c => {
            if (c.call_type !== 'checkin' && c.call_type) return false; // Only checkins (or legacy null type)
            if (c.status === 'cancelled') return true; // Cancelled always goes to history
            const callTime = new Date(c.scheduled_time);
            const diffHours = (now - callTime) / 3600000;
            // If 2+ hours past scheduled time, move to history
            return diffHours >= EXPIRY_HOURS;
        });

        // Emergency history (completed/cancelled emergency calls)
        const emergencyHistory = allCalls.filter(c =>
            ['completed', 'cancelled'].includes(c.status) && c.call_type === 'emergency'
        );

        renderEmergencies(emergencies);
        renderScheduled(scheduled);
        renderEmergencyHistory(emergencyHistory);
        renderHistory(checkinHistory);

        return emergencies;
    } catch (err) {
        console.error('Failed to load calls:', err);
        renderEmergencies([]);
        renderScheduled([]);
        renderEmergencyHistory([]);
        renderHistory([]);
        return [];
    }
}

async function checkForNewEmergencies() {
    try {
        const response = await fetch(`${VIDEO_SERVICE}/staff/${currentUser.id}`);
        const data = await response.json();
        const emergencies = (data.calls || []).filter(c => c.status === 'urgent' && c.call_type === 'emergency');

        // Get attempt counts from localStorage
        const attempts = getEmergencyAttempts();

        // Process each emergency call
        for (const call of emergencies) {
            const callId = call.id.toString();

            // Initialize attempt counter if not exists
            if (!attempts[callId]) {
                attempts[callId] = 0;
            }

            // Check if under max attempts
            if (attempts[callId] < MAX_EMERGENCY_ATTEMPTS) {
                attempts[callId]++;
                saveEmergencyAttempts(attempts);
                console.log(`Emergency call #${callId} - attempt ${attempts[callId]}/${MAX_EMERGENCY_ATTEMPTS}`);

                // Show/Refresh notification on every attempt to ensure staff sees it
                // Only trigger if modal is hidden or if it's the first attempt
                const modal = document.getElementById('incomingCallModal');
                if (attempts[callId] === 1 || (modal && modal.classList.contains('hidden'))) {
                    showIncomingCallNotification(call);
                }
            } else if (attempts[callId] === MAX_EMERGENCY_ATTEMPTS) {
                // Max attempts reached (3 attempts completed) - mark as cancelled and move to history
                console.log(`Emergency call #${callId} - max attempts reached, marking as cancelled`);
                attempts[callId]++; // Increment to 4 to prevent re-entry
                saveEmergencyAttempts(attempts);

                // Remove from local list so it disappears from active UI immediately
                const idx = emergencies.findIndex(e => e.id.toString() === callId);
                if (idx > -1) emergencies.splice(idx, 1);

                await markEmergencyAsMissed(callId);
            }
        }

        // Clean up: remove attempt entries for calls that are no longer in emergency list
        const currentIds = new Set(emergencies.map(c => c.id.toString()));
        let changed = false;
        for (const id of Object.keys(attempts)) {
            if (!currentIds.has(id)) {
                delete attempts[id];
                changed = true;
            }
        }
        if (changed) {
            saveEmergencyAttempts(attempts);
        }

        renderEmergencies(emergencies);
    } catch (err) {
        console.error('Error checking emergencies:', err);
    }
}

// Mark emergency call as missed/cancelled after max attempts
async function markEmergencyAsMissed(callId) {
    try {
        await fetch(`${VIDEO_SERVICE}/${callId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled', notes: 'Emergency call not answered after 3 attempts' })
        });

        // Hide notification modal if showing
        if (ringtone) ringtone.pause();
        const modal = document.getElementById('incomingCallModal');
        if (modal) modal.classList.add('hidden');
        currentIncomingCall = null;

        console.log(`Emergency call #${callId} marked as cancelled`);
        loadCalls(); // Refresh to show in history
    } catch (err) {
        console.error('Error marking emergency as missed:', err);
    }
}

function showIncomingCallNotification(call) {
    // Jump to Emergency tab to show the new alert
    switchTab('emergency');

    // Browser notification only (no modal/ringtone)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 EMERGENCY - AIDA', {
            body: `${call.client_name || 'Client'} needs immediate assistance!\n${call.emergency_reason || 'Emergency call'}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3616/3616215.png',
            tag: `emergency-${call.id}`, // Prevents duplicate notifications
            requireInteraction: true // Notification stays until dismissed
        });
    }

    console.log(`🚨 Emergency notification shown for call #${call.id}`);
}

// Legacy functions - modal removed, emergencies are answered directly from dashboard cards
function answerIncomingCall() {
    // No longer used - staff clicks "JOIN EMERGENCY CALL" button directly
    console.log('answerIncomingCall() called but modal is removed');
}

function declineIncomingCall() {
    // No longer used
    console.log('declineIncomingCall() called but modal is removed');
}

function renderEmergencies(calls) {
    const list = document.getElementById('emergencyList');
    const badge = document.getElementById('emergencyBadge');
    const noMsg = document.getElementById('noEmergencyMsg');

    if (calls.length > 0) {
        badge.textContent = calls.length;
        badge.classList.remove('hidden');
        noMsg.classList.add('hidden');
    } else {
        badge.classList.add('hidden');
        noMsg.classList.remove('hidden');
    }

    if (calls.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = calls.map(call => `
        <div class="emergency-card bg-white rounded-xl p-6 shadow-xl border border-red-100">
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <div class="flex items-center space-x-3 mb-2">
                        <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 animate-pulse">
                            <i class="fa-solid fa-phone-volume text-lg"></i>
                        </div>
                        <h3 class="text-2xl font-black text-red-600 tracking-tight uppercase">
                            URGENT: ${call.client_name || 'Client #' + call.client_id}
                        </h3>
                    </div>
                    <div class="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg mb-3">
                        <p class="text-red-800 font-bold text-lg">${call.emergency_reason || 'Emergency assistance requested'}</p>
                    </div>
                    <p class="text-sm text-gray-500 font-medium italic">
                        <i class="fa-solid fa-clock mr-1"></i> Triggered at: ${new Date(call.created_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}
                    </p>
                </div>
                <div class="ml-6">
                    <button onclick="answerEmergencyCall(${call.id}, '${call.host_url}')" 
                        class="bg-red-600 hover:bg-black text-white px-8 py-5 rounded-2xl font-black text-xl shadow-2xl flex items-center space-x-3 active:scale-95 transition-all">
                        <i class="fa-solid fa-video text-2xl"></i>
                        <span>JOIN EMERGENCY CALL</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderScheduled(calls) {
    const list = document.getElementById('scheduledList');

    if (calls.length === 0) {
        list.innerHTML = '<p class="text-gray-500">No scheduled calls.</p>';
        return;
    }

    list.innerHTML = calls.map(call => `
        <div class="bg-white rounded-xl p-6 shadow-lg border border-gray-50 hover:shadow-xl transition-shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-bold text-gray-800 flex items-center">
                        <i class="fa-solid fa-user text-blue-500 mr-2"></i> ${call.client_name || 'Client #' + call.client_id}
                        ${call.status === 'active' ? '<span class="ml-3 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 animate-pulse">ACTIVE NOW</span>' : ''}
                    </h3>
                    <p class="text-sm text-gray-500 mt-1">
                        <i class="fa-solid fa-clock mr-1"></i> ${new Date(call.scheduled_time).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}
                    </p>
                    <p class="text-gray-600 mt-3 text-sm border-l-2 border-blue-200 pl-3 py-1">
                        ${call.notes || '<span class="text-gray-400 italic">No notes recorded</span>'}
                    </p>
                    <div class="mt-2 text-xs text-gray-400">
                        ID: #${call.id} • Created: ${new Date(call.created_at).toLocaleDateString()}
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="openEditModal(${call.id}, ${call.client_id}, '${call.scheduled_time}', '${(call.notes || '').replace(/'/g, "\\'")}')" 
                        class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg transition-colors" title="Edit">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button onclick="deleteCall(${call.id})" 
                        class="bg-red-50 hover:bg-red-100 text-red-500 px-3 py-2 rounded-lg transition-colors" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <button onclick="startCall(${call.id}, '${call.host_url}')" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg flex items-center font-semibold shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-video mr-2"></i> ${call.status === 'active' ? 'Re-join Call' : 'Start Call'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Render emergency call history
function renderEmergencyHistory(calls) {
    const list = document.getElementById('emergencyHistoryList');

    if (!list) return;

    if (calls.length === 0) {
        list.innerHTML = '<p class="text-gray-500">No emergency call history yet.</p>';
        return;
    }

    list.innerHTML = calls.map(call => `
        <div class="bg-white rounded-xl p-5 border-l-8 border-orange-400 shadow-sm hover:shadow-md transition-shadow mb-4">
            <div class="flex justify-between items-start">
                <div>
                    <div class="flex items-center space-x-2 mb-1">
                        <i class="fa-solid fa-ambulance text-orange-500"></i>
                        <h4 class="font-bold text-gray-800 text-lg">${call.client_name || 'Client #' + call.client_id}</h4>
                        <span class="ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${call.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} uppercase">
                            ${call.status === 'cancelled' ? 'MISSED' : call.status}
                        </span>
                    </div>
                    <p class="text-gray-700 font-medium mb-2">${call.emergency_reason || 'Emergency assistance needed'}</p>
                    <div class="flex items-center space-x-4 text-xs text-gray-500">
                        <span><i class="fa-solid fa-clock mr-1"></i> ${new Date(call.created_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</span>
                        <span><i class="fa-solid fa-id-badge mr-1"></i> ID: #${call.id}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderHistory(calls) {
    const list = document.getElementById('historyList');

    if (calls.length === 0) {
        list.innerHTML = '<p class="text-gray-500">No check-in history yet.</p>';
        return;
    }

    list.innerHTML = calls.map(call => `
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-bold text-gray-800 flex items-center">
                        <i class="fa-solid fa-user text-blue-500 mr-2"></i> ${call.client_name || 'Client #' + call.client_id}
                        <span class="ml-3 px-2 py-0.5 text-xs rounded-full ${call.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                            ${call.status === 'cancelled' ? 'MISSED' : call.status.toUpperCase()}
                        </span>
                    </h3>
                    <p class="text-sm text-gray-500 mt-1">
                        <i class="fa-solid fa-clock mr-1"></i> Scheduled: ${new Date(call.scheduled_time).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}
                    </p>
                    <p class="text-gray-600 mt-3 text-sm border-l-2 border-gray-200 pl-3 py-1">
                        ${call.notes || '<span class="text-gray-400 italic">No notes recorded</span>'}
                    </p>
                </div>
                <div class="text-xs text-gray-400 text-right">
                    <p>ID: #${call.id}</p>
                    <p>Created: ${new Date(call.created_at).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' })}</p>
                </div>
            </div>
        </div>
    `).join('');
}

// Start a scheduled call - updates status to 'active' so client gets notified
async function startCall(callId, hostUrl) {
    try {
        // Update call status to 'active' - this triggers client notification
        await fetch(`${VIDEO_SERVICE}/${callId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' })
        });

        // Join the call
        joinCall(hostUrl);
    } catch (err) {
        console.error('Error starting call:', err);
        // Still try to join even if status update fails
        joinCall(hostUrl);
    }
}

async function answerEmergencyCall(callId, hostUrl) {
    if (ringtone) ringtone.pause();
    try {
        // Mark as active so the client knows help is on the way
        await fetch(`${VIDEO_SERVICE}/${callId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active', staffId: currentUser.id })
        });
        joinCall(hostUrl);
    } catch (err) {
        console.error('Error answering emergency:', err);
        joinCall(hostUrl); // Still join even if status update fails
    }
}

function joinCall(url) {
    if (ringtone) ringtone.pause();
    document.getElementById('wherebyFrame').src = url;
    document.getElementById('callModal').classList.remove('hidden');
}

function closeCallModal() {
    document.getElementById('callModal').classList.add('hidden');
    document.getElementById('wherebyFrame').src = '';
    loadCalls();
}

function openNewCallModal() {
    document.getElementById('newCallModal').classList.remove('hidden');
    loadClients();
}

function closeModal() {
    document.getElementById('newCallModal').classList.add('hidden');
}

async function loadClients() {
    try {
        const response = await fetch(`${AUTH_SERVICE}/users?role=client`);
        const clients = await response.json();
        const select = document.getElementById('selectClient');

        select.innerHTML = '<option value="">-- Choose Client --</option>' +
            clients.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
    } catch (err) {
        console.error('Failed to load clients', err);
    }
}

async function handleNewCallSubmit(e) {
    e.preventDefault();

    const data = {
        staffId: currentUser.id,
        clientId: document.getElementById('selectClient').value,
        scheduledTime: document.getElementById('scheduleTime').value,
        notes: document.getElementById('callNotes').value
    };

    try {
        const response = await fetch(`${VIDEO_SERVICE}/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeModal();
            loadCalls();
            showToast('Check-in call scheduled!', 'success');
            switchTab('scheduled');
        } else {
            showToast('Failed to schedule call.', 'error');
        }
    } catch (err) {
        console.error('Error scheduling call:', err);
    }
}

// Delete a scheduled call
async function deleteCall(callId) {
    if (!confirm('Are you sure you want to delete this scheduled call?')) {
        return;
    }

    try {
        const response = await fetch(`${VIDEO_SERVICE}/${callId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadCalls();
            showToast('Call deleted successfully.', 'success');
        } else {
            showToast('Failed to delete call.', 'error');
        }
    } catch (err) {
        console.error('Error deleting call:', err);
        showToast('Error deleting call.', 'error');
    }
}

// Stores initial values for change detection
let initialEditData = null;

// Open edit modal with call data
function openEditModal(callId, clientId, scheduledTime, notes) {
    editingCallId = callId;

    // Show modal and load clients
    document.getElementById('editCallModal').classList.remove('hidden');
    loadEditClients(clientId);

    // Format datetime for input (Local time instead of UTC)
    const dt = new Date(scheduledTime);
    const tzOffset = dt.getTimezoneOffset() * 60000;
    const formatted = new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16);
    document.getElementById('editScheduleTime').value = formatted;
    document.getElementById('editCallNotes').value = notes || '';

    // Store initial data for comparison
    initialEditData = {
        clientId: clientId.toString(),
        scheduledTime: formatted,
        notes: notes || ''
    };
}

function closeEditModal() {
    document.getElementById('editCallModal').classList.add('hidden');
    editingCallId = null;
    initialEditData = null;
}

async function loadEditClients(selectedClientId) {
    try {
        const response = await fetch(`${AUTH_SERVICE}/users?role=client`);
        const clients = await response.json();
        const select = document.getElementById('editSelectClient');
        select.innerHTML = '<option value="">-- Choose Client --</option>' +
            clients.map(c => `<option value="${c.id}" ${c.id == selectedClientId ? 'selected' : ''}>${c.full_name}</option>`).join('');
    } catch (err) {
        console.error('Failed to load clients');
    }
}

async function handleEditCallSubmit(e) {
    e.preventDefault();

    if (!editingCallId) return;

    const data = {
        clientId: document.getElementById('editSelectClient').value,
        scheduledTime: document.getElementById('editScheduleTime').value,
        notes: document.getElementById('editCallNotes').value
    };

    // Check if anything actually changed
    const hasChanged =
        data.clientId !== initialEditData.clientId ||
        data.scheduledTime !== initialEditData.scheduledTime ||
        data.notes !== initialEditData.notes;

    if (!hasChanged) {
        console.log('No changes detected. Closing modal.');
        closeEditModal();
        return;
    }

    try {
        const response = await fetch(`${VIDEO_SERVICE}/${editingCallId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeEditModal();
            loadCalls();
            showToast('Call updated successfully!', 'success');
        } else {
            showToast('Failed to update call.', 'error');
        }
    } catch (err) {
        console.error('Error updating call:', err);
        showToast('Error updating call.', 'error');
    }
}

function logout() {
    localStorage.clear();
    window.location.href = '/';
}
