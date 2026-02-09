/**
 * Pet View JavaScript
 * Handles pet animations, mood polling, and dialogue systems.
 */

// PET_SERVICE_URL is typically handled via proxy or direct URL
// If running in docker/production, this might be relative
const PET_SERVICE_URL = '/pet';

const spriteElement = document.getElementById('pet-sprite');
const moodLabel = document.getElementById('mood-label');

let currentMood = 'happy';
let currentFrame = 1;
let totalFrames = 50;
let isInitialLoad = true;

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

// User Name & Profile Logic
document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (userData) {
        if (userData.fullName) {
            const nameEl = document.getElementById('userName');
            if (nameEl) nameEl.textContent = userData.fullName;
        }

        if (userData.profileImageUrl) {
            const avatarContainer = document.querySelector('.user-details')?.previousElementSibling;
            if (avatarContainer && avatarContainer.classList.contains('bg-slate-200')) {
                avatarContainer.innerHTML = `<img src="${userData.profileImageUrl}" class="w-full h-full object-cover rounded-full">`;
            }
        }
    }

    // Initial fetch
    updateMood();
    // Poll for mood changes every 5 seconds
    setInterval(updateMood, 5000);
    // Animate frames
    setInterval(animate, 100);
});

function showDialogue() {
    const bubble = document.getElementById('speech-bubble');
    const text = document.getElementById('dialogue-text');
    if (!bubble || !text) return;

    text.innerText = phrases[Math.floor(Math.random() * phrases.length)];
    bubble.classList.add('show');
    setTimeout(() => {
        bubble.classList.remove('show');
    }, 6000);
}

async function updateMood() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const userId = user ? user.id : null;

        if (!userId) {
            console.error("No userId found in localStorage");
            if (moodLabel) moodLabel.innerText = 'Mood: Please Login';
            return;
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`${PET_SERVICE_URL}/api/pet/mood?userId=${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();

        // Update label immediately
        if (moodLabel) moodLabel.innerText = `Mood: ${data.mood}`;
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
        if (moodLabel) moodLabel.innerText = 'Mood: Offline';
    }
}

function animate() {
    if (!spriteElement) return;

    // Capitalize first letter for internal folder structure
    const folder = currentMood.charAt(0).toUpperCase() + currentMood.slice(1);
    const fileName = `${folder} (${currentFrame}).png`;
    spriteElement.src = `${PET_SERVICE_URL}/${folder}/${fileName}`;

    currentFrame = (currentFrame % totalFrames) + 1;
}

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
