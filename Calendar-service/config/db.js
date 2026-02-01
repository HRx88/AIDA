const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
    user: process.env.SUPABASE_USER,
    password: process.env.SUPABASE_PASS,
    host: process.env.SUPABASE_HOST,
    database: process.env.SUPABASE_DB,
    port: 5432,
    ssl: {
        rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 60000,
};

const pool = new Pool(config);

// Log pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = {
    query: async (text, params) => {
        try {
            return await pool.query(text, params);
        } catch (err) {
            console.error('Database Query Error:', {
                message: err.message,
                text: text.substring(0, 100) + '...' // Log start of query for context
            });
            throw err;
        }
    },
    pool: pool
};
