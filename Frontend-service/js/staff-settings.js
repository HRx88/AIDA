// Staff Settings JavaScript
const AUTH_SERVICE = 'http://localhost:5001/api/auth';

const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user'));

if (!token || !currentUser || (currentUser.role !== 'staff' && currentUser.role !== 'admin')) {
    window.location.href = '/';
}

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
    // Initialize UI
    document.getElementById('staffName').textContent = currentUser.fullName;
    updateAvatarUI(currentUser.profileImageUrl);

    // Fill form
    document.getElementById('fullName').value = currentUser.fullName;
    document.getElementById('username').value = currentUser.username;
    document.getElementById('email').value = currentUser.email || '';

    // Form handlers
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordChange);
    document.getElementById('avatarInput').addEventListener('change', handleAvatarUpload);
});

function updateAvatarUI(url) {
    const preview = document.getElementById('profilePreview');
    const placeholder = document.getElementById('profilePlaceholder');
    const sidebarAvatar = document.querySelector('.sidebar .bg-slate-200 i');
    const mobileAvatar = document.querySelector('.mobile-header .bg-slate-900 i');

    if (url) {
        // If it's a Supabase URL or absolute URL, use it directly
        const fullUrl = url.startsWith('http') ? url : `http://localhost:5001${url}`;

        preview.src = fullUrl;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');

        // Update sidebar if exists
        const sidebarAvatarContainer = document.querySelector('.sidebar .bg-slate-200');
        if (sidebarAvatarContainer) {
            sidebarAvatarContainer.innerHTML = `<img src="${fullUrl}" class="w-full h-full object-cover rounded-full">`;
        }

        // Update mobile header if exists
        const mobileAvatarContainer = document.querySelector('.mobile-header .bg-slate-900');
        if (mobileAvatarContainer) {
            mobileAvatarContainer.innerHTML = `<img src="${fullUrl}" class="w-full h-full object-cover rounded-lg">`;
        }
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation
    if (!file.type.match('image.*')) {
        showToast('Please select an image file.', 'error');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showToast('Image size must be less than 2MB.', 'error');
        return;
    }

    const status = document.getElementById('uploadStatus');
    status.textContent = 'Uploading...';
    status.className = 'mt-2 text-xs font-medium text-blue-500';
    status.classList.remove('hidden');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const response = await fetch(`${AUTH_SERVICE}/upload-avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            const newUrl = data.profileImageUrl;

            // Update local user data
            const updatedUser = { ...currentUser, profileImageUrl: newUrl };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Update UI
            updateAvatarUI(newUrl);
            status.textContent = 'Upload successful!';
            status.className = 'mt-2 text-xs font-medium text-emerald-500';
            showToast('Profile picture updated!', 'success');

            setTimeout(() => status.classList.add('hidden'), 3000);
        } else {
            const data = await response.json();
            showToast(data.message || 'Upload failed.', 'error');
            status.classList.add('hidden');
        }
    } catch (err) {
        console.error('Upload error:', err);
        showToast('Error uploading image.', 'error');
        status.classList.add('hidden');
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;

    try {
        const response = await fetch(`${AUTH_SERVICE}/update-profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ fullName, email })
        });

        if (response.ok) {
            const data = await response.json();
            // Update local user data
            const updatedUser = { ...currentUser, fullName, email };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Update UI
            document.getElementById('staffName').textContent = fullName;
            showToast('Profile updated successfully!', 'success');
        } else {
            showToast('Failed to update profile.', 'error');
        }
    } catch (err) {
        console.error('Error updating profile:', err);
        showToast('Error updating profile.', 'error');
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }

    try {
        const response = await fetch(`${AUTH_SERVICE}/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (response.ok) {
            e.target.reset();
            showToast('Password changed successfully!', 'success');
        } else {
            const data = await response.json();
            showToast(data.message || 'Failed to change password.', 'error');
        }
    } catch (err) {
        console.error('Error changing password:', err);
        showToast('Error changing password.', 'error');
    }
}

function logout() {
    localStorage.clear();
    window.location.href = '/';
}
