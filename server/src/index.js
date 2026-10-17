/* Prime Care Hospital API.
   Doctors, managers, staff and patients sign in here; the server checks every password,
   hands out IDs and OP token numbers, and decides what each role may see and change.
   Password hashes never leave the server, and patients only ever receive their own records. */
'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const store = require('./db');
const { db, COLLS, counter, nextRev, currentRev, epoch, newEpoch } = store;

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const TZ = process.env.HOSPITAL_TZ || 'Asia/Kolkata';
const ORIGINS = (process.env.CORS_ORIGINS || 'https://localhost,http://localhost,capacitor://localhost').split(',').map(s => s.trim()).filter(Boolean);
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set'); process.exit(1); }
if (!JWT_SECRET || JWT_SECRET.length < 32) { console.error('JWT_SECRET must be set to at least 32 characters'); process.exit(1); }

/* ---------- Reference data (same lists as the app) ---------- */
const STAFF_ROLES = ['Nurse', 'Receptionist', 'Lab Technician', 'Pharmacist', 'Radiographer', 'Ward Assistant', 'Housekeeping', 'Accountant', 'Security', 'Other'];
const DEPARTMENTS = ['General Medicine', 'Emergency', 'Paediatrics', 'Gynaecology', 'Orthopaedics', 'Cardiology', 'Laboratory', 'Pharmacy', 'Radiology', 'Administration', 'Front Office', 'Other'];
const SHIFTS = ['Morning', 'Evening', 'Night', 'Rotational'];
const STAFF_STATUS = ['Active', 'On leave', 'Inactive'];
const GENDERS = ['Male', 'Female', 'Other'];
const VISIT_TYPES = ['New', 'Follow-up', 'Emergency'];
const PAY_MODES = ['Cash', 'UPI', 'Card', 'Free'];

/* ---------- Helpers ---------- */
class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };
// Only plain strings (or numbers) are accepted from the app, trimmed and capped, so no query operators get through
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' && isFinite(v) ? String(v).slice(0, max) : '');
const oneOf = (v, list, def = '') => (list.includes(v) ? v : def);
const digits = s => String(s || '').replace(/\D/g, '');
const last10 = s => digits(s).slice(-10);
const now = () => new Date().toISOString();
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00Z'));
const validPhone = v => { const d = digits(v); return d.length >= 10 && d.length <= 13; };
const validEmail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const validUsername = v => /^[a-z0-9._]{3,20}$/.test(v);
const pad = (n, w) => String(n).padStart(w, '0');
const need = (cond, field, message) => { if (!cond) fail(400, message, { field }); };

// Fields that never leave the server
const SAFE = { _id: 0, passwordHash: 0, pwv: 0, phone10: 0, 'login.passwordHash': 0, 'login.pwv': 0 };
const clean = doc => {
  if (!doc) return doc;
  const { _id, passwordHash, pwv, phone10, ...rest } = doc;
  if (rest.login) { const { passwordHash: h, pwv: v, ...login } = rest.login; rest.login = login; }
  return rest;
};

const hashPw = pw => bcrypt.hash(pw, 10);
let DUMMY_HASH;
// Compares against a dummy hash when there is no account, so a wrong username takes as long as a wrong password
const checkPw = (pw, hash) => bcrypt.compare(String(pw || ''), hash || DUMMY_HASH);
const needPassword = (v, field = 'password') => need(v.length >= 6 && v.length <= 64, field, v ? 'Use at least 6 characters' : 'Password is required');

/* ---------- Sessions ----------
   A token names the account and its password version, so changing or resetting a password
   signs that account out on every other phone. */
const sign = (kind, id, pwv = 0) => jwt.sign({ k: kind, sub: id, v: pwv }, JWT_SECRET, { expiresIn: '30d' });
const pwvOf = (kind, a) => (kind === 'staff' ? (a.login && a.login.pwv) || 0 : a.pwv || 0);

