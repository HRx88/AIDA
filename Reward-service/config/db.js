// Reward-service/config/db.js
const { Pool } = require("pg");

// Helper: fail fast if env is missing (prevents "it connects to localhost" confusion)
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
  // Supabase pooler commonly uses 6543. You can override with SUPABASE_PORT in .env.
  port: Number(process.env.SUPABASE_PORT || 6543),
  // Supabase requires SSL
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
