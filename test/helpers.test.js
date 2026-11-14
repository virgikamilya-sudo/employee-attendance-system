const test = require('node:test');
const assert = require('node:assert');
const { toMin, fmtDate, fmtTime, haversine, calcStatus, calcOvertime } = require('../lib/helpers');

test('toMin mengubah HH:MM menjadi menit', () => {
  assert.strictEqual(toMin('00:00'), 0);
  assert.strictEqual(toMin('08:30'), 510);
  assert.strictEqual(toMin('17:00'), 1020);
});

test('fmtDate dan fmtTime memberi format yang benar', () => {
  assert.strictEqual(fmtDate(new Date(2026, 10, 14)), '2026-11-14');
  assert.strictEqual(fmtTime(new Date(2026, 10, 14, 8, 5)), '08:05');
});

test('calcStatus', () => {
  assert.strictEqual(calcStatus('08:03', '08:00', 5), 'on_time'); // dalam toleransi
  assert.strictEqual(calcStatus('08:05', '08:00', 5), 'on_time'); // tepat batas toleransi
  assert.strictEqual(calcStatus('08:06', '08:00', 5), 'late');
  assert.strictEqual(calcStatus('07:45', '08:00', 5), 'early');
});

test('calcOvertime', () => {
  assert.strictEqual(calcOvertime('17:20', '17:00', 30), 0);   // kurang dari batas minimal
  assert.strictEqual(calcOvertime('17:30', '17:00', 30), 30);  // tepat batas minimal
  assert.strictEqual(calcOvertime('18:00', '17:00', 30), 60);
  assert.strictEqual(calcOvertime('16:45', '17:00', 30), 0);   // pulang lebih awal
});

test('haversine', () => {
  // titik yang sama = 0 meter
  assert.ok(haversine(-6.2, 106.8, -6.2, 106.8) < 1);
  // 1 derajat lintang kira-kira 111 km
  const d = haversine(0, 0, 1, 0);
  assert.ok(d > 111000 && d < 111400, `jarak ${d}`);
});