// db.js (or database connection file)
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
    user: process.env.SUPABASE_USER,     // usually 'postgres'
    password: process.env.SUPABASE_PASS, // the password you set when creating the project
    host: process.env.SUPABASE_HOST,     // e.g., 'db.wxxyz.supabase.co'
    database: process.env.SUPABASE_DB,                // Supabase default DB name is 'postgres'
    port: 5432,                          // PostgreSQL standard port
    ssl: {
        rejectUnauthorized: false,         // Required for Supabase connections
    },
    connectionTimeoutMillis: 60000,
};

// Create the connection pool
const pool = new Pool(config);

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};