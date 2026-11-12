const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth(['admin', 'hr']));

router.get('/', (req, res) => {
  res.json(db.prepare(`
    SELECT e.id, e.employee_no, e.name, e.email, e.role, e.department, e.position,
           e.photo, e.shift_id, s.name AS shift
    FROM employees e LEFT JOIN shifts s ON s.id = e.shift_id
    WHERE e.active = 1 ORDER BY e.name`).all());
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.employee_no || !b.name || !b.email || !b.password) {
    return res.status(400).json({ message: 'Data wajib belum lengkap' });
  }
  try {
    const r = db.prepare(`INSERT INTO employees
      (employee_no,name,email,password_hash,role,department,position,shift_id)
      VALUES(?,?,?,?,?,?,?,?)`)
      .run(b.employee_no, b.name, b.email, bcrypt.hashSync(b.password, 10),
           b.role || 'employee', b.department || null, b.position || null, b.shift_id || 1);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch {
    res.status(400).json({ message: 'Employee No atau email sudah dipakai' });
  }
});

router.put('/:id', (req, res) => {
  const b = req.body;
  try {
    db.prepare(`UPDATE employees SET employee_no=?, name=?, email=?, role=?,
                department=?, position=?, shift_id=? WHERE id=?`)
      .run(b.employee_no, b.name, b.email, b.role || 'employee',
           b.department || null, b.position || null, b.shift_id || 1, req.params.id);
    if (b.password) {
      db.prepare('UPDATE employees SET password_hash=? WHERE id=?')
        .run(bcrypt.hashSync(b.password, 10), req.params.id);
    }
    res.json({ ok: true });
  } catch {
    res.status(400).json({ message: 'Employee No atau email sudah dipakai' });
  }
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE employees SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;