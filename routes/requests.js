const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/', auth(), (req, res) => {
  const { kind, type, start_date, end_date, minutes, reason } = req.body;
  if (!['timeoff', 'overtime'].includes(kind) || !start_date) {
    return res.status(400).json({ message: 'Data pengajuan tidak valid' });
  }
  db.prepare(`INSERT INTO requests(employee_id,kind,type,start_date,end_date,minutes,reason)
              VALUES(?,?,?,?,?,?,?)`)
    .run(req.user.id, kind, type || null, start_date, end_date || start_date,
         Number(minutes) || 0, reason || null);
  res.status(201).json({ ok: true });
});

router.get('/pending-count', auth(['admin', 'hr']), (req, res) => {
  const c = k => db.prepare("SELECT COUNT(*) n FROM requests WHERE kind=? AND status='pending'").get(k).n;
  res.json({ overtime: c('overtime'), timeoff: c('timeoff') });
});

router.get('/', auth(), (req, res) => {
  const admin = ['admin', 'hr'].includes(req.user.role);
  let sql = `SELECT r.*, e.name FROM requests r JOIN employees e ON e.id = r.employee_id WHERE r.kind = ?`;
  const p = [req.query.kind];
  if (!admin) { sql += ' AND r.employee_id = ?'; p.push(req.user.id); }
  sql += ' ORDER BY r.id DESC';
  res.json(db.prepare(sql).all(...p));
});

router.patch('/:id', auth(['admin', 'hr']), (req, res) => {
  if (!['approved', 'rejected'].includes(req.body.status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }
  db.prepare("UPDATE requests SET status=?, decided_by=? WHERE id=? AND status='pending'")
    .run(req.body.status, req.user.id, req.params.id);
  res.json({ ok: true });
});

module.exports = router;