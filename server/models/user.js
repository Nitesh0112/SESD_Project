const db = require('../db');
const bcrypt = require('bcrypt');

// In-process fallback store
let users = [];

function sanitize(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

async function register(user) {
  // user: { name, email, password, role }
  const hashed = await bcrypt.hash(user.password || '', 10);
  const toSave = { name: user.name, email: user.email, password: hashed, role: user.role || 'student' };
  if (db && db.ready) {
    try {
      const result = await db.query('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)', [toSave.name, toSave.email, toSave.password, toSave.role]);
      toSave.id = result.insertId || Date.now();
      return sanitize(toSave);
    } catch (err) {
      console.warn('DB users insert failed', err);
    }
  }
  toSave.id = Date.now();
  users.push(toSave);
  return sanitize(toSave);
}

async function findByEmail(email) {
  if (db && db.ready) {
    try {
      const rows = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
      return rows && rows[0] ? rows[0] : null;
    } catch (err) { console.warn('DB users find failed', err); }
  }
  return users.find(u => u.email === email) || null;
}

async function verifyPassword(email, plain) {
  const user = await findByEmail(email);
  if (!user) return false;
  try {
    return await bcrypt.compare(plain, user.password || '');
  } catch (err) {
    console.warn('bcrypt compare failed', err);
    return false;
  }
}

async function getAll() {
  if (db && db.ready) {
    try { const rows = await db.query('SELECT id,name,email,role FROM users ORDER BY id DESC'); return rows; } catch (err) { console.warn('DB users getAll failed', err); }
  }
  return users.map(u => sanitize(u));
}

async function getById(id) {
  if (db && db.ready) {
    try { const rows = await db.query('SELECT id,name,email,role FROM users WHERE id = ?', [id]); return rows && rows[0] ? rows[0] : null; } catch (err) { console.warn('DB users getById failed', err); }
  }
  return sanitize(users.find(u => Number(u.id) === Number(id)) || null);
}

module.exports = { register, findByEmail, verifyPassword, getAll, getById };