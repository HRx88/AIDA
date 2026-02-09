const jwt = require("jsonwebtoken");

function authenticateJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) return res.status(401).json({ message: "Missing token" });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "JWT_SECRET not set in .env" });

    const decoded = jwt.verify(token, secret);

    // Normalize userId so controllers can rely on one field name
    const userId = decoded.userId ?? decoded.id ?? decoded.user_id;
    req.user = { ...decoded, userId };

    if (!req.user.userId) {
      return res.status(401).json({ message: "Token missing userId" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = { authenticateJWT };
