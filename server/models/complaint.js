const db = require('../db');

let store = [];

async function _ensureStudentId(email) {
  if (!email) return null;
  try {
    const rows = await db.query('SELECT id FROM students WHERE email = ? LIMIT 1', [email]);
    if (rows && rows[0]) return rows[0].id;
    // create student placeholder
    const name = email.split('@')[0];
    const res = await db.query('INSERT INTO students (name,email) VALUES (?,?)', [name, email]);
    return res.insertId;
  } catch (err) {
    // db may be unavailable
    return null;
  }
}

async function create(data) {
  // data: { student (email) or student_id, category, details, status }
  if (db && db.ready) {
    try {
      let sid = data.student_id || null;
      if (!sid && data.student && typeof data.student === 'string' && data.student.includes('@')) {
        sid = await _ensureStudentId(data.student);
      }
      const result = await db.query('INSERT INTO complaints (student_id,category,details,status) VALUES (?,?,?,?)', [sid, data.category, data.details, data.status || 'open']);
      data.id = result.insertId || Date.now();
      data.student_id = sid;
      return data;
    } catch (err) { console.warn('DB complaints insert failed', err); }
  }
  data.id = Date.now();
  store.push(data);
  return data;
}

async function getAll() {
  if (db && db.ready) {
    try { return await db.query('SELECT * FROM complaints ORDER BY created_at DESC'); } catch (err) { console.warn('DB complaints getAll failed', err); }
  }
  return store;
}

async function getById(id) {
  if (db && db.ready) {
    try { const rows = await db.query('SELECT * FROM complaints WHERE id = ?', [id]); return rows && rows[0] ? rows[0] : null; } catch (err) { console.warn('DB complaints getById failed', err); }
  }
  return store.find(c => Number(c.id) === Number(id)) || null;
}

async function update(id, patch) {
  if (db && db.ready) {
    try { await db.query('UPDATE complaints SET ? WHERE id = ?', [patch, id]); const rows = await db.query('SELECT * FROM complaints WHERE id = ?', [id]); return rows && rows[0] ? rows[0] : null; } catch (err) { console.warn('DB complaints update failed', err); }
  }
  const idx = store.findIndex(c => Number(c.id) === Number(id));
  if (idx < 0) return null;
  store[idx] = { ...store[idx], ...patch };
  return store[idx];
}

module.exports = { create, getAll, getById, update };