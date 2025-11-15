// ----------------------------------------------------
// Smart Hostel Management System (SHMS)
// Express + MySQL Backend
// ----------------------------------------------------

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // MySQL DB helper
require('dotenv').config();

// ----------------------------------------------------
// Express App Setup
// ----------------------------------------------------
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------
// Static Frontend Serving
// ----------------------------------------------------
const staticDir = path.join(__dirname, '..');
app.use(express.static(staticDir));

// ----------------------------------------------------
// Health Check
// ----------------------------------------------------
app.get('/health', (req, res) => res.json({ ok: true, db_ready: db.ready }));

// ----------------------------------------------------
// SPA Fallback (Serve index.html for non-API routes)
// ----------------------------------------------------
// SPA Fallback (Express 5-safe wildcard)
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/server') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(staticDir, 'index.html'));
});


// ----------------------------------------------------
// DEMO FALLBACK DATA (used if DB is unavailable)
// ----------------------------------------------------
let notices = [
  { id: 1, title: 'Welcome', category: 'General', date: new Date().toISOString().slice(0,10), content: 'Welcome to hostel', archived: false }
];
let students = [ { id: 1, name: 'Ravi Kumar', room: '101', email: 'ravi@uni.edu' } ];
let complaints = [];
let outpasses = [];
let visitors = [];
let rooms = [];

// Models
const User = require('./models/user');
const Student = require('./models/Student');
const Complaint = require('./models/complaint');
const Outpass = require('./models/outpass');
const VisitorModel = require('./models/visitor');
const RoomModel = require('./models/Room');
const NoticeModel = require('./models/notice');
const Feedback = require('./models/feedback');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'shms_dev_secret';

function generateToken(user) {
  const payload = { id: user.id, role: user.role || 'student', email: user.email, name: user.name };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth) return res.status(401).json({ success: false, message: 'Missing Authorization header' });
  const parts = auth.split(' ');
  const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : parts[0];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (req.user.role !== role) return res.status(403).json({ success: false, message: 'Insufficient role' });
    return next();
  };
}

// ----------------------------------------------------
// AUTHENTICATION (demo only — to be replaced with real users table later)
// ----------------------------------------------------
app.post('/api/login', async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ success: false, message: 'Missing credentials' });
  // simple validation
  if (password.length < 4 || !email.includes('@')) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  try {
    const user = await User.findByEmail(email);
    if (user) {
      const ok = await User.verifyPassword(email, password);
      if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const token = generateToken(user);
      // Ensure student record exists for student users
      try {
        if (!user.role || user.role === 'student') {
          const stud = await Student.getOrCreateByEmail({ email: user.email, name: user.name });
          const safe = { id: stud.id || user.id, name: stud.name || user.name, email: user.email, room: stud.room || '', role: user.role };
          return res.json({ success: true, user: safe, token });
        }
      } catch (e) { console.warn('Student getOrCreate failed', e); }
      const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
      return res.json({ success: true, user: safe, token });
    }
  } catch (err) {
    console.warn('User lookup failed, falling back to demo login', err && err.message ? err.message : err);
  }

  // Fallback demo user when DB/user not found
  const demoUser = { email, role, name: email.split('@')[0] };
  const token = generateToken(demoUser);
  // Ensure a student record exists in students when demo-login
  try {
    if (!role || role === 'student') {
      const stud = await Student.getOrCreateByEmail({ email: demoUser.email, name: demoUser.name });
      const safe = { id: stud.id || demoUser.id, name: stud.name || demoUser.name, email: demoUser.email, room: stud.room || '', role: demoUser.role };
      return res.json({ success: true, user: safe, token });
    }
  } catch (e) { console.warn('Demo student ensure failed', e); }
  return res.json({ success: true, user: demoUser, token });
});

// Register
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ success: false, message: 'Missing fields' });
  try {
    const existing = await User.findByEmail(email);
    if (existing) return res.status(409).json({ success: false, message: 'User already exists' });
    const created = await User.register({ name, email, password, role });
    const token = generateToken({ id: created.id, name: created.name, email: created.email, role: created.role });
    return res.json({ success: true, user: created, token });
  } catch (err) {
    console.error('Register failed', err);
    return res.status(500).json({ success: false, message: 'Register failed' });
  }
});

