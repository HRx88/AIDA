// Staff Calls Dashboard JavaScript
const VIDEO_SERVICE = '/calls/api/calls';
const AUTH_SERVICE = '/auth/api/auth';

const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user'));

if (!token || !currentUser || (currentUser.role !== 'staff' && currentUser.role !== 'admin')) {
    window.location.href = '/';
}
let currentIncomingCall = null;
let ringtone = null;
let editingCallId = null;
let activeCallId = null; // Track the call currently being attended

const MAX_EMERGENCY_ATTEMPTS = 3;

// Track emergency notification attempts (persists across page refresh)
function getAvatarUrl(path) {
    if (!path) return null;
    return path.startsWith('http') ? path : `/auth${path}`;
}

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
        const response = await fetch(`${VIDEO_SERVICE}/staff/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const allCalls = data.calls || [];

        // 1. Active Emergency Calls (urgent)
        const emergencies = allCalls.filter(c => c.status === 'urgent' && c.call_type === 'emergency');

        const now = new Date();
        const EXPIRY_HOURS = 2; // Calls move to history after 2 hours past scheduled time

        // 2. Scheduled Check-ins - show if within 2 hours after scheduled time (includes completed early)
        const scheduled = allCalls
            .filter(c => {
                if (c.call_type !== 'checkin') return false;
                // Cancelled calls always go to history
                if (c.status === 'cancelled') return false;
                const callTime = new Date(c.scheduled_time);
                const diffHours = (now - callTime) / 3600000;
                // Show scheduled, active, OR completed calls if still within 2 hours of scheduled time
                return diffHours < EXPIRY_HOURS;
            })
            .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

        // 3. History - cancelled, OR any call past 2 hours after scheduled time
        const checkinHistory = allCalls
            .filter(c => {
                if (c.call_type !== 'checkin' && c.call_type) return false; // Only checkins (or legacy null type)
                if (c.status === 'cancelled') return true; // Cancelled always goes to history
                const callTime = new Date(c.scheduled_time);
                const diffHours = (now - callTime) / 3600000;
                // If 2+ hours past scheduled time, move to history
                return diffHours >= EXPIRY_HOURS;
            })
            .sort((a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time));

        // Emergency history (completed/cancelled emergency calls)
        const emergencyHistory = allCalls
            .filter(c =>
                ['completed', 'cancelled'].includes(c.status) && c.call_type === 'emergency'
            )
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
        const response = await fetch(`${VIDEO_SERVICE}/staff/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
    currentIncomingCall = call;

    // Jump to Emergency tab
    switchTab('emergency');

    // Update modal content
    document.getElementById('callerName').textContent = call.client_name || 'Client';
    document.getElementById('callReason').textContent = `Reason: ${call.emergency_reason || 'Needs assistance'}`;

    // Set avatar image
    const avatarImg = document.getElementById('callerAvatar');
    if (avatarImg) {
        if (call.profile_image_url) {
            avatarImg.src = getAvatarUrl(call.profile_image_url);
            avatarImg.classList.remove('hidden');
        } else {
            avatarImg.classList.add('hidden');
        }
    }

    // Show modal
    const modal = document.getElementById('incomingCallModal');
    if (modal) modal.classList.remove('hidden');

    // Play ringtone
    if (ringtone) {
        ringtone.currentTime = 0;
        ringtone.play().catch(e => console.log('Audio autoplay blocked:', e));
    }

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 EMERGENCY - AIDA', {
            body: `${call.client_name || 'Client'} needs immediate assistance!\n${call.emergency_reason || 'Emergency call'}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/3616/3616215.png',
            tag: `emergency-${call.id}`,
            requireInteraction: true
        });
    }

    console.log(`🚨 Emergency notification shown for call #${call.id}`);
}

