const db = require('../../DBconfig.js'); // Path to your root DB config

// Define the function as 'async' so you can use 'await' inside it
const getPetMood = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: "userId is required" });
        }

        // Calculate time differences directly in DB using absolute UTC time, filtered by userId
        const result = await db.query(
            `SELECT 
                EXTRACT(EPOCH FROM (NOW() - (MAX(completed_at) AT TIME ZONE 'UTC'))) / 60 as diff_minutes,
                EXTRACT(EPOCH FROM (NOW() - (MAX(completed_at) AT TIME ZONE 'UTC'))) / 3600 as diff_hours
             FROM task_logs WHERE status = 'done' AND user_id = $1`,
            [userId]
        );

        const { diff_minutes, diff_hours } = result.rows[0];
        let mood = 'happy'; // Default mood

        if (diff_minutes !== null) {
            // Mood logic based on user requirements:
            if (diff_minutes >= 0 && diff_minutes < 30) {
                mood = 'playing';
            }
            else if (diff_hours > 72) {
                mood = 'dirty';
            }
            else if (diff_hours > 24) {
                mood = 'bored';
            }
            else {
                mood = 'happy';
            }
        } else {
            mood = 'bored';
        }

        res.json({ mood });
    } catch (err) {
        console.error("Pet Controller Error:", err);
        res.status(500).json({ error: "Failed to fetch pet mood" });
    }
};

// Export the function so app.js can use it
module.exports = { getPetMood };