const fs = require('fs');
const path = require('path');
const db = require('../db');

const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function getSettings() {
  const o = {};
  for (const r of db.prepare('SELECT * FROM settings').all()) o[r.key] = r.value;
  return {
    office_lat: +o.office_lat, office_lng: +o.office_lng,
    radius_m: +o.radius_m, late_tolerance: +o.late_tolerance, overtime_min: +o.overtime_min
  };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = x => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function calcStatus(clockIn, shiftStart, tolerance) {
  const c = toMin(clockIn), s = toMin(shiftStart);
  if (c > s + tolerance) return 'late';
  if (c < s) return 'early';
  return 'on_time';
}

function calcOvertime(clockOut, shiftEnd, minMinutes) {
  const diff = toMin(clockOut) - toMin(shiftEnd);
  return diff >= minMinutes ? diff : 0;
}

function savePhoto(dataUrl, prefix) {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const name = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${m[1] === 'png' ? 'png' : 'jpg'}`;
  fs.writeFileSync(path.join(__dirname, '..', 'uploads', name), Buffer.from(m[2], 'base64'));
  return name;
}

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'attendance-app/1.0' }, signal: AbortSignal.timeout(4000) }
    );
    const j = await r.json();
    return j.display_name || null;
  } catch { return null; }
}

function audit(userId, action, detail) {
  db.prepare('INSERT INTO audit_logs(user_id,action,detail) VALUES(?,?,?)').run(userId, action, detail);
}

module.exports = { fmtDate, fmtTime, toMin, getSettings, haversine, calcStatus,
                   calcOvertime, savePhoto, reverseGeocode, audit };