function answerIncomingCall() {
    if (ringtone) ringtone.pause();
    const modal = document.getElementById('incomingCallModal');
    if (modal) modal.classList.add('hidden');

    if (currentIncomingCall) {
        answerEmergencyCall(currentIncomingCall.id, currentIncomingCall.host_url);
    }
}

function declineIncomingCall() {
    if (ringtone) ringtone.pause();
    const modal = document.getElementById('incomingCallModal');
    if (modal) modal.classList.add('hidden');
    currentIncomingCall = null;
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
        <div class="card emergency-card border-l-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex-1">
                    <div class="flex items-center space-x-3 mb-2">
                        <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-rose-200 shadow-sm relative flex items-center justify-center bg-rose-100">
                            <i class="fa-solid fa-user text-rose-600"></i>
                            ${call.profile_image_url ?
            `<img src="${getAvatarUrl(call.profile_image_url)}" class="absolute inset-0 w-full h-full object-cover z-10" onerror="this.style.display='none'">` : ''
        }
                        </div>
                        <h3 class="text-xl font-black text-rose-600 uppercase tracking-tight">
                            Urgent: ${call.client_name || 'Client #' + call.client_id}
                        </h3>
                    </div>
                    <div class="bg-rose-50/50 p-4 rounded-xl mb-2">
                        <p class="text-slate-900 font-bold">${call.emergency_reason || 'Emergency assistance requested'}</p>
                    </div>
                    <p class="text-xs text-slate-500 font-medium">
                        <i class="fa-solid fa-clock mr-1 opacity-50"></i> Signal received: ${new Date(call.created_at).toLocaleTimeString('en-SG')}
                    </p>
                </div>
                <button onclick="answerEmergencyCall(${call.id}, '${call.host_url}')" 
                    class="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center space-x-3 shadow-lg shadow-rose-200 transition-all active:scale-95">
                    <i class="fa-solid fa-video"></i>
                    <span>Connect Now</span>
                </button>
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

    list.innerHTML = calls.map(call => {
        const now = new Date();
        const callTime = new Date(call.scheduled_time);
        const diffMinutes = (callTime - now) / 60000;

        let badgeClass = 'badge-primary';
        let badgeText = 'Upcoming';

        if (call.status === 'active') {
            badgeClass = 'badge-success animate-pulse';
            badgeText = 'Live Now';
        } else if (diffMinutes < 0) {
            badgeClass = 'badge-danger';
            badgeText = 'Overdue';
        } else if (diffMinutes <= 15) {
            badgeClass = 'badge-warning';
            badgeText = 'Due Now';
        }

        return `
        <div class="card flex flex-col justify-between hover:shadow-md h-full ${badgeText === 'Overdue' ? 'border-rose-100 bg-rose-50/10' : ''}">
            <div>
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-lg overflow-hidden border border-blue-100 shadow-sm relative flex items-center justify-center bg-blue-50">
                        <i class="fa-solid fa-user text-blue-600"></i>
                        ${call.profile_image_url ?
                `<img src="${getAvatarUrl(call.profile_image_url)}" class="absolute inset-0 w-full h-full object-cover z-10" onerror="this.style.display='none'">` : ''
            }
                    </div>
                    <span class="badge ${badgeClass}">
                        ${badgeText}
                    </span>
                </div>
                <h3 class="font-bold text-slate-900 text-lg mb-1">${call.client_name || 'Client #' + call.client_id}</h3>
                <p class="text-sm text-slate-500 flex items-center mb-4">
                    <i class="fa-solid fa-calendar-day mr-2 opacity-50"></i>
                    ${new Date(call.scheduled_time).toLocaleString('en-SG', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })}
                </p>
                <div class="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 mb-6 italic">
                    "${call.notes || 'No specific notes for this session'}"
                </div>
            </div>
            
            <div class="flex items-center gap-2 mt-auto">
                <button onclick="startCall(${call.id}, '${call.host_url}')" 
                    class="flex-1 bg-slate-900 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-slate-800 transition-all">
                    ${badgeText === 'Live Now' ? 'Join' : 'Start'} Call
                </button>
                <button onclick="openEditModal(${call.id}, ${call.client_id}, '${call.scheduled_time}', '${(call.notes || '').replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "")}')" 
                    class="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="deleteCall(${call.id})" 
                    class="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
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
        <div class="card p-4 hover:border-slate-300 transition-all">
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 relative flex items-center justify-center bg-slate-50">
                        <i class="fa-solid fa-user text-slate-400"></i>
                        ${call.profile_image_url ?
            `<img src="${getAvatarUrl(call.profile_image_url)}" class="absolute inset-0 w-full h-full object-cover z-10" onerror="this.style.display='none'">` : ''
        }
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-900">${call.client_name || 'Client #' + call.client_id}</h4>
                        <p class="text-sm text-slate-600 font-medium">${call.emergency_reason || 'Emergency assistance needed'}</p>
                        <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">
                            ${new Date(call.created_at).toLocaleString('en-SG')} • ID: #${call.id}
                        </p>
                    </div>
                </div>
                <div class="flex items-center">
                    <span class="badge ${call.status === 'completed' ? 'badge-success' : 'badge-danger'}">
                        ${call.status === 'cancelled' ? 'Missed' : call.status}
                    </span>
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
        <div class="card p-4 hover:bg-slate-50/50 transition-all">
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 relative flex items-center justify-center bg-slate-50">
                        <i class="fa-solid fa-user text-slate-400"></i>
                        ${call.profile_image_url ?
            `<img src="${getAvatarUrl(call.profile_image_url)}" class="absolute inset-0 w-full h-full object-cover z-10" onerror="this.style.display='none'">` : ''
        }
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-900">${call.client_name || 'Client #' + call.client_id}</h3>
                        <p class="text-xs text-slate-500 font-medium">Session: ${new Date(call.scheduled_time).toLocaleString('en-SG')}</p>
                        <p class="text-[10px] text-slate-400 mt-1 italic">"${call.notes || 'No notes'}"</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="badge ${call.status === 'completed' ? 'badge-success' : 'badge-warning'}">
                        ${call.status === 'cancelled' ? 'Missed' : call.status}
                    </span>
                    <p class="text-[10px] text-slate-400 mt-2 font-bold uppercase">ID: #${call.id}</p>
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'active' })
        });

        // Join the call
        activeCallId = callId;
        joinCall(hostUrl);
    } catch (err) {
        console.error('Error starting call:', err);
        // Still try to join even if status update fails
        activeCallId = callId;
        joinCall(hostUrl);
    }
}

async function answerEmergencyCall(callId, hostUrl) {
    if (ringtone) ringtone.pause();
    try {
        // Mark as active so the client knows help is on the way
        activeCallId = callId;
        await fetch(`${VIDEO_SERVICE}/${callId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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

    // Show outcome modal if we have an active call
    if (activeCallId) {
        document.getElementById('outcomeModal').classList.remove('hidden');
    } else {
        loadCalls();
    }
}

async function recordOutcome(status) {
    if (!activeCallId) return;

    try {
        const response = await fetch(`${VIDEO_SERVICE}/${activeCallId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                status: status,
                notes: status === 'cancelled' ? 'Session ended - marked as missed by staff.' : 'Session completed successfully.'
            })
        });

        if (response.ok) {
            showToast(`Session marked as ${status === 'cancelled' ? 'missed' : 'completed'}.`, 'success');
        }
    } catch (err) {
        console.error('Error recording outcome:', err);
    } finally {
        closeOutcomeModal();
    }
}

function closeOutcomeModal() {
    document.getElementById('outcomeModal').classList.add('hidden');
    activeCallId = null;
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
        const response = await fetch(`${AUTH_SERVICE}/users?role=client`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
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
        const response = await fetch(`${AUTH_SERVICE}/users?role=client`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
