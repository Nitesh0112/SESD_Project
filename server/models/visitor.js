const db = require('../db');

let store = [];

async function register(v) {
  // v: { name, visitor_for, id_proof, phone, in_time, out_time }
  if (db && db.ready) {
    try {
      const result = await db.query('INSERT INTO visitors (name,visitor_for,id_proof,phone,in_time,out_time) VALUES (?,?,?,?,?,?)', [v.name, v.visitor_for, v.id_proof, v.phone, v.in_time || null, v.out_time || null]);
      v.id = result.insertId || Date.now();
      return v;
    } catch (err) { console.warn('DB visitors insert failed', err); }
  }
  v.id = Date.now(); store.push(v); return v;
}

async function getAll() {
  if (db && db.ready) {
    try { return await db.query('SELECT * FROM visitors ORDER BY in_time DESC'); } catch (err) { console.warn('DB visitors getAll failed', err); }
  }
  return store;
}

module.exports = { register, getAll };