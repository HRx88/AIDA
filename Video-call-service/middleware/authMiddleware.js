const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this';

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Authentication token missing' });

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ message: 'Invalid or expired token' });
            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ message: 'Authorization header missing' });
    }
};

const authorizeRole = (role) => {
    return (req, res, next) => {
        if (!req.user || (req.user.role !== role && req.user.role !== 'admin')) {
            return res.status(403).json({ message: `Access denied. Requires ${role} role.` });
        }
        next();
    };
};

module.exports = { authenticateJWT, authorizeRole };
