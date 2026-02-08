// Staff Client Management JavaScript
const AUTH_SERVICE = 'http://localhost:5001/api/auth';
const VIDEO_SERVICE = 'http://localhost:5002/api/calls';

const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user'));

if (!token || !currentUser || (currentUser.role !== 'staff' && currentUser.role !== 'admin')) {
    window.location.href = '/';
}

let allClients = [];

// Toast notification system
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
    document.getElementById('staffName').textContent = currentUser.fullName;

    loadClients();

    // Search handler
    document.getElementById('clientSearch').addEventListener('input', (e) => {
        filterClients(e.target.value);
    });

    // Edit form handler
    document.getElementById('editClientForm').addEventListener('submit', handleEditSubmit);

    // Create form handler
    document.getElementById('createClientForm').addEventListener('submit', handleCreateSubmit);

    // Avatar upload handler for editing client
    document.getElementById('editClientAvatar').addEventListener('change', handleClientAvatarUpload);
});

async function loadClients() {
    try {
        const response = await fetch(`${AUTH_SERVICE}/users?role=client`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch clients');

        allClients = await response.json();

        // Fetch SOS status/points if available from a summary endpoint or individual calls
        // For now, we'll just show the client list and attempt to get more data if needed
        updateStats();
        renderClients(allClients);
    } catch (err) {
        console.error('Error loading clients:', err);
        showToast('Could not load clients list', 'error');
        document.getElementById('clientTableBody').innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-red-500">
                    <i class="fa-solid fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Error loading clients. Please try again.</p>
                </td>
            </tr>
        `;
    }
}

function updateStats() {
    document.getElementById('totalClients').textContent = allClients.length;
    // Mocking active/pending for now as we don't have a direct SOS status endpoint per client yet
    // In a real app, we'd fetch active emergencies and cross-reference
    document.getElementById('activeClients').textContent = allClients.length;
    document.getElementById('pendingSos').textContent = '0';
}

function renderClients(clients) {
    const tableBody = document.getElementById('clientTableBody');

    if (clients.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-slate-400">
                    <p>No clients found matching your criteria.</p>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = clients.map(client => {
        const avatarContent = client.profile_image_url
            ? `<img src="${client.profile_image_url}" class="w-full h-full object-cover rounded-xl" alt="${client.full_name}">`
            : `<i class="fa-solid fa-user"></i>`;

        return `
        <tr class="hover:bg-slate-50 transition-colors group" data-client-id="${client.id}">
            <td class="px-6 py-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors overflow-hidden">
                        ${avatarContent}
                    </div>
                    <div>
                        <p class="font-bold text-slate-900">${client.full_name}</p>
                        <p class="text-xs text-slate-500">ID: ${client.id}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-sm font-medium text-slate-600">
                @${client.username}
            </td>
            <td class="px-6 py-4 text-sm text-slate-500">
                ${client.email || '<span class="italic opacity-50">Not set</span>'}
            </td>
            <td class="px-6 py-4">
                <span class="badge badge-success">Safe</span>
            </td>
            <td class="px-6 py-4 font-bold text-slate-700">
                ${client.points || 0}
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end space-x-3">
                    <button onclick="viewClientDetails('${client.id}')" class="text-blue-600 hover:text-blue-800 font-bold text-sm flex items-center">
                        <i class="fa-solid fa-eye mr-1.5"></i> View
                    </button>
                    <button onclick="openEditModal('${client.id}')" class="text-slate-600 hover:text-slate-900 font-bold text-sm flex items-center">
                        <i class="fa-solid fa-pen-to-square mr-1.5"></i> Edit
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

// Update only a single client row in the table (more efficient than re-rendering all)
function updateClientRow(clientId, newImageUrl) {
    const row = document.querySelector(`tr[data-client-id="${clientId}"]`);
    if (!row) return;

    const avatarContainer = row.querySelector('td:first-child .w-10.h-10');
    if (avatarContainer) {
        if (newImageUrl) {
            avatarContainer.innerHTML = `<img src="${newImageUrl}" class="w-full h-full object-cover rounded-xl" alt="Avatar">`;
        } else {
            avatarContainer.innerHTML = `<i class="fa-solid fa-user"></i>`;
        }
    }
}

function filterClients(query) {
    const filtered = allClients.filter(c =>
        c.full_name.toLowerCase().includes(query.toLowerCase()) ||
        c.username.toLowerCase().includes(query.toLowerCase()) ||
        c.id.toString().includes(query)
    );
    renderClients(filtered);
}

function viewClientDetails(clientId) {
    const client = allClients.find(c => String(c.id) === String(clientId));
    if (!client) return;

    document.getElementById('modalClientName').textContent = client.full_name;
    document.getElementById('modalClientUsername').textContent = `@${client.username}`;
    document.getElementById('modalClientId').textContent = client.id;
    document.getElementById('modalClientPoints').textContent = client.points || 0;

    // Set badge based on status (mocked for now)
    const badge = document.getElementById('modalClientBadge');
    badge.textContent = 'Safe';
    badge.className = 'badge badge-success';

    document.getElementById('clientModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('clientModal').classList.add('hidden');
}

function openEditModal(clientId) {
    const client = allClients.find(c => String(c.id) === String(clientId));
    if (!client) return;

    document.getElementById('editClientId').value = client.id;
    document.getElementById('editClientUsername').value = client.username;
    document.getElementById('editClientFullName').value = client.full_name;
    document.getElementById('editClientEmail').value = client.email || '';

    // Handle profile image preview
    const preview = document.getElementById('editClientPreview');
    const placeholder = document.getElementById('editClientPlaceholder');
    if (client.profile_image_url) {
        preview.src = client.profile_image_url;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    // Reset status
    const status = document.getElementById('editAvatarStatus');
    status.classList.add('hidden');

    document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function openCreateModal() {
    document.getElementById('createClientForm').reset();
    document.getElementById('createModal').classList.remove('hidden');
}

function closeCreateModal() {
    document.getElementById('createModal').classList.add('hidden');
}

async function handleCreateSubmit(e) {
    e.preventDefault();

    const username = document.getElementById('createClientUsername').value;
    const fullName = document.getElementById('createClientFullName').value;
    const email = document.getElementById('createClientEmail').value;
    const password = document.getElementById('createClientPassword').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Creating...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${AUTH_SERVICE}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, fullName, email, password, role: 'client' })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Client account created successfully', 'success');
            closeCreateModal();
            loadClients();
        } else {
            showToast(data.message || 'Failed to create client', 'error');
        }
    } catch (err) {
        console.error('Creation error:', err);
        showToast('System error. Please try again.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function handleEditSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('editClientId').value;
    const username = document.getElementById('editClientUsername').value;
    const full_name = document.getElementById('editClientFullName').value;
    const email = document.getElementById('editClientEmail').value;
    const password = document.getElementById('editClientPassword').value;

    // Find original client data to compare
    const originalClient = allClients.find(c => String(c.id) === String(id));

    // Check if any field has changed
    const hasUsernameChanged = username !== originalClient.username;
    const hasNameChanged = full_name !== originalClient.full_name;
    const hasEmailChanged = email !== (originalClient.email || '');
    const hasPasswordChanged = password && password.trim() !== '';

    if (!hasUsernameChanged && !hasNameChanged && !hasEmailChanged && !hasPasswordChanged) {
        showToast('No changes detected', 'info');
        closeEditModal();
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Saving...';
    submitBtn.disabled = true;

    const updateData = { username, full_name, email };
    if (hasPasswordChanged) {
        updateData.password = password;
    }

    try {
        const response = await fetch(`${AUTH_SERVICE}/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            showToast('Client details updated successfully', 'success');
            closeEditModal();
            loadClients(); // Refresh list
        } else {
            const text = await response.text();
            let errorMessage = 'Failed to update client';
            try {
                const data = JSON.parse(text);
                errorMessage = data.message || errorMessage;
            } catch (e) {
                console.error('Non-JSON error response:', text);
            }
            showToast(errorMessage, 'error');
        }
    } catch (err) {
        console.error('Update error:', err);
        showToast('System error. Please try again.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function scheduleCallForClient() {
    const clientId = document.getElementById('modalClientId').textContent;
    // Redirect to calls page with client selected
    window.location.href = `/staff-calls.html?scheduleFor=${clientId}`;
}

function logout() {
    localStorage.clear();
    window.location.href = '/';
}

async function handleClientAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const clientId = document.getElementById('editClientId').value;
    if (!clientId) {
        showToast('No client selected.', 'error');
        return;
    }

    // Client-side validation
    if (!file.type.match('image.*')) {
        showToast('Please select an image file.', 'error');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showToast('Image size must be less than 2MB.', 'error');
        return;
    }

    // Preview the image
    const reader = new FileReader();
    reader.onload = (event) => {
        document.getElementById('editClientPreview').src = event.target.result;
        document.getElementById('editClientPreview').classList.remove('hidden');
        document.getElementById('editClientPlaceholder').classList.add('hidden');
    };
    reader.readAsDataURL(file);

    const status = document.getElementById('editAvatarStatus');
    status.textContent = 'Uploading...';
    status.className = 'mt-2 text-xs font-medium text-blue-500';
    status.classList.remove('hidden');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const response = await fetch(`${AUTH_SERVICE}/users/${clientId}/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            showToast('Client profile picture updated!', 'success');
            status.textContent = 'Uploaded successfully!';
            status.className = 'mt-2 text-xs font-medium text-emerald-500';

            // Update client in local array
            const clientIndex = allClients.findIndex(c => String(c.id) === String(clientId));
            if (clientIndex !== -1) {
                allClients[clientIndex].profile_image_url = data.profileImageUrl;
            }

            // Re-render the clients table to show new image
            updateClientRow(clientId, data.profileImageUrl);

            setTimeout(() => status.classList.add('hidden'), 3000);
        } else {
            const errorData = await response.json();
            showToast(errorData.message || 'Upload failed.', 'error');
            status.classList.add('hidden');
        }
    } catch (err) {
        console.error('Client avatar upload error:', err);
        showToast('Error uploading image.', 'error');
        status.classList.add('hidden');
    }
}
