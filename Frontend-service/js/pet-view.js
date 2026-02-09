// Authentication Guard
(function () {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    if (!token || !user) {
        // window.location.href = '/'; // Commented out for dev/testing ease if needed, but should be active
    }

    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    'aida-primary': '#2563eb',
                    'aida-success': '#059669',
                    'aida-danger': '#e11d48',
                }
            }
        }
    }
})();

const PET_SERVICE_URL = 'http://localhost:5005';
const spriteElement = document.getElementById('pet-sprite');
const moodLabel = document.getElementById('mood-label');

let currentMood = 'happy';
let currentFrame = 1;
let totalFrames = 50;
let isInitialLoad = true;

// User Name Logic
const userData = JSON.parse(localStorage.getItem('user'));
if (userData && userData.fullName) {
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = userData.fullName;
}

// Display profile image in sidebar if available
if (userData && userData.profileImageUrl) {
    const avatarContainer = document.querySelector('.user-details')?.previousElementSibling;
    if (avatarContainer && avatarContainer.classList.contains('bg-slate-200')) {
        avatarContainer.innerHTML = `<img src="${userData.profileImageUrl}" class="w-full h-full object-cover rounded-full">`;
    }
}

const phrases = [
    "You're doing great!",
    "Keep up the good work!",
    "I'm so proud of you!",
    "One step at a time, you got this!",
    "You're a superstar!",
    "Look at you go!",
    "Amazing progress today!",
    "You're making it look easy!"
];

function showDialogue() {
    const bubble = document.getElementById('speech-bubble');
    const text = document.getElementById('dialogue-text');
    text.innerText = phrases[Math.floor(Math.random() * phrases.length)];
    bubble.classList.add('show');
    setTimeout(() => {
        bubble.classList.remove('show');
    }, 6000);
}

async function updateMood() {
    try {
        // Get userId from localStorage
        const user = JSON.parse(localStorage.getItem('user'));
        const userId = user ? user.id : null;

        if (!userId) {
            console.error("No userId found in localStorage");
            moodLabel.innerText = 'Mood: Please Login';
            return;
        }

        const response = await fetch(`${PET_SERVICE_URL}/api/pet/mood?userId=${userId}`);
        const data = await response.json();

        // Update label immediately
        moodLabel.innerText = `Mood: ${data.mood}`;
        updateBackground(data.mood);

        // Dialogue trigger when mood changes to 'playing' OR on initial load if playing
        if (data.mood === 'playing' && (currentMood !== 'playing' || isInitialLoad)) {
            showDialogue();
        }

        isInitialLoad = false;

        if (data.mood !== currentMood) {
            currentMood = data.mood;
            // Update frame limits based on folder content
            if (currentMood === 'playing') totalFrames = 27;
            else totalFrames = 50;
            currentFrame = 1; // Reset animation on mood change
        }
    } catch (err) {
        console.error("Failed to fetch mood:", err);
        moodLabel.innerText = 'Mood: Offline';
    }
}

function animate() {
    // Capitalize first letter for internal folder structure
    const folder = currentMood.charAt(0).toUpperCase() + currentMood.slice(1);
    const fileName = `${folder} (${currentFrame}).png`;
    spriteElement.src = `${PET_SERVICE_URL}/${folder}/${fileName}`;

    currentFrame = (currentFrame % totalFrames) + 1;
}

// Update background color based on mood
function updateBackground(mood) {
    const colors = {
        happy: '#fff9c4',
        bored: '#e0e0e0',
        dirty: '#d7ccc8',
        playing: '#b3e5fc'
    };
    document.body.style.backgroundColor = colors[mood] || colors.happy;
}

function logout() {
    localStorage.clear();
    window.location.href = '/';
}

// Initial fetch
updateMood();
// Poll for mood changes every 5 seconds for more responsiveness
setInterval(updateMood, 5000);
// Animate frames
setInterval(animate, 100);