async function loadAccount(kind, id) {
  if (kind === 'admin') return db.admins.findOne({ id });
  if (kind === 'patient') return db.patients.findOne({ id });
  if (kind === 'staff') {
    const s = await db.staff.findOne({ id });
    return s && s.login && s.login.enabled && s.status !== 'Inactive' ? s : null;
  }
  return null;
}

async function auth(req, res, next) {
  try {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    if (!m) fail(401, 'Please sign in');
    let p;
    try { p = jwt.verify(m[1], JWT_SECRET); } catch (e) { fail(401, 'Your session has expired. Please sign in again.', { code: 'SESSION' }); }
    const acct = await loadAccount(p.k, p.sub);
    if (!acct || pwvOf(p.k, acct) !== (p.v || 0)) fail(401, 'Your session has ended. Please sign in again.', { code: 'SESSION' });
    req.kind = p.k;
    req.user = acct;
    // Sliding sessions: a token older than a day is replaced on the next response
    if (Date.now() / 1000 - p.iat > 86400) res.set('X-Session', sign(p.k, acct.id, pwvOf(p.k, acct)));
    next();
  } catch (e) { next(e); }
}
const isAdmin = req => req.kind === 'admin';
const isDoctor = req => req.kind === 'admin' && req.user.role === 'Doctor';
const isHospital = req => req.kind === 'admin' || req.kind === 'staff';
const allow = test => (req, res, next) => (test(req) ? next() : next(new HttpError(403, 'You do not have permission to do that')));

/* ---------- What each phone receives ----------
   Hospital users get every record (without secrets), sent as changes since the revision
   the phone already has. Patients get only their own account and visits, plus an anonymous
   view of today's queue for the "Now consulting" board. */
async function hospitalSync(since, phoneEpoch) {
  const ep = await epoch();
  const full = !(since > 0) || phoneEpoch !== ep;
  // A small overlap so a write that was still being saved during the last sync is not missed
  const q = full ? {} : { rev: { $gt: Math.max(0, since - 25) } };
  const rev = await currentRev();
  const out = { epoch: ep, rev, full, upserts: {}, removed: [] };
  await Promise.all(COLLS.map(async c => { out.upserts[c] = await db[c].find(q, { projection: SAFE }).toArray(); }));
  if (!full) out.removed = (await db.tombstones.find(q, { projection: { _id: 0, coll: 1, id: 1 } }).toArray());
  const t = today();
  const seq = await db.counters.findOne({ _id: 'token:' + t });
  out.tokenSeq = { [t]: seq ? seq.seq : 0 };
  return out;
}

async function patientSync(p) {
  const t = today();
  const own = await db.tokens.find({ $or: [{ patientId: p.id }, { phone10: p.phone10 }] }, { projection: SAFE }).toArray();
  const ownIds = new Set(own.map(x => x.id));
  // Other people's tokens today: number, status and doctor only
  const queue = (await db.tokens.find({ date: t }, { projection: { _id: 0, id: 1, seq: 1, date: 1, status: 1, doctorId: 1 } }).toArray())
    .filter(x => !ownIds.has(x.id)).map(x => ({ ...x, patient: {} }));
  const admins = await db.admins.find({}, { projection: { _id: 0, id: 1, name: 1, role: 1, title: 1 } }).toArray();
  const staffIds = [...new Set(own.flatMap(x => [x.issuedBy, x.acceptedBy, x.cancelledBy, x.updatedBy]).filter(Boolean))];
  const staff = await db.staff.find({ id: { $in: staffIds } }, { projection: { _id: 0, id: 1, name: 1, role: 1 } }).toArray();
  return { epoch: await epoch(), rev: 0, full: true, upserts: { admins, staff, patients: [clean(p)], tokens: [...own, ...queue] }, removed: [], tokenSeq: {} };
}

const sync = req => (req.kind === 'patient' ? patientSync(req.user) : hospitalSync(+req.get('x-since') || 0, req.get('x-epoch') || ''));
// Every change answers with the record it made plus the latest changes, so the phone needs one round trip
async function reply(req, res, body = {}) { res.json({ ok: true, ...body, sync: await sync(req) }); }

