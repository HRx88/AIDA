// db.js - Database configuration for Auth-service
const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

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

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};
