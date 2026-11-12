const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const H = require('../lib/helpers');

const empWithShift = id => db.prepare(`
  SELECT e.*, COALESCE(s.start_time,'08:00') AS start_time, COALESCE(s.end_time,'17:00') AS end_time
  FROM employees e LEFT JOIN shifts s ON s.id = e.shift_id WHERE e.id = ?`).get(id);

router.post('/clock-in', auth(), async (req, res) => {
  const { photo, lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ message: 'Lokasi tidak tersedia' });
  }
  const emp = empWithShift(req.user.id);
  const cfg = H.getSettings();
  const now = new Date(), date = H.fmtDate(now), time = H.fmtTime(now);

  if (db.prepare('SELECT 1 FROM attendance WHERE employee_id=? AND date=?').get(emp.id, date)) {
    return res.status(400).json({ message: 'Anda sudah clock-in hari ini' });
  }
  const photoName = H.savePhoto(photo, 'in');
  if (!photoName) return res.status(400).json({ message: 'Foto selfie wajib diambil' });

  const dist = H.haversine(lat, lng, cfg.office_lat, cfg.office_lng);
  const address = await H.reverseGeocode(lat, lng);

  db.prepare(`INSERT INTO attendance
    (employee_id,date,clock_in,status,in_photo,in_lat,in_lng,in_address,is_valid)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(emp.id, date, time, H.calcStatus(time, emp.start_time, cfg.late_tolerance),
         photoName, lat, lng, address, dist <= cfg.radius_m ? 1 : 0);

  res.json({ message: 'Clock-in berhasil', time, distance: Math.round(dist) });
});

router.post('/clock-out', auth(), (req, res) => {
  const emp = empWithShift(req.user.id);
  const cfg = H.getSettings();
  const now = new Date(), date = H.fmtDate(now), time = H.fmtTime(now);

  const rec = db.prepare('SELECT * FROM attendance WHERE employee_id=? AND date=?').get(emp.id, date);
  if (!rec) return res.status(400).json({ message: 'Anda belum clock-in hari ini' });
  if (rec.clock_out) return res.status(400).json({ message: 'Anda sudah clock-out' });

  const photoName = H.savePhoto(req.body.photo, 'out');
  db.prepare('UPDATE attendance SET clock_out=?, out_photo=?, overtime_minutes=? WHERE id=?')
    .run(time, photoName, H.calcOvertime(time, emp.end_time, cfg.overtime_min), rec.id);

  res.json({ message: 'Clock-out berhasil', time });
});

router.get('/me', auth(), (req, res) => {
  res.json(db.prepare('SELECT * FROM attendance WHERE employee_id=? ORDER BY date DESC LIMIT 31')
    .all(req.user.id));
});

function summary(date) {
  const emps = db.prepare("SELECT id FROM employees WHERE active=1 AND role='employee'").all();
  const rows = db.prepare('SELECT * FROM attendance WHERE date=?').all(date);
  const byEmp = new Map(rows.map(r => [r.employee_id, r]));
  const leave = new Set(db.prepare(`SELECT employee_id FROM requests
      WHERE kind='timeoff' AND status='approved' AND ? BETWEEN start_date AND end_date`)
      .all(date).map(r => r.employee_id));

  const weekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay());
  const today = H.fmtDate(new Date());
  const s = { on_time: 0, late: 0, early: 0, absent: 0, no_clock_in: 0,
              no_clock_out: 0, invalid: 0, day_off: 0, time_off: 0 };

  for (const e of emps) {
    const r = byEmp.get(e.id);
    if (r) {
      s[r.status]++;
      if (!r.clock_out && date < today) s.no_clock_out++;
      if (!r.is_valid) s.invalid++;
    } else if (leave.has(e.id)) s.time_off++;
    else if (weekend) s.day_off++;
    else if (date < today) s.absent++;
    else if (date === today) s.no_clock_in++;
  }
  return s;
}

router.get('/summary', auth(['admin', 'hr']), (req, res) => {
  res.json(summary(req.query.date || H.fmtDate(new Date())));
});

router.get('/', auth(['admin', 'hr']), (req, res) => {
  const { date, from, to, q = '', status } = req.query;
  let sql = `SELECT a.*, e.name, e.employee_no, e.photo AS avatar
             FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE 1=1`;
  const p = [];
  if (from && to) { sql += ' AND a.date BETWEEN ? AND ?'; p.push(from, to); }
  else if (date) { sql += ' AND a.date = ?'; p.push(date); }
  if (q) { sql += ' AND (e.name LIKE ? OR e.employee_no LIKE ?)'; p.push(`%${q}%`, `%${q}%`); }
  if (status) { sql += ' AND a.status = ?'; p.push(status); }
  sql += ' ORDER BY a.date DESC, a.clock_in ASC';
  res.json(db.prepare(sql).all(...p));
});

router.post('/manual', auth(['admin', 'hr']), (req, res) => {
  const { employee_id, date, clock_in, clock_out, note } = req.body;
  const emp = empWithShift(employee_id);
  if (!emp || !date || !clock_in) return res.status(400).json({ message: 'Data tidak lengkap' });
  const cfg = H.getSettings();
  try {
    db.prepare(`INSERT INTO attendance
      (employee_id,date,clock_in,clock_out,status,overtime_minutes,note,source)
      VALUES(?,?,?,?,?,?,?,'manual')`)
      .run(emp.id, date, clock_in, clock_out || null,
           H.calcStatus(clock_in, emp.start_time, cfg.late_tolerance),
           clock_out ? H.calcOvertime(clock_out, emp.end_time, cfg.overtime_min) : 0,
           note || null);
  } catch {
    return res.status(400).json({ message: 'Absensi di tanggal tersebut sudah ada' });
  }
  H.audit(req.user.id, 'manual_attendance', `employee ${emp.id} @ ${date}`);
  res.status(201).json({ ok: true });
});

router.get('/export', auth(['admin', 'hr']), (req, res) => {
  const today = H.fmtDate(new Date());
  const { from = today, to = today } = req.query;
  const rows = db.prepare(`
    SELECT a.date, e.employee_no, e.name, a.clock_in, a.clock_out, a.status,
           a.overtime_minutes, a.in_address, a.is_valid, a.note
    FROM attendance a JOIN employees e ON e.id = a.employee_id
    WHERE a.date BETWEEN ? AND ? ORDER BY a.date, e.name`).all(from, to);

  const head = ['Tanggal', 'No', 'Nama', 'Clock In', 'Clock Out', 'Status',
                'Lembur (menit)', 'Lokasi', 'Valid', 'Catatan'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [head.map(q).join(','), ...rows.map(r => Object.values(r).map(q).join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
  res.send('\ufeff' + csv);
});

module.exports = router;