// ----------------------------------------------------
// NOTICES MODULE
// ----------------------------------------------------
app.get('/api/notices', async (req, res) => {
  try {
    const rows = await NoticeModel.getAll();
    return res.json(rows);
  } catch (err) {
    console.error('NoticeModel.getAll failed', err);
  }
  return res.json(notices);
});

app.post('/api/notices', verifyToken, requireRole('admin'), async (req, res) => {
  const payload = req.body || {};
  try {
    const created = await NoticeModel.create(payload);
    return res.json({ success: true, notice: created });
  } catch (err) {
    console.error('NoticeModel.create failed', err);
  }
  payload.id = Date.now(); notices.push(payload); res.json({ success: true, notice: payload });
});

// ----------------------------------------------------
// STUDENTS MODULE
// ----------------------------------------------------
app.get('/api/students', async (req, res) => {
  try {
    const rows = await Student.getAll();
    return res.json(rows);
  } catch (err) {
    console.error('Student.getAll failed', err);
  }
  return res.json(students);
});

app.post('/api/students', async (req, res) => {
  const payload = req.body || {};
  try {
    const created = await Student.create(payload);
    return res.json({ success: true, student: created });
  } catch (err) {
    console.error('Student.create failed', err);
  }
  payload.id = Date.now(); students.push(payload); res.json({ success: true, student: payload });
});

// ----------------------------------------------------
// COMPLAINTS MODULE
// ----------------------------------------------------
app.get('/api/complaints', async (req, res) => {
  try {
    const rows = await Complaint.getAll();
    return res.json(rows);
  } catch (err) {
    console.error('Complaint.getAll failed', err);
  }
  return res.json(complaints);
});

app.post('/api/complaints', async (req, res) => {
  const payload = req.body || {};
  try {
    const created = await Complaint.create(payload);
    return res.json({ success: true, complaint: created });
  } catch (err) {
    console.error('Complaint.create failed', err);
  }
  payload.id = Date.now(); complaints.push(payload); res.json({ success: true, complaint: payload });
});

// Allow updating complaint status/details
app.put('/api/complaints/:id', async (req, res) => {
  const id = Number(req.params.id);
  const patch = req.body || {};
  try {
    const updated = await Complaint.update(id, patch);
    if (!updated) return res.status(404).json({ success: false });
    return res.json({ success: true, complaint: updated });
  } catch (err) {
    console.error('Complaint.update failed', err);
  }
  const idx = complaints.findIndex(c => c.id === id);
  if (idx < 0) return res.status(404).json({ success: false });
  complaints[idx] = { ...complaints[idx], ...patch };
  return res.json({ success: true, complaint: complaints[idx] });
});

// ----------------------------------------------------
// OUTPASSES MODULE
// ----------------------------------------------------
app.get('/api/outpasses', async (req, res) => {
  try {
    const rows = await Outpass.getAll();
    return res.json(rows);
  } catch (err) {
    console.error('Outpass.getAll failed', err);
  }
  return res.json(outpasses);
});

app.post('/api/outpasses', async (req, res) => {
  const payload = req.body || {};
  try {
    const created = await Outpass.requestOutpass(payload);
    return res.json({ success: true, outpass: created });
  } catch (err) {
    console.error('Outpass.requestOutpass failed', err);
  }
  payload.id = Date.now(); outpasses.push(payload); res.json({ success: true, outpass: payload });
});

app.put('/api/outpasses/:id', async (req, res) => {
  const id = Number(req.params.id);
  const patch = req.body || {};
  try {
    const updated = await Outpass.update(id, patch);
    if (!updated) return res.status(404).json({ success: false });
    return res.json({ success: true, outpass: updated });
  } catch (err) {
    console.error('Outpass.update failed', err);
  }
  const idx = outpasses.findIndex(o => o.id === id);
  if (idx < 0) return res.status(404).json({ success: false });
  outpasses[idx] = { ...outpasses[idx], ...patch };
  return res.json({ success: true, outpass: outpasses[idx] });
});

// ----------------------------------------------------
// VISITORS MODULE
// ----------------------------------------------------
app.get('/api/visitors', async (req, res) => {
  try {
    const rows = await VisitorModel.getAll();
    return res.json(rows);
  } catch (err) {
    console.error('VisitorModel.getAll failed', err);
  }
  return res.json(visitors);
});

app.post('/api/visitors', async (req, res) => {
  const payload = req.body || {};
  try {
    const created = await VisitorModel.register(payload);
    return res.json({ success: true, visitor: created });
  } catch (err) {
    console.error('VisitorModel.register failed', err);
  }
  payload.id = Date.now(); visitors.push(payload); res.json({ success: true, visitor: payload });
});