/* ---------- Writes (each one bumps the revision) ---------- */
async function insert(coll, doc) {
  doc.rev = await nextRev();
  await db[coll].insertOne(doc);
  return clean(doc);
}
async function update(coll, filter, set, unset) {
  const op = { $set: { ...set, rev: await nextRev() } };
  if (unset) op.$unset = unset;
  return clean(await db[coll].findOneAndUpdate(filter, op, { returnDocument: 'after' }));
}
async function remove(coll, id) {
  const r = await db[coll].deleteOne({ id });
  if (r.deletedCount) await db.tombstones.insertOne({ coll, id, rev: await nextRev() });
  return r.deletedCount;
}
const nextId = async kind => {
  const n = await counter(kind);
  const prefix = { admin: 'PCA-', staff: 'PCS-', patient: 'PCP-' }[kind];
  return prefix + pad(n, { admin: 2, patient: 5 }[kind] || 4);
};

async function usernameTaken(name, exceptId) {
  const [a, s] = await Promise.all([db.admins.findOne({ username: name }), db.staff.findOne({ 'login.username': name })]);
  return (a && a.id !== exceptId) || (s && s.id !== exceptId);
}

/* ---------- App ---------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: ORIGINS, allowedHeaders: ['Content-Type', 'Authorization', 'X-Since', 'X-Epoch'], exposedHeaders: ['X-Session'] }));
app.use(compression());
app.use(express.json({ limit: '100kb' }));
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Sign-in, registration and password resets are limited per IP to slow down password guessing
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });

app.get('/', (req, res) => res.json({ name: 'Prime Care API', ok: true }));
app.get('/api/health', (req, res) => res.json({ ok: true, time: now() }));
app.get('/api/status', wrap(async (req, res) => {
  res.json({ setupNeeded: (await db.admins.countDocuments({}, { limit: 1 })) === 0, today: today() });
}));

/* ----- Doctor / manager accounts ----- */
async function adminFromBody(b, req) {
  const v = {
    role: oneOf(b.role, ['Doctor', 'Manager'], 'Doctor'), name: str(b.name, 60), title: str(b.title, 60),
    phone: str(b.phone, 15), username: str(b.username, 20).toLowerCase(), password: str(b.password, 64),
  };
  need(v.name.length >= 2, 'name', v.name ? 'Name is too short' : 'Name is required');
  need(validPhone(v.phone), 'phone', 'Enter a valid 10-digit phone number');
  need(validUsername(v.username), 'username', 'Use 3–20 letters, numbers, dots or underscores');
  needPassword(v.password);
  if (await usernameTaken(v.username)) fail(409, 'This username is already taken', { field: 'username' });
  return {
    id: await nextId('admin'), role: v.role, name: v.name, title: v.title, phone: v.phone, username: v.username,
    passwordHash: await hashPw(v.password), pwv: 0, createdAt: now(), createdBy: req && req.user ? req.user.id : null,
  };
}

// First run: the very first doctor or manager creates their account
app.post('/api/setup', authLimit, wrap(async (req, res) => {
  if (await db.admins.countDocuments({}, { limit: 1 })) fail(409, 'Prime Care is already set up. Please sign in.', { code: 'SETUP_DONE' });
  // Only one phone can win the race to set up
  try { await db.meta.insertOne({ _id: 'setup', at: now() }); } catch (e) { fail(409, 'Prime Care is already set up. Please sign in.', { code: 'SETUP_DONE' }); }
  try {
    const a = await adminFromBody(req.body);
    const user = await insert('admins', a);
    res.json({ ok: true, token: sign('admin', a.id), kind: 'admin', user });
  } catch (e) { await db.meta.deleteOne({ _id: 'setup' }); throw e; }
}));

