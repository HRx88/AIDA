/**
 * test_pet_mood.js
 * 
 * Usage: node test_pet_mood.js <userId> <mood>
 * Moods: playing, happy, bored, dirty
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
    user: process.env.SUPABASE_USER,
    password: process.env.SUPABASE_PASS,
    host: process.env.SUPABASE_HOST,
    database: process.env.SUPABASE_DB,
    port: 5432,
    ssl: {
        rejectUnauthorized: false,
    },
};

const pool = new Pool(config);

async function setMood(userId, mood) {
    let intervalString;

    switch (mood.toLowerCase()) {
        case 'playing':
            intervalString = '5 minutes';
            break;
        case 'happy':
            intervalString = '2 hours';
            break;
        case 'bored':
            intervalString = '25 hours';
            break;
        case 'dirty':
            intervalString = '73 hours';
            break;
        default:
            console.error('Invalid mood. Use: playing, happy, bored, dirty');
            process.exit(1);
    }

    try {
        console.log(`Setting pet mood to "${mood}" for User ${userId}...`);

        // 1. Get a valid task_id for this user to avoid FK issues
        const taskResult = await pool.query(
            'SELECT id FROM tasks WHERE user_id = $1 LIMIT 1',
            [userId]
        );

        let taskId;
        if (taskResult.rows.length > 0) {
            taskId = taskResult.rows[0].id;
        } else {
            // Create a dummy task if none exists
            console.log('No tasks found for user. Creating dummy task...');
            const dummyTask = await pool.query(
                `INSERT INTO tasks (user_id, title, day_of_week) VALUES ($1, 'Demo Task', 1) RETURNING id`,
                [userId]
            );
            taskId = dummyTask.rows[0].id;
        }

        // 2. Clear existing logs to ensure our new one is the "latest" (MAX(completed_at))
        console.log('Clearing existing task logs for user...');
        await pool.query('DELETE FROM task_logs WHERE user_id = $1', [userId]);

        // 3. Insert into task_logs with specific completed_at
        // We use NOW() - interval to satisfy petController logic
        const query = `
            INSERT INTO task_logs (task_id, user_id, scheduled_date, status, completed_at)
            VALUES ($1, $2, CURRENT_DATE, 'done', NOW() - $3::interval)
            RETURNING completed_at
        `;

        const result = await pool.query(query, [taskId, userId, intervalString]);

        console.log('Success!');
        console.log(`Log created with completed_at: ${result.rows[0].completed_at}`);
        console.log(`The pet should now be in "${mood}" mood.`);

    } catch (err) {
        console.error('Database Error:', err.message);
    } finally {
        await pool.end();
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node test_pet_mood.js <userId> <mood>');
    console.log('Example: node test_pet_mood.js 1 happy');
    process.exit(1);
}

setMood(args[0], args[1]);
