const db = require('../db');

let store = [];

async function _ensureStudentId(email) {
  if (!email) return null;
  try {
    const rows = await db.query('SELECT id FROM students WHERE email = ? LIMIT 1', [email]);
    if (rows && rows[0]) return rows[0].id;
    const name = email.split('@')[0];
    const res = await db.query('INSERT INTO students (name,email) VALUES (?,?)', [name, email]);
    return res.insertId;
  } catch (err) { return null; }
}

async function requestOutpass(data) {
  // data: { student (email) or student_id, from_date, to_date, reason, status }
  if (db && db.ready) {
    try {
      let sid = data.student_id || null;
      if (!sid && data.student && typeof data.student === 'string' && data.student.includes('@')) {
        sid = await _ensureStudentId(data.student);
      }
      const result = await db.query('INSERT INTO outpasses (student_id,from_date,to_date,reason,status) VALUES (?,?,?,?,?)', [sid, data.from_date || null, data.to_date || null, data.reason, data.status || 'pending']);
      data.id = result.insertId || Date.now();
      data.student_id = sid;
      return data;
    } catch (err) { console.warn('DB outpasses insert failed', err); }
  }
  data.id = Date.now();
  store.push(data);
  return data;
}

async function getAll() {
  if (db && db.ready) {
    try { return await db.query('SELECT * FROM outpasses ORDER BY created_at DESC'); } catch (err) { console.warn('DB outpasses getAll failed', err); }
  }
  return store;
}

async function update(id, patch) {
  if (db && db.ready) {
    try { await db.query('UPDATE outpasses SET ? WHERE id = ?', [patch, id]); const rows = await db.query('SELECT * FROM outpasses WHERE id = ?', [id]); return rows && rows[0] ? rows[0] : null; } catch (err) { console.warn('DB outpasses update failed', err); }
  }
  const idx = store.findIndex(o => Number(o.id) === Number(id));
  if (idx < 0) return null;
  store[idx] = { ...store[idx], ...patch };
  return store[idx];
}

module.exports = { requestOutpass, getAll, update };