/* ----- Sign in ----- */
app.post('/api/login/hospital', authLimit, wrap(async (req, res) => {
  const role = oneOf(req.body.role, ['Doctor', 'Manager', 'Staff'], 'Doctor');
  const uname = str(req.body.username, 20).toLowerCase();
  const admin = await db.admins.findOne({ username: uname });
  const staff = !admin ? await db.staff.findOne({ 'login.username': uname }) : null;
  const hash = admin ? admin.passwordHash : staff && staff.login ? staff.login.passwordHash : null;
  const ok = await checkPw(req.body.password, hash);
  if (!ok || !(admin || staff)) fail(401, 'Incorrect username or password');
  const actual = admin ? admin.role : 'Staff';
  if (actual !== role) fail(403, `This account is registered as ${actual === 'Staff' ? 'Staff' : 'a ' + actual}. Switch to "${actual}" above.`, { code: 'ROLE', role: actual });
  if (staff && !staff.login.enabled) fail(403, 'App access for this staff account is turned off. Please contact a manager.');
  if (staff && staff.status === 'Inactive') fail(403, 'This staff account is inactive. Please contact a manager.');
  const kind = admin ? 'admin' : 'staff';
  const acct = admin || staff;
  res.json({ ok: true, token: sign(kind, acct.id, pwvOf(kind, acct)), kind, user: clean(acct) });
}));

// Patients sign in with their mobile number or Patient ID (PCP-00001)
async function findPatient(idOrPhone) {
  const v = str(idOrPhone, 20);
  if (/^pcp-?\d+$/i.test(v)) return db.patients.findOne({ id: 'PCP-' + pad(+v.replace(/\D/g, ''), 5) });
  return last10(v).length === 10 ? db.patients.findOne({ phone10: last10(v) }) : null;
}
app.post('/api/login/patient', authLimit, wrap(async (req, res) => {
  const p = await findPatient(req.body.id);
  const ok = await checkPw(req.body.password, p && p.passwordHash);
  if (!p) fail(404, 'No patient account found', { code: 'NO_ACCOUNT' });
  if (!ok) fail(401, 'Incorrect password. Try again or use "Forgot password?".');
  res.json({ ok: true, token: sign('patient', p.id, p.pwv || 0), kind: 'patient', user: clean(p) });
}));

app.post('/api/patients/register', authLimit, wrap(async (req, res) => {
  const b = req.body;
  const v = { name: str(b.name, 60), phone: str(b.phone, 15), gender: oneOf(b.gender, GENDERS), dob: str(b.dob, 10), email: str(b.email, 80), password: str(b.password, 64) };
  need(v.name.length >= 2, 'name', v.name ? 'Name is too short' : 'Name is required');
  need(validPhone(v.phone), 'phone', 'Enter a valid 10-digit phone number');
  need(v.gender, 'gender', 'Select your gender');
  need(isDate(v.dob) && v.dob <= today(), 'dob', v.dob ? 'Date cannot be in the future' : 'Enter your date of birth');
  need(validEmail(v.email), 'email', 'Enter a valid email address');
  needPassword(v.password);
  const ex = await db.patients.findOne({ phone10: last10(v.phone) });
  if (ex) fail(409, `This number is already registered (${ex.id}). Sign in instead.`, { field: 'phone' });
  const p = { id: await nextId('patient'), name: v.name, phone: v.phone, phone10: last10(v.phone), gender: v.gender, dob: v.dob, email: v.email, passwordHash: await hashPw(v.password), pwv: 0, createdAt: now() };
  try { await insert('patients', p); } catch (e) {
    if (e.code === 11000) fail(409, 'This number was just registered. Sign in instead.', { field: 'phone' });
    throw e;
  }
  res.json({ ok: true, token: sign('patient', p.id), kind: 'patient', user: clean(p) });
}));

