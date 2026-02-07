const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this';

/**
 * Login user (Staff or Client)
 */
const login = async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        console.log(`[AUTH] Login attempt for user: ${username}`);
        const user = await User.findByUsername(username);
        console.log(`[AUTH] User find result: ${user ? 'found' : 'not found'}`);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify role if specified
        if (role && user.role !== role && user.role !== 'admin') {
            return res.status(403).json({ message: `Access denied. Not a ${role} account.` });
        }

        // Verify password
        let match = false;
        let requiresMigration = false;

        // 1. Try bcrypt comparison first (standard)
        try {
            match = await bcrypt.compare(password, user.password_hash);
        } catch (e) {
            match = false;
        }

        // 2. If bcrypt fails, check if it's a plain text match (legacy migration)
        if (!match && password === user.password_hash) {
            match = true;
            requiresMigration = true;
        }

        if (!match) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 3. Handle Migration: If it was a plain text match, hash it and update the DB
        if (requiresMigration) {
            console.log(`[AUTH] Migrating user ${username} to bcrypt hash...`);
            const saltRounds = 10;
            const newHash = await bcrypt.hash(password, saltRounds);
            await User.updatePassword(user.id, newHash);
            console.log(`[AUTH] Migration complete for user ${username}.`);
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role,
                accessibility: user.accessibility_settings
            }
        });

    } catch (err) {
        console.error('[AUTH ERROR] Login failed:', err);
        res.status(500).json({ message: 'Internal server error', details: err.message });
    }
};

/**
 * Get all users (filtered by role)
 */
const getUsers = async (req, res) => {
    const { role } = req.query;

    try {
        const users = await User.findAll(role);
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

module.exports = {
    login,
    getUsers,
    getUserById
};
