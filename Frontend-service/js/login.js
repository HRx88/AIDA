// Frontend-service/js/login.js
// Calls Auth-service microservice for authentication

const AUTH_SERVICE_URL = 'http://localhost:5001/api/auth';

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
                alert('Please enter both your name and password.');
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
                    alert(data.message || 'Login failed. Please check your details.');
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Something went wrong. Please try again later.');
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
                alert('Please fill in all fields.');
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
                    alert(data.message || 'Invalid credentials.');
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Staff Login error:', error);
                alert('Server error. Contact IT support.');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
});