/* ----- Forgot password (no SMS yet: identity is checked against details on file) ----- */
const NO_MATCH = "Those details don't match our records.";
app.post('/api/reset/hospital', authLimit, wrap(async (req, res) => {
  const u = str(req.body.username, 20).toLowerCase(), ph = last10(req.body.phone), pw = str(req.body.password, 64);
  needPassword(pw);
  if (ph.length !== 10) fail(400, NO_MATCH);
  const a = await db.admins.findOne({ username: u });
  if (a && last10(a.phone) === ph) {
    await update('admins', { id: a.id }, { passwordHash: await hashPw(pw), pwv: (a.pwv || 0) + 1 });
    return res.json({ ok: true });
  }
  const s = await db.staff.findOne({ 'login.username': u });
  if (s && last10(s.phone) === ph) {
    await update('staff', { id: s.id }, { 'login.passwordHash': await hashPw(pw), 'login.pwv': (s.login.pwv || 0) + 1 });
    return res.json({ ok: true });
  }
  fail(400, NO_MATCH);
}));
app.post('/api/reset/patient', authLimit, wrap(async (req, res) => {
  const pw = str(req.body.password, 64);
  needPassword(pw);
  const p = await findPatient(req.body.id);
  if (!p || p.dob !== str(req.body.dob, 10)) fail(400, NO_MATCH);
  await update('patients', { id: p.id }, { passwordHash: await hashPw(pw), pwv: (p.pwv || 0) + 1 });
  res.json({ ok: true });
}));

/* ----- Everything below needs a signed-in account ----- */
const api = express.Router();
api.use(auth);

api.get('/state', wrap(async (req, res) => res.json({ ok: true, kind: req.kind, user: clean(req.user), sync: await sync(req) })));

// Change own password (signs out this account's other phones; this phone gets a new session)
api.post('/password', wrap(async (req, res) => {
  const cur = req.kind === 'staff' ? req.user.login.passwordHash : req.user.passwordHash;
  if (!(await checkPw(req.body.current, cur))) fail(400, 'Current password is incorrect', { field: 'current' });
  const pw = str(req.body.password, 64);
  needPassword(pw);
  const hash = await hashPw(pw);
  const coll = { admin: 'admins', staff: 'staff', patient: 'patients' }[req.kind];
  const v = pwvOf(req.kind, req.user) + 1;
  await update(coll, { id: req.user.id }, req.kind === 'staff' ? { 'login.passwordHash': hash, 'login.pwv': v } : { passwordHash: hash, pwv: v });
  res.json({ ok: true, token: sign(req.kind, req.user.id, v) });
}));

/* ----- Doctor and manager accounts ----- */
api.post('/admins', allow(isAdmin), wrap(async (req, res) => {
  const a = await adminFromBody(req.body, req);
  await reply(req, res, { record: await insert('admins', a) });
}));
api.delete('/admins/:id', allow(isAdmin), wrap(async (req, res) => {
  if (req.params.id === req.user.id) fail(400, 'You cannot remove your own account');
  if (!(await remove('admins', str(req.params.id, 10)))) fail(404, 'That account no longer exists');
  await reply(req, res);
}));

