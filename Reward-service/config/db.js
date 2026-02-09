// Reward-service/config/db.js
const { Pool } = require("pg");
const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Helper: fail fast if env is missing
function requireEnv(name) {
  const v = process.env[name];
  if (!v || String(v).trim() === "") {
    throw new Error(
      `[DB CONFIG] Missing environment variable: ${name}. ` +
      `Check your .env path and ensure ${name} is set.`
    );
  }
  return String(v).trim();
}

const pool = new Pool({
  host: requireEnv("SUPABASE_HOST"),
  database: requireEnv("SUPABASE_DB"),
  user: requireEnv("SUPABASE_USER"),
  password: requireEnv("SUPABASE_PASS"),
  port: Number(process.env.SUPABASE_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
