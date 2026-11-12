require("dotenv").config();
process.env.TZ = process.env.TZ || "Asia/Jakarta";

const express = require("express");
const path = require("path");

require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "6mb" }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/requests", require("./routes/requests"));
app.use("/api", require("./routes/config"));

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});