/* ----- Staff (doctors and managers only) ----- */
async function staffFromBody(b, existing) {
  const v = {
    name: str(b.name, 60), gender: oneOf(b.gender, GENDERS, 'Female'), phone: str(b.phone, 15), email: str(b.email, 80),
    address: str(b.address, 200), role: oneOf(b.role, STAFF_ROLES), department: oneOf(b.department, DEPARTMENTS),
    joinDate: isDate(str(b.joinDate, 10)) ? str(b.joinDate, 10) : '', qualification: str(b.qualification, 60),
    shift: oneOf(b.shift, SHIFTS, 'Morning'), status: oneOf(b.status, STAFF_STATUS, 'Active'),
  };
  need(v.name.length >= 2, 'name', v.name ? 'Name is too short' : 'Name is required');
  need(validPhone(v.phone), 'phone', 'Enter a valid 10-digit phone number');
  need(validEmail(v.email), 'email', 'Enter a valid email address');
  need(v.role, 'role', 'Select a staff role');
  need(!v.joinDate || v.joinDate <= today(), 'joinDate', 'Date cannot be in the future');
  const dup = await db.staff.findOne({ phone10: last10(v.phone), id: { $ne: existing ? existing.id : '' } });
  if (dup) fail(409, `Already registered to ${dup.name} (${dup.id})`, { field: 'phone' });
  v.phone10 = last10(v.phone);
  // App sign-in lives under staff.login; the password is stored only as a hash
  const old = existing && existing.login;
  if (b.loginEnabled === 'Yes') {
    const username = str(b.username, 20).toLowerCase(), password = str(b.password, 64);
    need(validUsername(username), 'username', username ? 'Use 3–20 letters, numbers, dots or underscores' : 'Choose a username for signing in');
    if (await usernameTaken(username, existing && existing.id)) fail(409, 'This username is already taken', { field: 'username' });
    if (!password && !(old && old.passwordHash)) fail(400, 'Set a password for signing in', { field: 'password' });
    if (password) needPassword(password);
    v.login = { enabled: true, username, passwordHash: password ? await hashPw(password) : old.passwordHash, pwv: old ? (old.pwv || 0) + (password ? 1 : 0) : 0 };
  } else {
    v.login = old ? { ...old, enabled: false } : null;
  }
  return v;
}
api.post('/staff', allow(isAdmin), wrap(async (req, res) => {
  const v = await staffFromBody(req.body);
  await reply(req, res, { record: await insert('staff', { id: await nextId('staff'), ...v, createdAt: now(), createdBy: req.user.id }) });
}));
api.put('/staff/:id', allow(isAdmin), wrap(async (req, res) => {
  const ex = await db.staff.findOne({ id: str(req.params.id, 10) });
  if (!ex) fail(404, 'This staff record no longer exists');
  const v = await staffFromBody(req.body, ex);
  await reply(req, res, { record: await update('staff', { id: ex.id }, { ...v, updatedAt: now(), updatedBy: req.user.id }) });
}));
api.delete('/staff/:id', allow(isAdmin), wrap(async (req, res) => {
  if (!(await remove('staff', str(req.params.id, 10)))) fail(404, 'This staff record no longer exists');
  await reply(req, res);
}));

/* ----- OP tokens -----
   Numbers are ddmmyy-NNN: the date plus that day's running count, handed out by the server
   so two phones can never issue the same number. A mobile number holds one active token per day. */
const tokenNo = (date, seq) => { const [y, m, d] = date.split('-'); return `${d}${m}${y.slice(2)}-${pad(seq, 3)}`; };
const activeTokenFor = (phone10, date, exceptId) => db.tokens.findOne({ phone10, date, status: { $ne: 'Cancelled' }, id: { $ne: exceptId || '' } });
async function checkDoctor(id) {
  if (!id) return '';
  const d = await db.admins.findOne({ id, role: 'Doctor' });
  if (!d) fail(400, 'Choose a doctor from the list', { field: 'doctorId' });
  return id;
}
async function deskFields(b) {
  const v = {
    patient: { name: str(b.name, 60), age: str(b.age, 3), gender: oneOf(b.gender, GENDERS), phone: str(b.phone, 15) },
    doctorId: await checkDoctor(str(b.doctorId, 10)), visitType: oneOf(b.visitType, VISIT_TYPES, 'New'), complaint: str(b.complaint, 300),
    vitals: { weight: str(b.weight, 5), temp: str(b.temp, 5), bp: str(b.bp, 9), pulse: str(b.pulse, 3) },
    fee: str(b.fee, 6), payMode: oneOf(b.payMode, PAY_MODES, 'Cash'),
  };
  const p = v.patient;
  need(p.name.length >= 2, 'name', p.name ? 'Name is too short' : 'Name is required');
  need(p.age !== '' && +p.age >= 0 && +p.age <= 120, 'age', p.age === '' ? 'Enter the age' : 'Enter an age between 0 and 120');
  need(validPhone(p.phone), 'phone', 'Enter a valid 10-digit phone number');
  need(p.gender, 'gender', 'Select a gender');
  need(!v.vitals.bp || /^\d{2,3}\/\d{2,3}$/.test(v.vitals.bp), 'bp', 'Use the format 120/80');
  need(v.fee === '' || +v.fee >= 0, 'fee', 'Fee cannot be negative');
  v.phone10 = last10(p.phone);
  // Link to the patient's app account so it shows in their visit history
  const acct = await db.patients.findOne({ phone10: v.phone10 });
  if (acct) v.patientId = acct.id;
  return v;
}
const clashMsg = t => `Token ${t.id} is already booked for this number today (${t.patient.name})`;

