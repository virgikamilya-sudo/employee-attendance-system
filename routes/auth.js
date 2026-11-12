const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

router.post("/login", (req, res) => {
    const { email, password } = req.body || {};

    const user = db.prepare(
        "SELECT * FROM employees WHERE email = ? AND active = 1"
    ).get(email || "");

    if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
        return res.status(401).json({
            message: "Email atau password salah"
        });
    }

    const payload = {
        id: user.id,
        name: user.name,
        role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "12h"
    });

    res.json({ token, user: payload });
});

module.exports = router;