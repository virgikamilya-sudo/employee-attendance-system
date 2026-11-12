const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const H = require('../lib/helpers');

router.get('/shifts', auth(), (req, res) => {
  res.json(db.prepare('SELECT * FROM shifts ORDER BY id').all());
});

router.post('/shifts', auth(['admin', 'hr']), (req, res) => {
  const { name, start_time, end_time } = req.body;
  if (!name || !start_time || !end_time) return res.status(400).json({ message: 'Data tidak lengkap' });
  db.prepare('INSERT INTO shifts(name,start_time,end_time) VALUES(?,?,?)').run(name, start_time, end_time);
  res.status(201).json({ ok: true });
});

router.put('/shifts/:id', auth(['admin', 'hr']), (req, res) => {
  const { name, start_time, end_time } = req.body;
  db.prepare('UPDATE shifts SET name=?, start_time=?, end_time=? WHERE id=?')
    .run(name, start_time, end_time, req.params.id);
  res.json({ ok: true });
});

router.get('/settings', auth(['admin', 'hr']), (req, res) => res.json(H.getSettings()));

router.put('/settings', auth(['admin', 'hr']), (req, res) => {
  const allowed = ['office_lat', 'office_lng', 'radius_m', 'late_tolerance', 'overtime_min'];
  for (const k of allowed) {
    if (req.body[k] !== undefined && req.body[k] !== '') {
      db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(k, String(req.body[k]));
    }
  }
  H.audit(req.user.id, 'update_settings', JSON.stringify(req.body));
  res.json({ ok: true });
});

module.exports = router;