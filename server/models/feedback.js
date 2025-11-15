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

async function submit(data) {
  // data: { student (email) or student_id, mess, rating, comments }
  if (db && db.ready) {
    try {
      let sid = data.student_id || null;
      if (!sid && data.student && typeof data.student === 'string' && data.student.includes('@')) {
        sid = await _ensureStudentId(data.student);
      }
      const result = await db.query('INSERT INTO feedbacks (student_id,mess,rating,comments) VALUES (?,?,?,?)', [sid, data.mess, data.rating, data.comments]);
      data.id = result.insertId || Date.now();
      data.student_id = sid;
      return data;
    } catch (err) { console.warn('DB feedbacks insert failed', err); }
  }
  data.id = Date.now();
  store.push(data);
  return data;
}

async function getAll() {
  if (db && db.ready) {
    try { return await db.query('SELECT * FROM feedbacks ORDER BY id DESC'); } catch (err) { console.warn('DB feedbacks getAll failed', err); }
  }
  return store;
}

module.exports = { submit, getAll };