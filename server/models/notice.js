const db = require('../db');

let store = [];

async function create(notice) {
  // notice: { title, category, date, content, archived }
  if (db && db.ready) {
    try {
      const result = await db.query('INSERT INTO notices (title,category,date,content,archived) VALUES (?,?,?,?,?)', [notice.title, notice.category, notice.date || null, notice.content, notice.archived ? 1 : 0]);
      notice.id = result.insertId || Date.now();
      return notice;
    } catch (err) { console.warn('DB notices insert failed', err); }
  }
  notice.id = Date.now(); store.push(notice); return notice;
}

async function getAll() {
  if (db && db.ready) {
    try { return await db.query('SELECT id,title,category,DATE_FORMAT(date, "%Y-%m-%d") as date,content,archived FROM notices ORDER BY date DESC'); } catch (err) { console.warn('DB notices getAll failed', err); }
  }
  return store;
}

module.exports = { create, getAll };