async function newToken(fields) {
  const date = today();
  const seq = await counter('token:' + date);
  return insert('tokens', { id: tokenNo(date, seq), seq, date, ...fields });
}

api.post('/tokens', allow(isHospital), wrap(async (req, res) => {
  const v = await deskFields(req.body);
  const clash = await activeTokenFor(v.phone10, today());
  if (clash) fail(409, clashMsg(clash), { field: 'phone' });
  const t = await newToken({ ...v, patientId: v.patientId || '', status: 'Waiting', issuedAt: now(), issuedBy: req.user.id });
  await reply(req, res, { record: t });
}));
api.put('/tokens/:id', allow(isHospital), wrap(async (req, res) => {
  const ex = await db.tokens.findOne({ id: str(req.params.id, 12) });
  if (!ex) fail(404, 'This token no longer exists');
  if (ex.status !== 'Waiting') fail(409, 'Only tokens still waiting in the queue can be edited', { code: 'STALE' });
  const v = await deskFields(req.body);
  const clash = await activeTokenFor(v.phone10, ex.date, ex.id);
  if (clash) fail(409, clashMsg(clash), { field: 'phone' });
  if (!v.patientId) v.patientId = ex.patientId || '';
  const t = await update('tokens', { id: ex.id, status: 'Waiting' }, { ...v, updatedAt: now(), updatedBy: req.user.id });
  if (!t) fail(409, 'This token was changed on another phone. Pull down to refresh.', { code: 'STALE' });
  await reply(req, res, { record: t });
}));

// Patients book their own token, for today only, one per day (even if they cancel it)
api.post('/tokens/book', allow(req => req.kind === 'patient'), wrap(async (req, res) => {
  const p = req.user, date = today();
  const mine = await db.tokens.findOne({ date, $or: [{ patientId: p.id, source: 'patient' }, { phone10: p.phone10, status: { $ne: 'Cancelled' } }] });
  if (mine) fail(409, mine.status === 'Cancelled' ? 'You can book only one token per day. Please try again tomorrow.' : `Token ${mine.id} is already booked for your number today`);
  const complaint = str(req.body.complaint, 300);
  need(complaint, 'complaint', 'Tell the doctor briefly why you are visiting');
  const dob = new Date(p.dob + 'T00:00:00Z'), n = new Date();
  let age = n.getUTCFullYear() - dob.getUTCFullYear();
  if (n.getUTCMonth() < dob.getUTCMonth() || (n.getUTCMonth() === dob.getUTCMonth() && n.getUTCDate() < dob.getUTCDate())) age--;
  const t = await newToken({
    patient: { name: p.name, age: isNaN(age) ? '' : String(age), gender: p.gender, phone: p.phone }, phone10: p.phone10,
    patientId: p.id, source: 'patient', doctorId: await checkDoctor(str(req.body.doctorId, 10)),
    visitType: oneOf(req.body.visitType, ['New', 'Follow-up'], 'New'), complaint, vitals: {}, fee: '', payMode: '',
    // App bookings wait for the hospital to accept them; the number is held meanwhile
    status: 'Pending', issuedAt: now(), issuedBy: p.id,
  });
  await reply(req, res, { record: t });
}));

