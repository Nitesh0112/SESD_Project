const db = require('../db');

let store = [];

async function create(student) {
  // student: { name, room, email, phone }
  if (db && db.ready) {
    try {
      const result = await db.query('INSERT INTO students (name,room,email,phone) VALUES (?,?,?,?)', [student.name, student.room, student.email, student.phone || null]);
      student.id = result.insertId || Date.now();
      return student;
    } catch (err) { console.warn('DB students insert failed', err); }
  }
  student.id = Date.now(); store.push(student); return student;
}

async function getAll() {
  if (db && db.ready) {
    try { return await db.query('SELECT * FROM students ORDER BY id DESC'); } catch (err) { console.warn('DB students getAll failed', err); }
  }
  return store;
}

async function getById(id) {
  if (db && db.ready) {
    try { const rows = await db.query('SELECT * FROM students WHERE id = ?', [id]); return rows && rows[0] ? rows[0] : null; } catch (err) { console.warn('DB students getById failed', err); }
  }
  return store.find(s => Number(s.id) === Number(id)) || null;
}

async function findByEmail(email) {
  if (!email) return null;
  if (db && db.ready) {
    try { const rows = await db.query('SELECT * FROM students WHERE email = ? LIMIT 1', [email]); return rows && rows[0] ? rows[0] : null; } catch (err) { console.warn('DB students findByEmail failed', err); }
  }
  return store.find(s => (s.email || '').toLowerCase() === (email || '').toLowerCase()) || null;
}

async function getOrCreateByEmail(payload) {
  const email = payload && payload.email;
  if (!email) return null;
  const existing = await findByEmail(email);
  if (existing) return existing;
  const toCreate = { name: payload.name || (email.split('@')[0] || ''), email, room: payload.room || '', phone: payload.phone || '' };
  return await create(toCreate);
}

module.exports = { create, getAll, getById, findByEmail, getOrCreateByEmail };