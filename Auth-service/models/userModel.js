const db = require('../config/db');

// Find user by username
const findByUsername = async (username) => {
    const result = await db.query(
        'SELECT id, username, password_hash, role, full_name, accessibility_settings FROM users WHERE username = $1',
        [username]
    );
    return result.rows[0] || null;
};

// Find user by ID
const findById = async (id) => {
    const result = await db.query(
        'SELECT id, username, role, full_name, accessibility_settings FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
};

// Get all users (optionally filtered by role)
const findAll = async (role = null) => {
    let query = 'SELECT id, username, full_name, role FROM users';
    let params = [];

    if (role) {
        query += ' WHERE role = $1';
        params.push(role);
    }

    const result = await db.query(query, params);
    return result.rows;
};

// Create a new user
const create = async (userData) => {
    const { username, passwordHash, fullName, role, accessibilitySettings } = userData;
    const result = await db.query(
        `INSERT INTO users (username, password_hash, full_name, role, accessibility_settings)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, full_name, role`,
        [username, passwordHash, fullName, role, accessibilitySettings || '{}']
    );
    return result.rows[0];
};

module.exports = {
    findByUsername,
    findById,
    findAll,
    create
};