// Status changes. Each one only applies if the token is still in the status the phone saw,
// so two people acting on the same token at once cannot overwrite each other.
const ownToken = (req, t) => t.patientId === req.user.id || t.phone10 === req.user.phone10;
const ACTIONS = {
  start: { from: ['Waiting'], who: isDoctor, apply: (req, t) => ({ set: { status: 'In consultation', calledAt: now(), consultedBy: req.user.id, doctorId: t.doctorId || req.user.id } }) },
  back: { from: ['In consultation'], who: isDoctor, apply: req => ({ set: { status: 'Waiting', doctorNotes: str(req.body.notes, 1000) }, unset: { calledAt: '' } }) },
  complete: { from: ['In consultation'], who: isDoctor, apply: req => ({ set: { status: 'Completed', completedAt: now(), doctorNotes: str(req.body.notes, 1000) } }) },
  notes: { from: ['In consultation', 'Completed'], who: isDoctor, apply: req => ({ set: { doctorNotes: str(req.body.notes, 1000) } }) },
  accept: { from: ['Pending'], who: isHospital, apply: req => ({ set: { status: 'Waiting', acceptedAt: now(), acceptedBy: req.user.id } }) },
  reject: { from: ['Pending'], who: isHospital, apply: req => ({ set: { status: 'Cancelled', rejected: true, cancelledAt: now(), cancelledBy: req.user.id, cancelReason: str(req.body.reason, 120) || 'Not accepted by the hospital' } }) },
  cancel: {
    from: ['Waiting', 'Pending'],
    // Front desk and managers cancel waiting tokens; patients cancel their own today
    who: (req, t) => (req.kind === 'patient' ? ownToken(req, t) && t.date === today() : isHospital(req) && !isDoctor(req) && t.status === 'Waiting'),
    apply: req => ({ set: { status: 'Cancelled', cancelledAt: now(), cancelledBy: req.user.id } }),
  },
};
api.post('/tokens/:id/:action', wrap(async (req, res) => {
  const act = ACTIONS[req.params.action];
  if (!act) fail(404, 'Unknown action');
  const t = await db.tokens.findOne({ id: str(req.params.id, 12) });
  if (!t) fail(404, 'This token no longer exists');
  if (!act.who(req, t)) fail(403, 'You do not have permission to do that');
  if (!act.from.includes(t.status)) fail(409, `This token is now "${t.status}". Pull down to refresh.`, { code: 'STALE' });
  const { set, unset } = act.apply(req, t);
  const out = await update('tokens', { id: t.id, status: t.status }, { ...set, updatedAt: now() }, unset);
  if (!out) fail(409, 'This token was changed on another phone. Pull down to refresh.', { code: 'STALE' });
  await reply(req, res, { record: out });
}));

/* ----- Backup and erase (doctors and managers) ----- */
api.get('/export', allow(isAdmin), wrap(async (req, res) => {
  const out = { app: 'Prime Care HMS', exportedAt: now(), exportedBy: req.user.id };
  for (const c of COLLS) out[c] = await db[c].find({}, { projection: { ...SAFE, rev: 0 } }).sort({ id: 1 }).toArray();
  res.json(out);
}));
api.post('/erase', allow(isAdmin), wrap(async (req, res) => {
  if (!(await checkPw(req.body.password, req.user.passwordHash))) fail(400, 'Incorrect password. Nothing was erased.', { field: 'password' });
  await Promise.all([...COLLS, 'members', 'tombstones', 'counters'].map(c => db[c].deleteMany({})));
  await db.meta.deleteOne({ _id: 'setup' });
  await newEpoch();
  res.json({ ok: true });
}));

app.use('/api', api);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// Errors go back as { error, field?, code? } so the app can show them next to the right field
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    const { status, message, stack, ...extra } = err;
    return res.status(status).json({ error: message, ...extra });
  }
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

(async () => {
  DUMMY_HASH = await hashPw('not-a-real-password');
  await store.connect(process.env.MONGODB_URI, process.env.MONGODB_DB || 'primecare');
  app.listen(PORT, () => console.log(`Prime Care API listening on ${PORT}`));
})().catch(e => { console.error('Could not start:', e); process.exit(1); });
