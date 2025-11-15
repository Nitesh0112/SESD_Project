const db = require('../db');

let store = [];

async function create(room) {
  // room: { number, capacity, occupancy }
  if (db && db.ready) {
    try {
      const result = await db.query('INSERT INTO rooms (number,capacity,occupancy) VALUES (?,?,?)', [room.number, room.capacity || 1, room.occupancy || 0]);
      room.id = result.insertId || Date.now();
      return room;
    } catch (err) { console.warn('DB rooms insert failed', err); }
  }
  room.id = Date.now(); store.push(room); return room;
}

async function getAll() {
  if (db && db.ready) {
    try { return await db.query('SELECT * FROM rooms ORDER BY id DESC'); } catch (err) { console.warn('DB rooms getAll failed', err); }
  }
  return store;
}

module.exports = { create, getAll };