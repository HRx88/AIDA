const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Initialize S3 Client for Supabase Storage
const s3Endpoint = process.env.SUPABASE_PROJECT_REF;
const s3Client = new S3Client({
    forcePathStyle: true,
    region: process.env.SUPABASE_REGION || 'ap-southeast-1',
    endpoint: s3Endpoint,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    }
});

// Use memory storage for Buffer upload to Supabase
const storage = multer.memoryStorage();

// Configure Multer for profile image uploads
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images (jpeg, jpg, png, webp) are allowed!'));
    }
}).single('avatar');

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
                email: user.email,
                profileImageUrl: user.profile_image_url,
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

/**
 * Update user details (Staff/Admin only)
 */
const updateUser = async (req, res) => {
    console.log(`[AUTH] updateUser hit for ID: ${req.params.id}`);
    const { id } = req.params;
    const { username, full_name, email, role, password } = req.body;

    try {
        const existingUser = await User.findById(id);
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If password is provided, hash it and update separately
        if (password && password.trim() !== '') {
            const saltRounds = 10;
            const newPasswordHash = await bcrypt.hash(password, saltRounds);
            await User.updatePassword(id, newPasswordHash);
        }

        const finalUsername = username || existingUser.username;
        const finalFullName = full_name || existingUser.full_name;
        const finalEmail = email || existingUser.email;
        const finalRole = role || existingUser.role;

        // Check if anything actually changed (excluding password which is handled above)
        if (finalUsername === existingUser.username &&
            finalFullName === existingUser.full_name &&
            finalEmail === existingUser.email &&
            finalRole === existingUser.role &&
            (!password || password.trim() === '')) {
            return res.json({ message: 'No changes made', user: existingUser });
        }

        const updatedUser = await User.update(id, {
            username: finalUsername,
            full_name: finalFullName,
            email: finalEmail,
            role: finalRole,
            profile_image_url: existingUser.profile_image_url
        });

        res.json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ message: 'Internal server error', details: err.message });
    }
};

/**
 * Register a new user (Staff/Admin only)
 */
const register = async (req, res) => {
    const { username, password, fullName, role } = req.body;

    if (!username || !password || !fullName) {
        return res.status(400).json({ message: 'Username, password, and full name are required' });
    }

    try {
        const existing = await User.findByUsername(username);
        if (existing) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const newUser = await User.create({
            username,
            passwordHash,
            fullName,
            email: req.body.email || null,
            role: role || 'client',
            accessibilitySettings: '{}'
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: newUser
        });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Internal server error', details: err.message });
    }
};

/**
 * Change current user's password
 */
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        // We need the password hash, but findById doesn't return it
        const user = await User.findByUsername(req.user.username);

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) {
            return res.status(401).json({ message: 'Current password incorrect' });
        }

        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);
        await User.updatePassword(userId, newHash);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Update current user's profile
 */
const updateProfile = async (req, res) => {
    const { fullName, email } = req.body;
    const userId = req.user.id;

    try {
        const existingUser = await User.findById(userId);

        const finalFullName = fullName || existingUser.full_name;
        const finalEmail = email || existingUser.email;

        if (finalFullName === existingUser.full_name && finalEmail === existingUser.email) {
            return res.json({ message: 'No changes made', user: existingUser });
        }

        const updatedUser = await User.update(userId, {
            username: existingUser.username,
            full_name: finalFullName,
            email: finalEmail,
            role: existingUser.role,
            profile_image_url: existingUser.profile_image_url
        });

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Upload profile image
 */
const uploadAvatar = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        try {
            const userId = req.user.id;
            const existingUser = await User.findById(userId);

            // Delete old avatar from S3 if exists
            if (existingUser.profile_image_url && existingUser.profile_image_url.includes('/avatars/')) {
                try {
                    const oldKey = existingUser.profile_image_url.split('/avatars/').pop();
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: 'avatars',
                        Key: oldKey
                    }));
                    console.log('[AUTH] Deleted old avatar:', oldKey);
                } catch (deleteErr) {
                    console.warn('[AUTH] Could not delete old avatar:', deleteErr.message);
                }
            }

            // Upload to Supabase via S3 API
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileName = `avatar-${userId}-${uniqueSuffix}${path.extname(req.file.originalname)}`;

            const uploadParams = {
                Bucket: 'avatars',
                Key: fileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype
            };

            await s3Client.send(new PutObjectCommand(uploadParams));

            // Extract project ID from the S3 endpoint to build the public URL
            // e.g., "https://abcdefghij.storage.supabase.co/storage/v1/s3" -> "abcdefghij"
            let projectId = process.env.SUPABASE_PROJECT_REF;
            try {
                const urlObj = new URL(projectId);
                projectId = urlObj.hostname.split('.')[0];
            } catch (e) {
                // Fallback in case it's just the ID
            }

            // Construct Public URL (Standard Supabase public URL format)
            const publicUrl = `https://${projectId}.supabase.co/storage/v1/object/public/avatars/${fileName}`;

            // Update user in DB
            const updatedUser = await User.update(userId, {
                username: existingUser.username,
                full_name: existingUser.full_name,
                email: existingUser.email,
                role: existingUser.role,
                profile_image_url: publicUrl
            });

            res.json({
                message: 'Avatar uploaded to Supabase via S3 successfully',
                profileImageUrl: publicUrl,
                user: updatedUser
            });
        } catch (error) {
            console.error('[AUTH] Profile upload error details:', error);
            res.status(500).json({
                message: 'Error uploading to cloud storage',
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
};

/**
 * Upload profile image for a specific user (staff use)
 */
const uploadUserAvatar = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        try {
            const userId = req.params.id;
            const existingUser = await User.findById(userId);

            if (!existingUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Delete old avatar from S3 if exists
            if (existingUser.profile_image_url && existingUser.profile_image_url.includes('/avatars/')) {
                try {
                    const oldKey = existingUser.profile_image_url.split('/avatars/').pop();
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: 'avatars',
                        Key: oldKey
                    }));
                    console.log('[AUTH] Deleted old user avatar:', oldKey);
                } catch (deleteErr) {
                    console.warn('[AUTH] Could not delete old user avatar:', deleteErr.message);
                }
            }

            // Upload to Supabase via S3 API
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileName = `avatar-${userId}-${uniqueSuffix}${path.extname(req.file.originalname)}`;

            const uploadParams = {
                Bucket: 'avatars',
                Key: fileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype
            };

            await s3Client.send(new PutObjectCommand(uploadParams));

            // Extract project ID from the S3 endpoint to build the public URL
            let projectId = process.env.SUPABASE_PROJECT_REF;
            try {
                const urlObj = new URL(projectId);
                projectId = urlObj.hostname.split('.')[0];
            } catch (e) {
                // Fallback in case it's just the ID
            }

            const publicUrl = `https://${projectId}.supabase.co/storage/v1/object/public/avatars/${fileName}`;

            // Update user in DB
            const updatedUser = await User.update(userId, {
                username: existingUser.username,
                full_name: existingUser.full_name,
                email: existingUser.email,
                role: existingUser.role,
                profile_image_url: publicUrl
            });

            res.json({
                message: 'Avatar uploaded successfully',
                profileImageUrl: publicUrl,
                user: updatedUser
            });
        } catch (error) {
            console.error('[AUTH] User avatar upload error:', error);
            res.status(500).json({ message: 'Error uploading avatar', details: error.message });
        }
    });
};

module.exports = {
    login,
    getUsers,
    getUserById,
    updateUser,
    register,
    changePassword,
    updateProfile,
    uploadAvatar,
    uploadUserAvatar
};
