// Frontend-service/js/login.js
// Calls Auth-service microservice for authentication

const AUTH_SERVICE_URL = 'http://localhost:5001/api/auth';

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
document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // CLIENT Login Handling
    // -------------------------------------------------------------------------
    const clientForm = document.getElementById('clientForm');

    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('clientUsername');
            const passwordInput = document.getElementById('clientPassword');
            const submitBtn = clientForm.querySelector('button[type="submit"]');

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                showToast('Please enter both your name and password.', 'warning');
                return;
            }

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${AUTH_SERVICE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password,
                        role: 'client'
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                    submitBtn.classList.add('bg-green-500');
                    submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Success!';

                    setTimeout(() => {
                        window.location.href = '/client-dashboard.html';
                    }, 1000);
                } else {
                    showToast(data.message || 'Login failed. Please check your details.', 'error');
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Login error:', error);
                showToast('Something went wrong. Please try again later.', 'error');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    // -------------------------------------------------------------------------
    // STAFF Login Handling
    // -------------------------------------------------------------------------
    const staffForm = document.getElementById('staffForm');

    if (staffForm) {
        staffForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('staffUsername');
            const passwordInput = document.getElementById('staffPassword');
            const submitBtn = staffForm.querySelector('button[type="submit"]');

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                showToast('Please fill in all fields.', 'warning');
                return;
            }

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Signing in...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${AUTH_SERVICE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password,
                        role: 'staff'
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    window.location.href = '/staff-calls.html';
                } else {
                    showToast(data.message || 'Invalid credentials.', 'error');
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Staff Login error:', error);
                showToast('Server error. Contact IT support.', 'error');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
});
