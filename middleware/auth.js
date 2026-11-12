const jwt = require("jsonwebtoken");

module.exports = (roles = []) => {
    return (req, res, next) => {

        const header = req.headers.authorization || "";

        const token = header.startsWith("Bearer ")
            ? header.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                message: "Unauthorized"
            });
        }

        try {
            req.user = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch {
            return res.status(401).json({
                message: "Token tidak valid"
            });
        }

        if (
            roles.length &&
            !roles.includes(req.user.role)
        ) {
            return res.status(403).json({
                message: "Akses ditolak"
            });
        }

        next();
    };
};