// ----------------------------------------------------
// ROOMS MODULE
// ----------------------------------------------------
app.post('/api/rooms', async (req, res) => {
  const payload = req.body || {};
  try {
    const created = await RoomModel.create(payload);
    return res.json({ success: true, room: created });
  } catch (err) {
    console.error('RoomModel.create failed', err);
  }
  payload.id = Date.now(); rooms.push(payload); res.json({ success: true, room: payload });
});

// ----------------------------------------------------
// REPORTS MODULE (export CSV of students & complaints)
// ----------------------------------------------------
app.get('/api/reports', async (req, res) => {
  let csv = 'Type,ID,Name,Detail,Status\n';
  try {
    const studs = await Student.getAll();
    const comps = await Complaint.getAll();
    studs.forEach(s => csv += `Student,${s.id},${s.name},${s.room || ''},\n`);
    comps.forEach(c => csv += `Complaint,${c.id},${c.student_id || c.student || ''},${c.category || c.details || ''},${c.status || ''}\n`);
  } catch (err) {
    console.error('Reports generation failed via models, falling back to in-memory', err);
    students.forEach(s => csv += `Student,${s.id},${s.name},${s.room || ''},\n`);
    complaints.forEach(c => csv += `Complaint,${c.id},${c.student || ''},${c.category || c.details || ''},${c.status || ''}\n`);
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
  res.send(csv);
});

// ----------------------------------------------------
// FEEDBACKS
// ----------------------------------------------------
app.get('/api/feedbacks', async (req, res) => {
  try {
    const rows = await Feedback.getAll();
    return res.json(rows);
  } catch (err) {
    console.error('Feedback.getAll failed', err);
  }
  return res.json([]);
});

app.post('/api/feedbacks', async (req, res) => {
  const payload = req.body || {};
  try {
    const created = await Feedback.submit(payload);
    return res.json({ success: true, feedback: created });
  } catch (err) {
    console.error('Feedback.submit failed', err);
  }
  return res.status(500).json({ success: false });
});

// ----------------------------------------------------
// STATS
// ----------------------------------------------------
app.get('/api/stats', async (req, res) => {
  try {
    const studs = await Student.getAll();
    const comps = await Complaint.getAll();
    const outs = await Outpass.getAll();
    const fbs = await Feedback.getAll();
    const stats = {
      totalStudents: Array.isArray(studs) ? studs.length : 0,
      totalComplaints: Array.isArray(comps) ? comps.length : 0,
      pendingComplaints: Array.isArray(comps) ? comps.filter(c=> (c.status||'').toLowerCase() === 'pending' || (c.status||'').toLowerCase() === 'open').length : 0,
      resolvedComplaints: Array.isArray(comps) ? comps.filter(c=> (c.status||'').toLowerCase() === 'resolved' || (c.status||'').toLowerCase() === 'closed').length : 0,
      totalOutpasses: Array.isArray(outs) ? outs.length : 0,
      pendingOutpasses: Array.isArray(outs) ? outs.filter(o=> (o.status||'').toLowerCase() === 'pending').length : 0,
      totalFeedbacks: Array.isArray(fbs) ? fbs.length : 0
    };
    return res.json({ success: true, stats });
  } catch (err) {
    console.error('Stats generation failed', err);
  }
  // fallback to in-memory
  return res.json({ success: true, stats: {
    totalStudents: students.length,
    totalComplaints: complaints.length,
    pendingComplaints: complaints.filter(c=> (c.status||'').toLowerCase() === 'pending' || (c.status||'').toLowerCase() === 'open').length,
    resolvedComplaints: complaints.filter(c=> (c.status||'').toLowerCase() === 'resolved' || (c.status||'').toLowerCase() === 'closed').length,
    totalOutpasses: outpasses.length,
    pendingOutpasses: outpasses.filter(o=> (o.status||'').toLowerCase() === 'pending').length,
    totalFeedbacks: 0
  }});
});

// ----------------------------------------------------
// Error Handler
// ----------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ----------------------------------------------------
// Initialize DB then Start Server
// ----------------------------------------------------
db.init()
  .then(() => console.log('📦 Database init finished, ready =', db.ready))
  .catch(err => console.warn('⚠️ Database init failed:', err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`🚀 SHMS API running at http://localhost:${PORT}`));
  });