const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const db = new Database("attendance.db");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    department TEXT,
    position TEXT,
    photo TEXT,
    shift_id INTEGER REFERENCES shifts(id),
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    date TEXT NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    status TEXT NOT NULL DEFAULT 'on_time',
    overtime_minutes INTEGER DEFAULT 0,
    in_photo TEXT,
    out_photo TEXT,
    in_lat REAL,
    in_lng REAL,
    in_address TEXT,
    is_valid INTEGER DEFAULT 1,
    note TEXT,
    source TEXT DEFAULT 'app',
    UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    kind TEXT NOT NULL,
    type TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    minutes INTEGER DEFAULT 0,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    decided_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    detail TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const shiftExists = db.prepare(
    "SELECT 1 FROM shifts LIMIT 1"
).get();

if (!shiftExists) {
    db.prepare(`
        INSERT INTO shifts (name, start_time, end_time)
        VALUES (?, ?, ?)
    `).run("Regular", "08:00", "17:00");

    console.log("Jadwal kerja berhasil ditambahkan");
}

const defaults = {
    office_lat: "-6.2383",
    office_lng: "106.9756",
    radius_m: "100",
    late_tolerance: "5",
    overtime_min: "30"
};

for (const [key, value] of Object.entries(defaults)) {

    db.prepare(`
        INSERT OR IGNORE INTO settings (key, value)
        VALUES (?, ?)
    `).run(key, value);

}

console.log("Pengaturan awal berhasil diperiksa");


const adminExists = db.prepare(`
    SELECT 1 FROM employees
    WHERE role = 'admin'
`).get();

if (!adminExists) {

    const hashedPassword = bcrypt.hashSync(
        "admin123",
        10
    );

    db.prepare(`
        INSERT INTO employees (
            employee_no,
            name,
            email,
            password_hash,
            role,
            shift_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        "ADM001",
        "Administrator",
        "admin@company.com",
        hashedPassword,
        "admin",
        1
    );

    console.log("Akun Administrator berhasil dibuat");
}

module.exports = db;