const db = require('../config/db');

// Find user by username
const findByUsername = async (username) => {
    const result = await db.query(
        'SELECT id, username, password_hash, role, full_name, email, profile_image_url, accessibility_settings FROM users WHERE username = $1',
        [username]
    );
    return result.rows[0] || null;
};

// Find user by ID
const findById = async (id) => {
    const result = await db.query(
        'SELECT id, username, role, full_name, email, profile_image_url, accessibility_settings FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
};

// Get all users (optionally filtered by role)
const findAll = async (role = null) => {
    let query = `
        SELECT u.id, u.username, u.full_name, u.email, u.role, u.profile_image_url,
               COALESCE(SUM(up.points), 0) as points
        FROM users u
        LEFT JOIN user_points up ON u.id = up.user_id
    `;
    let params = [];

    if (role) {
        query += ' WHERE u.role = $1';
        params.push(role);
    }

    query += ' GROUP BY u.id, u.username, u.full_name, u.email, u.role, u.profile_image_url';

    const result = await db.query(query, params);
    // Ensure points is returned as a number
    return result.rows.map(row => ({
        ...row,
        points: parseInt(row.points, 10)
    }));
};

// Create a new user
const create = async (userData) => {
    const { username, passwordHash, fullName, role, email, profileImageUrl, accessibilitySettings } = userData;
    const result = await db.query(
        `INSERT INTO users (username, password_hash, full_name, role, email, profile_image_url, accessibility_settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, username, full_name, email, role, profile_image_url`,
        [username, passwordHash, fullName, role, email || null, profileImageUrl || null, accessibilitySettings || '{}']
    );
    return result.rows[0];
};

// Update a user's password hash
const updatePassword = async (userId, newPasswordHash) => {
    const result = await db.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
        [newPasswordHash, userId]
    );
    return result.rows[0];
};

// Update user details (admin/staff use)
const update = async (userId, updateData) => {
    const { username, full_name, role, email, profile_image_url } = updateData;
    const result = await db.query(
        'UPDATE users SET username = $1, full_name = $2, role = $3, email = $4, profile_image_url = $5 WHERE id = $6 RETURNING id, username, full_name, email, role, profile_image_url',
        [username, full_name, role, email, profile_image_url, userId]
    );
    return result.rows[0];
};

module.exports = {
    findByUsername,
    findById,
    findAll,
    create,
    updatePassword,
    update
};
