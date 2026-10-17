/* Prime Care Hospital Management System
   App shell, server connection, Doctor/Manager accounts, Staff registration and OP tokens. */
'use strict';

const Cap = window.Capacitor;
const NATIVE = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const Plug = (Cap && Cap.Plugins) || {};
const APP_VERSION = '1.8.0';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));

// Calls a Capacitor plugin method and never throws (web fallbacks may be unimplemented)
function call(plugin, method, args) {
  try {
    const p = Plug[plugin];
    if (!p) return Promise.resolve(undefined);
    return Promise.resolve(p[method](args)).catch(() => undefined);
  } catch (e) { return Promise.resolve(undefined); }
}
const buzz = kind => {
  if (typeof Sound !== 'undefined') Sound.play(kind === 'error' ? 'error' : kind === 'success' ? 'success' : 'tap');
  if (!NATIVE) return;
  if (kind === 'error') call('Haptics', 'notification', { type: 'ERROR' });
  else if (kind === 'success') call('Haptics', 'notification', { type: 'SUCCESS' });
  else call('Haptics', 'impact', { style: 'LIGHT' });
};

/* ---------- Icons (Lucide-style stroke paths) ---------- */
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  idCard: '<rect width="20" height="16" x="2" y="4" rx="2"/><circle cx="8" cy="11" r="2.2"/><path d="M5 16.5c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 9h5M14 13h4"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  settings: '<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  stetho: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 12 0V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 12 0v-4"/><circle cx="20" cy="10" r="2"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  grad: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  sos: '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>',
  note: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  play: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
  thermo: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  barChart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  donut: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M21 12h-5"/>',
  stackBar: '<rect width="18" height="6" x="3" y="9" rx="1.5"/><path d="M9 9v6M14 9v6"/>',
  fingerprint: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .13-5.35 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  whatsapp: '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  device: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
};
const I = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- Brand: Orbit Cross mark and horizontal logo ----------
   A teal-to-blue ring, open at the top right where an amber dot sits, around a green medical cross,
   drawn on a 100-unit grid. The ring and dot sit in their own group so the launch animation can spin them.
   The gradient is defined here for standalone use (PDF logo) and again at the top of index.html. */
const CIRCLE = `
  <defs><linearGradient id="pcRing" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0891b2"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
  <g class="ring">
    <path d="M86.25 33.1A40 40 0 1 1 66.9 13.75" fill="none" stroke="url(#pcRing)" stroke-width="9" stroke-linecap="round"/>
    <circle cx="78.3" cy="21.7" r="5.5" fill="#f59e0b"/>
  </g>
  <path class="cross" d="M44 29h12a2 2 0 0 1 2 2v11h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H58v11a2 2 0 0 1-2 2H44a2 2 0 0 1-2-2V58H31a2 2 0 0 1-2-2V44a2 2 0 0 1 2-2h11V31a2 2 0 0 1 2-2z" fill="#10b981"/>`;
const MARK = `<svg viewBox="4 4 92 92" aria-hidden="true">${CIRCLE}</svg>`;
const LOGO_H = `<svg class="logo-h" viewBox="120 120 1420 320" role="img" aria-label="Prime Care Hospital">
  <g transform="translate(290 280) scale(3.39) translate(-50 -50)">${CIRCLE}</g>
  <line x1="560" y1="150" x2="560" y2="410" stroke="#e2e8f0" stroke-width="6"/>
  <text x="620" y="290" font-family="Segoe UI, Roboto, sans-serif" font-size="150" font-weight="800" textLength="880" lengthAdjust="spacingAndGlyphs"><tspan class="wm-prime" fill="#1e3a8a">PRIME</tspan> <tspan fill="#10b981">CARE</tspan></text>
  <text x="626" y="370" font-family="Segoe UI, Roboto, sans-serif" font-size="50" font-weight="600" fill="#64748b" textLength="560" lengthAdjust="spacing">HOSPITAL</text>
  <circle class="conn-dot" cx="1463" cy="352" r="20"/>
</svg>`;
// The dot under the E of CARE (on the HOSPITAL line) shows the server connection: green connected, red not (it pulses while the first attempt runs).
// Printed logos (PDF reports and token slips) leave it out.
const LOGO_PRINT = LOGO_H.replace(/\s*<circle class="conn-dot"[^>]*\/>/, '');
const Conn = {
  state: null,
  set(on) {
    if (this.state === on) return;
    this.state = on;
    document.documentElement.dataset.conn = on ? 'on' : 'off';
  },
};

/* ---------- Reference data ---------- */
const STAFF_ROLES = ['Nurse', 'Receptionist', 'Lab Technician', 'Pharmacist', 'Radiographer', 'Ward Assistant', 'Housekeeping', 'Accountant', 'Security', 'Other'];
const DEPARTMENTS = ['General Medicine', 'Emergency', 'Paediatrics', 'Gynaecology', 'Orthopaedics', 'Cardiology', 'Laboratory', 'Pharmacy', 'Radiology', 'Administration', 'Front Office', 'Other'];
const SHIFTS = ['Morning', 'Evening', 'Night', 'Rotational'];
const STAFF_STATUS = ['Active', 'On leave', 'Inactive'];
const GENDERS = ['Male', 'Female', 'Other'];
const STATUS_STYLE = { Active: ['b-green', '#10b981'], 'On leave': ['b-amber', '#f59e0b'], Inactive: ['b-grey', '#94a3b8'] };

/* ---------- Server connection ----------
   All data lives on the Prime Care server (an API on Render, backed by MongoDB Atlas).
   The phone keeps a copy of what the signed-in person may see in Store.db, refreshes it
   every few seconds, and sends every change to the server. The server checks the change,
   saves it, and answers with the saved record plus anything else that changed meanwhile. */
const API_URL = ((window.PC_CONFIG && window.PC_CONFIG.apiUrl) || '').replace(/\/+$/, '');
class ApiError extends Error {
  constructor(message, status = 0, extra = {}) { super(message); Object.assign(this, extra); this.status = status; }
}
const OFFLINE_MSG = 'No internet connection. Check your connection and try again.';
const Api = {
  token: null,
  async request(method, path, body, { timeout = 30000 } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    // Ask only for what changed since the copy this phone already has
    if (Store.rev) { headers['X-Since'] = String(Store.rev); headers['X-Epoch'] = Store.epoch; }
    let res;
    try {
      res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
    } catch (e) {
      Conn.set(false);
      throw new ApiError(e.name === 'AbortError' ? 'The server is taking too long to answer. Please try again.' : OFFLINE_MSG, 0, { offline: true });
    } finally {
      clearTimeout(timer);
    }
    // Any answer from Prime Care counts as connected; Render's own "service unavailable" pages do not
    Conn.set(!(res.status >= 502 && res.status <= 504));
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty or non-JSON body */ }
    const renewed = res.headers.get('X-Session');
    if (renewed && res.ok) Session.renew(renewed);
    if (!res.ok) {
      const err = new ApiError(data.error || `The server could not do that (error ${res.status}).`, res.status, data);
      if (res.status === 401 && data.code === 'SESSION' && S.user) sessionEnded(err.message);
      throw err;
    }
    if (data.sync) data.changed = Store.apply(data.sync);
    return data;
  },
  get(path, o) { return this.request('GET', path, undefined, o); },
  post(path, body, o) { return this.request('POST', path, body || {}, o); },
  put(path, body) { return this.request('PUT', path, body || {}); },
  del(path) { return this.request('DELETE', path); },
};

const COLLS = ['doctors', 'staff', 'patients', 'tokens'];
const Store = {
  db: null,
  rev: 0,
  epoch: '',
  setupNeeded: false,
  syncedAt: null,
  blank() { return { doctors: [], staff: [], patients: [], tokens: [], tokenSeq: {} }; },
  reset() { this.db = this.blank(); this.rev = 0; this.epoch = ''; this.syncedAt = null; },
  // Merges an answer from the server into the local copy; returns true when anything changed
  apply(s) {
    const before = s.full ? JSON.stringify(this.db) : '';
    if (s.full || s.epoch !== this.epoch) this.db = this.blank();
    let changed = false;
    COLLS.forEach(c => {
      const list = (s.upserts && s.upserts[c]) || [];
      if (!list.length) return;
      const byId = new Map(this.db[c].map(r => [r.id, r]));
      list.forEach(r => { const old = byId.get(r.id); if (!old || old.rev !== r.rev) changed = true; byId.set(r.id, r); });
      this.db[c] = [...byId.values()];
    });
    (s.removed || []).forEach(({ coll, id }) => {
      if (!this.db[coll]) return;
      const n = this.db[coll].length;
      this.db[coll] = this.db[coll].filter(r => r.id !== id);
      if (this.db[coll].length !== n) changed = true;
    });
    this.db.tokenSeq = { ...this.db.tokenSeq, ...(s.tokenSeq || {}) };
    this.epoch = s.epoch || '';
    this.rev = s.rev || 0;
    this.syncedAt = new Date().toISOString();
    // Keep the signed-in person pointing at their latest record
    if (S.user) {
      const me = this.db[{ admin: 'doctors', staff: 'staff', patient: 'patients' }[S.kind]].find(x => x.id === S.user.id);
      if (me) S.user = me;
      this.saveCache();
    }
    return s.full ? JSON.stringify(this.db) !== before : changed;
  },
  // Whether the hospital still needs its first doctor/manager account (remembered for the next launch)
  async status(timeout = 75000) {
    const r = await Api.get('/api/status', { timeout });
    this.setupNeeded = !!r.setupNeeded;
    call('Preferences', 'set', { key: 'setupNeeded', value: this.setupNeeded ? '1' : '0' });
    return r;
  },
  // Loads (or refreshes) the signed-in person's data
  load(timeout = 75000) { return Api.get('/api/state', { timeout }); },

  /* A copy of the signed-in person's data in the app's private storage, so the app opens straight
     away on the next launch and shows it until the server answers. Removed on sign-out. */
  CACHE: 'primecare/cache.json',
  cacheTimer: null,
  saveCache() {
    clearTimeout(this.cacheTimer);
    this.cacheTimer = setTimeout(() => {
      if (!S.user) return;
      const data = JSON.stringify({ kind: S.kind, user: S.user, db: this.db, rev: this.rev, epoch: this.epoch, syncedAt: this.syncedAt });
      call('Filesystem', 'writeFile', { path: this.CACHE, directory: 'DATA', encoding: 'utf8', data, recursive: true });
    }, 1500);
  },
  async readCache() {
    // Never hold up opening the app on storage: no answer within 2 seconds counts as no copy
    const r = await Promise.race([call('Filesystem', 'readFile', { path: this.CACHE, directory: 'DATA', encoding: 'utf8' }), wait(2000)]);
    try { return r && r.data ? JSON.parse(r.data) : null; } catch (e) { return null; }
  },
  clearCache() {
    clearTimeout(this.cacheTimer);
    return call('Filesystem', 'deleteFile', { path: this.CACHE, directory: 'DATA' });
  },
};
Store.reset();

/* The coloured line at the top of the screen that confirms a saved change */
function dbLine(fx) {
  if (typeof Sound !== 'undefined') Sound.play(fx);
  const el = $('#dbline');
  if (!el) return;
  el.className = '';
  void el.offsetWidth;
  el.className = `run ${fx}`;
}

/* The sign-in token from the server, kept in Preferences so the person stays signed in */
const Session = {
  async get() {
    const r = await call('Preferences', 'get', { key: 'auth' });
    try { return r && r.value ? JSON.parse(r.value) : null; } catch (e) { return null; }
  },
  async set(token, kind, id) {
    Api.token = token || null;
    if (token) await call('Preferences', 'set', { key: 'auth', value: JSON.stringify({ token, kind, id }) });
    else await call('Preferences', 'remove', { key: 'auth' });
  },
  // The server sends a fresh token now and then so active sessions do not expire
  renew(token) {
    if (!S.user || token === Api.token) return;
    this.set(token, S.kind, S.user.id);
    if (typeof Bio !== 'undefined' && Bio.enabledFor(S.kind, S.user.id)) Bio.remember(S.kind, S.user, token);
  },
};

// Signs in with an answer from the server ({ token, kind, user }) and loads the person's data
async function startSession(r) {
  Store.reset();
  await Session.set(r.token, r.kind, r.user.id);
  S.user = r.user;
  S.kind = r.kind;
  S.tab = r.kind === 'patient' ? 'phome' : 'home';
  S.tokenDate = today();
  try { await Store.load(); } catch (e) { await endSession(); throw e; }
  Live.start();
}
// Clears the signed-in person and their data from this phone
async function endSession() {
  await Store.clearCache();
  S.user = null;
  S.kind = null;
  S.tab = 'home';
  S.staffQ = S.tokenQ = '';
  S.tokenDate = null;
  Store.reset();
  await Session.set(null);
}
// The server no longer accepts this session (password changed, account removed or turned off)
let endingSession = false;
async function sessionEnded(msg) {
  if (endingSession) return;
  endingSession = true;
  while (sheets.length) sheets[sheets.length - 1].close();
  await endSession();
  toast(msg, 'error');
  endingSession = false;
  renderLanding();
}

/* Shows a server error next to its form field when it names one, otherwise as a toast */
function showError(e, form) {
  buzz('error');
  if (e && e.status === 401 && e.code === 'SESSION') return;
  if (form && e && e.field && form.querySelector(`[name="${e.field}"]`)) {
    setErr(form, e.field, e.message);
    const f = form.querySelector(`[name="${e.field}"]`).closest('.field');
    if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!(e instanceof ApiError)) console.error(e);
  toast((e && e.message) || 'Something went wrong', 'error');
}
// Runs a server call with the button showing a spinner; returns undefined if it failed
async function attempt(btn, fn, form) {
  if (btn) busy(btn, true);
  try { return await fn(); } catch (e) { showError(e, form); return undefined; } finally { if (btn) busy(btn, false); }
}

/* Keeps the screen up to date with changes made on other phones, and keeps checking the
   connection (which colours the dot in the logo) whether or not anyone is signed in */
const Live = {
  timer: null,
  busy: false,
  start() { this.stop(); this.timer = setInterval(() => this.tick(), 15000); },
  stop() { clearInterval(this.timer); this.timer = null; },
  async tick() {
    if (this.busy || document.hidden) return;
    this.busy = true;
    try {
      if (!S.user) {
        await Store.status(20000);
        syncAuthScreen();
      } else {
        const r = await Store.load(20000);
        // Redraw only when something changed, and never while the person is typing in a search box
        const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#page input');
        if (r.changed && !typing) refresh(true);
      }
    } catch (e) { /* not connected for now: the dot is red, and the next tick tries again */ }
    this.busy = false;
  },
};
document.addEventListener('visibilitychange', () => { if (!document.hidden) Live.tick(); });

/* ---------- Formatting helpers ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v.length === 10 ? v + 'T00:00:00' : v);
  return isNaN(d) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function age(dob) {
  if (!dob) return null;
  const b = new Date(dob + 'T00:00:00'), n = new Date();
  if (isNaN(b)) return null;
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
const initials = name => (name || '?').replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
const colorIdx = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 5; };
const avatar = (name, size = '') => `<div class="av ${size} c${colorIdx(name)}">${esc(initials(name))}</div>`;
const digits = s => String(s || '').replace(/\D/g, '');
const displayName = a => (a.role === 'Doctor' && !/^dr\.?\s/i.test(a.name) ? 'Dr. ' : '') + a.name;
const personName = id => {
  const a = Store.db.doctors.find(x => x.id === id) || Store.db.staff.find(x => x.id === id) || Store.db.patients.find(x => x.id === id);
  return a ? displayName(a) : 'a removed account';
};
// Who is signed in: S.kind is 'admin' (Doctor/Manager) or 'staff'
const isStaff = () => S.kind === 'staff';
const isPatient = () => S.kind === 'patient';
// One active OP token per mobile number per day, whoever books it
const activeTokenFor = (phone, date, exceptId) => Store.db.tokens.find(t => t.date === date && t.status !== 'Cancelled' && t.id !== exceptId && digits(t.patient.phone).slice(-10) === digits(phone).slice(-10));
// A patient's booking for today, in any status (patients get one booking per day, even if they cancel)
const patientTokenToday = p => Store.db.tokens.find(t => t.date === today() && (t.patientId === p.id || digits(t.patient.phone).slice(-10) === digits(p.phone).slice(-10)) && (t.source === 'patient' || t.status !== 'Cancelled'));
const patientByPhone = phone => Store.db.patients.find(p => digits(p.phone).slice(-10) === digits(phone).slice(-10));
const isDoctor = () => S.kind === 'admin' && S.user.role === 'Doctor';
// Store.db.doctors holds doctors and managers; this picks out the doctors only
const doctors = () => Store.db.doctors.filter(a => a.role === 'Doctor');
const usernameTaken = (name, exceptId) => {
  const n = name.toLowerCase();
  return Store.db.doctors.some(a => a.username === n && a.id !== exceptId) ||
    Store.db.staff.some(s => s.login && s.login.username === n && s.id !== exceptId);
};
const userHandle = u => (u.login ? u.login.username : u.username);
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

/* ---------- UI primitives: toasts, ripple, sheets, dialogs ---------- */
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${I(type === 'error' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.btn, .card, .tab, .row, .kpi, .qa-tile, .quick a, .quick button, .icon-btn, .fab');
  if (!el) return;
  const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height);
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  el.appendChild(s);
  setTimeout(() => s.remove(), 600);
});

const sheets = [];
function openSheet({ html, full = false, dialog = false, onMount, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = `sheet-wrap${dialog ? ' dialog' : ''}`;
  wrap.innerHTML = `<div class="scrim"></div><div class="sheet${full ? ' full' : ''}" role="dialog" aria-modal="true">${full || dialog ? '' : '<div class="grab"></div>'}${html}</div>`;
  $('#sheets').appendChild(wrap);
  const api = { wrap, el: $('.sheet', wrap), onClose };
  api.close = () => closeSheet(api);
  $('.scrim', wrap).onclick = api.close;
  $$('[data-close]', wrap).forEach(b => { b.onclick = api.close; });
  $$('.eye', wrap).forEach(bindEye);
  sheets.push(api);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  if (onMount) onMount(api.el, api);
  return api;
}
function closeSheet(api) {
  const i = sheets.indexOf(api);
  if (i < 0) return;
  sheets.splice(i, 1);
  api.wrap.classList.remove('open');
  setTimeout(() => api.wrap.remove(), 300);
  if (api.onClose) api.onClose();
}

function confirmDialog({ title, message, ok = 'Confirm', danger = false, icon = 'alert' }) {
  return new Promise(resolve => {
    let answered = false;
    const s = openSheet({
      dialog: true,
      html: `<div class="ic ${danger ? 'red' : 'blue'}">${I(icon)}</div><h2>${esc(title)}</h2><p>${esc(message)}</p>
        <div class="acts"><button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="dlgOk">${esc(ok)}</button></div>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    $('#dlgOk', s.el).onclick = () => { answered = true; resolve(true); s.close(); };
  });
}

function bindEye(b) {
  b.onclick = () => {
    const input = b.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    b.innerHTML = I(input.type === 'password' ? 'eye' : 'eyeOff');
  };
}

function busy(btn, on) {
  if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>'; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.label || btn.innerHTML; btn.disabled = false; }
}

/* ---------- Form builders ---------- */
const F = {
  text(name, label, o = {}) {
    const pw = o.type === 'password';
    return `<label class="field"><span class="lbl">${label}${o.req ? ' <i>*</i>' : ''}</span>
      <div class="ctl">${o.icon ? I(o.icon) : ''}<input name="${name}" type="${o.type || 'text'}" value="${esc(o.value)}" placeholder="${esc(o.ph || '')}"
        ${o.mode ? `inputmode="${o.mode}"` : ''} ${o.max ? `maxlength="${o.max}"` : ''} ${o.auto ? `autocomplete="${o.auto}"` : 'autocomplete="off"'} ${o.attrs || ''}>
        ${pw ? `<button type="button" class="eye" tabindex="-1" aria-label="Show password">${I('eye')}</button>` : ''}</div>
      <small class="err"></small></label>`;
  },
  select(name, label, opts, o = {}) {
    return `<label class="field"><span class="lbl">${label}${o.req ? ' <i>*</i>' : ''}</span>
      <div class="ctl sel">${o.icon ? I(o.icon) : ''}<select name="${name}">
        ${o.ph ? `<option value="">${esc(o.ph)}</option>` : ''}
        ${opts.map(v => `<option ${v === o.value ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <small class="err"></small></label>`;
  },
  seg(name, label, opts, o = {}) {
    return `<div class="field"><span class="lbl">${label}${o.req ? ' <i>*</i>' : ''}</span>
      <div class="seg ${o.wrap ? 'wrap' : ''} ${o.big ? 'big' : ''}">${opts.map(v => {
        const [val, icon] = Array.isArray(v) ? v : [v];
        return `<label><input type="radio" name="${name}" value="${esc(val)}" ${val === o.value ? 'checked' : ''}><span>${icon ? I(icon) : ''}${esc(val)}</span></label>`;
      }).join('')}</div><small class="err"></small></div>`;
  },
  area(name, label, o = {}) {
    return `<label class="field"><span class="lbl">${label}</span>
      <div class="ctl"><textarea name="${name}" placeholder="${esc(o.ph || '')}" maxlength="${o.max || 500}">${esc(o.value)}</textarea></div>
      <small class="err"></small></label>`;
  },
  section: title => `<div class="form-section">${esc(title)}</div>`,
};

function setErr(form, name, msg) {
  const el = form.querySelector(`[name="${name}"]`);
  const field = el && el.closest('.field');
  if (!field) return;
  field.classList.toggle('invalid', !!msg);
  $('.err', field).textContent = msg || '';
}
// Reads a form, runs rules {field: (value, all) => errorMessage}, shows errors inline
function readForm(form, rules = {}) {
  const v = {};
  for (const [k, val] of new FormData(form).entries()) v[k] = typeof val === 'string' ? val.trim() : val;
  let firstBad = null;
  for (const [name, rule] of Object.entries(rules)) {
    const msg = rule(v[name] || '', v);
    setErr(form, name, msg);
    if (msg && !firstBad) firstBad = name;
  }
  if (firstBad) {
    const el = form.querySelector(`[name="${firstBad}"]`);
    if (el) { el.closest('.field').scrollIntoView({ behavior: 'smooth', block: 'center' }); if (el.type !== 'radio') el.focus({ preventScroll: true }); }
    buzz('error');
    return null;
  }
  return v;
}
// Clears a field's error as soon as the user edits it
function liveClear(form) {
  form.addEventListener('input', e => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); });
  form.addEventListener('change', e => { const f = e.target.closest('.field'); if (f) f.classList.remove('invalid'); });
}

const R = {
  req: msg => v => (v ? '' : msg),
  phone: (optional = false) => v => {
    if (!v) return optional ? '' : 'Phone number is required';
    const d = digits(v);
    return d.length >= 10 && d.length <= 13 ? '' : 'Enter a valid 10-digit phone number';
  },
  email: v => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter a valid email address'),
  name: v => (!v ? 'Name is required' : v.length < 2 ? 'Name is too short' : ''),
  notFuture: v => (v && v > today() ? 'Date cannot be in the future' : ''),
};

/* ---------- App state and routing ---------- */
const S = { user: null, kind: null, tab: 'home', tokenDate: null, tokenStatus: 'All', tokenMine: false, tokenQ: '', staffQ: '', staffRole: 'All', auth: null, insRange: 7 };

function route() {
  if (Store.setupNeeded) renderSetup();
  else if (!S.user) renderLanding();
  else renderMain();
}

/* ---------- Doctor / Manager account form (setup and add-account) ---------- */
function adminFields(role = 'Doctor') {
  return `
    ${F.seg('role', 'I am a', [['Doctor', 'stetho'], ['Manager', 'briefcase']], { value: role, big: true })}
    ${F.text('name', 'Full name', { req: true, icon: 'user', ph: 'e.g. Anita Sharma', max: 60, auto: 'name' })}
    <div class="title-field">${F.text('title', role === 'Doctor' ? 'Speciality' : 'Designation', { icon: role === 'Doctor' ? 'stetho' : 'briefcase', ph: role === 'Doctor' ? 'e.g. General Physician' : 'e.g. Hospital Manager', max: 60 })}</div>
    ${F.text('phone', 'Phone number', { req: true, icon: 'phone', type: 'tel', mode: 'tel', ph: '10-digit mobile number', max: 15 })}
    ${F.text('username', 'Username', { req: true, icon: 'at', ph: 'Used to sign in', max: 20, attrs: 'autocapitalize="none" spellcheck="false"' })}
    ${F.text('password', 'Password', { req: true, icon: 'lock', type: 'password', ph: 'At least 6 characters', max: 64, auto: 'new-password' })}
    ${F.text('confirm', 'Confirm password', { req: true, icon: 'lock', type: 'password', ph: 'Type it again', max: 64, auto: 'new-password' })}`;
}
// Swaps the Speciality/Designation label when the role changes
function bindRoleSwitch(form) {
  form.addEventListener('change', e => {
    if (e.target.name !== 'role') return;
    const doc = e.target.value === 'Doctor';
    const wrap = $('.title-field', form);
    const cur = $('[name="title"]', wrap).value;
    wrap.innerHTML = F.text('title', doc ? 'Speciality' : 'Designation', { icon: doc ? 'stetho' : 'briefcase', ph: doc ? 'e.g. General Physician' : 'e.g. Hospital Manager', max: 60, value: cur });
  });
}
const adminRules = {
  name: R.name,
  phone: R.phone(),
  username: v => {
    if (!v) return 'Username is required';
    if (!/^[a-z0-9._]{3,20}$/i.test(v)) return 'Use 3–20 letters, numbers, dots or underscores';
    if (usernameTaken(v)) return 'This username is already taken';
    return '';
  },
  password: v => (!v ? 'Password is required' : v.length < 6 ? 'Use at least 6 characters' : ''),
  confirm: (v, all) => (!v ? 'Please confirm the password' : v !== all.password ? 'Passwords do not match' : ''),
};
const adminBody = v => ({ role: v.role || 'Doctor', name: v.name, title: v.title || '', phone: v.phone, username: v.username.toLowerCase(), password: v.password });

/* ---------- Screen: first-run setup ---------- */
function renderSetup() {
  S.auth = 'setup';
  $('#screen').innerHTML = `
    <div class="auth">
      <div class="auth-top">${LOGO_H}</div>
      <div class="auth-card">
        <h1>Welcome to Prime Care</h1>
        <p>Create the first Doctor or Manager account. This account can register staff and other doctors and managers.</p>
        <form id="setupForm" novalidate>
          ${adminFields()}
          <button class="btn primary block" type="submit">${I('check')} Create account</button>
        </form>
      </div>
      <div class="auth-foot">Data is stored securely on the Prime Care server</div>
    </div>`;
  const form = $('#setupForm');
  $$('.eye', form).forEach(bindEye);
  bindRoleSwitch(form);
  liveClear(form);
  form.onsubmit = async e => {
    e.preventDefault();
    const v = readForm(form, adminRules);
    if (!v) return;
    const r = await attempt($('button[type=submit]', form), async () => {
      try {
        const res = await Api.post('/api/setup', adminBody(v));
        Store.setupNeeded = false;
        await startSession(res);
        return res;
      } catch (e) {
        // Another phone finished setting up first: sign in instead
        if (e.code === 'SETUP_DONE') { Store.setupNeeded = false; renderLanding(); }
        throw e;
      }
    }, form);
    if (!r) return;
    dbLine('add');
    buzz('success');
    toast(`Welcome, ${displayName(r.user)}`);
    renderMain();
  };
}

/* ---------- Screen: login ---------- */
function renderLogin(role = 'Doctor') {
  S.auth = 'hospital';
  $('#screen').innerHTML = `
    <div class="auth">
      ${authBack()}
      <div class="auth-top">${LOGO_H}</div>
      <div class="auth-card">
        <span class="chip">${I('building')} Hospital Login</span>
        <h1>Sign in</h1>
        <p>Doctors, managers and staff sign in with the username given to them.</p>
        ${bioQuickCard(['admin', 'staff'])}
        <div class="form-error" id="loginErr">${I('alert')}<span></span></div>
        <form id="loginForm" novalidate>
          ${F.seg('role', 'Sign in as', [['Doctor', 'stetho'], ['Manager', 'briefcase'], ['Staff', 'users']], { value: role, big: true })}
          ${F.text('username', 'Username', { icon: 'at', ph: 'Your username', max: 20, auto: 'username', attrs: 'autocapitalize="none" spellcheck="false"' })}
          ${F.text('password', 'Password', { icon: 'lock', type: 'password', ph: 'Your password', max: 64, auto: 'current-password' })}
          <button class="link-btn forgot" type="button" id="forgot">Forgot password?</button>
          <button class="btn primary block" type="submit">${I('lock')} Sign in</button>
        </form>
      </div>
      <div class="auth-foot">Prime Care Hospital · v${APP_VERSION}</div>
    </div>`;
  bindAuthBack();
  bindBioQuick();
  $('#forgot').onclick = forgotHospital;
  const form = $('#loginForm');
  $$('.eye', form).forEach(bindEye);
  liveClear(form);
  const showErr = msg => { const el = $('#loginErr'); $('span', el).textContent = msg; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); buzz('error'); };
  form.onsubmit = async e => {
    e.preventDefault();
    const v = readForm(form, { username: R.req('Enter your username'), password: R.req('Enter your password') });
    if (!v) return;
    const btn = $('button[type=submit]', form);
    busy(btn, true);
    try {
      const r = await Api.post('/api/login/hospital', { role: v.role, username: v.username.toLowerCase(), password: v.password });
      await startSession(r);
    } catch (e) {
      busy(btn, false);
      // Wrong password, wrong role, or the account is turned off: shown above the form
      return e.status && e.status < 500 ? showErr(e.message) : showError(e);
    }
    buzz('success');
    renderMain();
  };
}

/* ---------- First-run tour ----------
   Four pages shown once after installation (flag in Preferences), and on demand from Settings. */
const TOUR = [
  {
    kicker: 'Welcome',
    title: 'Prime Care in your pocket',
    text: 'One app for the whole hospital: the front desk, doctors, managers and patients.',
    points: [['stetho', 'Doctors and managers run the hospital'], ['users', 'Staff handle the front desk'], ['user', 'Patients book and track their own visits']],
    art: () => `
      <div class="tour-art a-welcome">
        <div class="tw-mark">${MARK}</div>
        <span class="tw-chip c1">${I('stetho')} Doctor</span>
        <span class="tw-chip c2">${I('briefcase')} Manager</span>
        <span class="tw-chip c3">${I('users')} Staff</span>
        <span class="tw-chip c4">${I('user')} Patient</span>
      </div>`,
  },
  {
    kicker: 'OP tokens',
    title: 'Tokens without the queue chaos',
    text: 'The desk issues tokens in seconds and patients can book their own, numbered by date and order.',
    points: [['ticket', 'Token numbers like 151026-007: date plus the day\'s count'], ['shield', 'One active token per mobile number per day'], ['activity', 'Patients see who the doctor is seeing right now']],
    art: () => `
      <div class="tour-art a-tokens">
        <div class="tw-slip"><small>OP TOKEN</small><b>007</b><span>${tourTokenNo()}</span></div>
        <div class="tw-now"><span class="live-dot"></span><div><small>NOW CONSULTING</small><b>Dr. Anand · 005</b></div></div>
        <div class="tw-queue"><i></i><i></i><i></i></div>
      </div>`,
  },
  {
    kicker: 'Hospital',
    title: 'Everything about your people',
    text: 'Register staff, give them app access, and keep every consultation on record.',
    points: [['userPlus', 'Staff, doctor and manager accounts in one place'], ['note', 'Doctors write notes when they complete a visit'], ['calendar', 'Look back at any day\'s tokens and outcomes']],
    art: () => `
      <div class="tour-art a-people">
        ${[['PN', 'Priya Nair', 'Nurse · Emergency', 'c4'], ['RV', 'Rahul Verma', 'Patient · Follow-up visit', 'c0'], ['CR', 'Chandu Reddy', 'Receptionist', 'c3']]
          .map(([ini, n, s, c], i) => `<div class="tw-card" style="--i:${i}"><div class="av sm ${c}">${ini}</div><div><b>${n}</b><small>${s}</small></div></div>`).join('')}
        <div class="tw-note">${I('stetho')}<span>Viral fever. Rest and fluids.</span></div>
      </div>`,
  },
  {
    kicker: 'Insights & data',
    title: 'See the whole picture',
    text: 'Charts show trends, peak hours and workload, and every change is saved online for all your phones.',
    points: [['barChart', 'Bar, line, pie, donut and heatmap charts'], ['database', 'Saved online, the same on every phone'], ['palette', 'Five themes to suit your style']],
    art: () => `
      <div class="tour-art a-insights">
        <div class="tw-chart">${[40, 65, 50, 90, 72, 58, 80].map((h, i) => `<i style="height:${h}%;--i:${i}"></i>`).join('')}</div>
        <div class="tw-donut"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" stroke="var(--s1)" stroke-dasharray="52 88"/><circle cx="18" cy="18" r="14" stroke="var(--s2)" stroke-dasharray="20 88" stroke-dashoffset="-53"/><circle cx="18" cy="18" r="14" stroke="var(--s3)" stroke-dasharray="14 88" stroke-dashoffset="-74"/></svg></div>
        <div class="tw-saved"><i></i>Saved online</div>
      </div>`,
  },
];
const tourTokenNo = () => { const [y, m, d] = today().split('-'); return `${d}${m}${y.slice(2)}-007`; };

function renderTour(onDone) {
  S.auth = 'tour';
  let page = 0;
  $('#screen').innerHTML = `
    <div class="tour">
      <div class="tour-top">${LOGO_H}<button class="link-btn" id="tourSkip">Skip</button></div>
      <div class="tour-view"><div class="tour-track">${TOUR.map((p, i) => `
        <section class="tour-page" data-i="${i}" aria-hidden="${i ? 'true' : 'false'}">
          ${p.art()}
          <div class="tour-copy">
            <span class="tour-kicker">${i + 1} of ${TOUR.length} · ${esc(p.kicker)}</span>
            <h1>${esc(p.title)}</h1>
            <p>${esc(p.text)}</p>
            <ul>${p.points.map(([ic, t]) => `<li>${I(ic)}<span>${esc(t)}</span></li>`).join('')}</ul>
          </div>
        </section>`).join('')}</div></div>
      <div class="tour-foot">
        <button class="btn ghost" id="tourPrev">${I('chevL')} Previous</button>
        <div class="tour-dots">${TOUR.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
        <button class="btn primary" id="tourNext">Next ${I('chevron')}</button>
      </div>
    </div>`;
  const track = $('.tour-track'), prev = $('#tourPrev'), next = $('#tourNext');
  const finish = async () => { await call('Preferences', 'set', { key: 'onboarded', value: '1' }); S.auth = null; S.tourStep = null; buzz('success'); onDone(); };
  const show = i => {
    page = Math.max(0, Math.min(TOUR.length - 1, i));
    track.style.transform = `translateX(-${page * 100}%)`;
    $$('.tour-page').forEach((p, k) => { p.classList.toggle('on', k === page); p.setAttribute('aria-hidden', k === page ? 'false' : 'true'); });
    $$('.tour-dots i').forEach((d, k) => d.classList.toggle('on', k === page));
    prev.classList.toggle('invisible', page === 0);
    const last = page === TOUR.length - 1;
    next.innerHTML = last ? `${I('check')} Get started` : `Next ${I('chevron')}`;
    $('#tourSkip').classList.toggle('invisible', last);
  };
  S.tourStep = d => { if (d < 0 && page === 0) return false; show(page + d); return true; };
  prev.onclick = () => { buzz(); show(page - 1); };
  next.onclick = () => { buzz(); if (page === TOUR.length - 1) finish(); else show(page + 1); };
  $('#tourSkip').onclick = finish;
  $$('.tour-dots i').forEach(d => { d.onclick = () => show(+d.dataset.i); });
  // Swipe left / right between pages
  let x0 = null, y0 = 0;
  const view = $('.tour-view');
  view.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  view.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(page + (dx < 0 ? 1 : -1));
    x0 = null;
  });
  requestAnimationFrame(() => show(0));
}

/* ---------- Screen: landing (Hospital Login / Patient Login) ---------- */
function renderLanding() {
  S.auth = 'landing';
  $('#screen').innerHTML = `
    <div class="auth">
      <div class="auth-top">${LOGO_H}</div>
      <div class="landing-head"><h1>Welcome</h1><p>How would you like to sign in?</p></div>
      ${bioQuickCard()}
      <div class="choices">
        <button class="choice c-hosp" id="goHospital">
          <div class="ic">${I('building')}</div>
          <div class="tx"><b>Hospital Login</b><small>Doctors, managers and staff</small></div>${I('chevron')}
        </button>
        <button class="choice c-pat" id="goPatient">
          <div class="ic">${I('user')}</div>
          <div class="tx"><b>Patient Login</b><small>Book today's OP token and see your visits</small></div>${I('chevron')}
        </button>
      </div>
      <button class="theme-link" id="themeBtn">${I('palette')} Theme: <b>${esc(Theme.name)}</b></button>
      <div class="auth-foot">Prime Care Hospital · v${APP_VERSION}</div>
    </div>`;
  $('#themeBtn').onclick = () => themeSheet(() => { $('#themeBtn b').textContent = Theme.name; });
  $('#goHospital').onclick = () => { buzz(); renderLogin(); };
  $('#goPatient').onclick = () => { buzz(); renderPatientLogin(); };
  bindBioQuick();
}
const authBack = (label = 'Back') => `<button class="auth-back" id="authBack">${I('chevL')} ${esc(label)}</button>`;
function bindAuthBack(to = renderLanding) { const b = $('#authBack'); if (b) b.onclick = () => { buzz(); to(); }; }
function authError(msg) {
  const el = $('#loginErr');
  $('span', el).innerHTML = msg;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  buzz('error');
}

/* ---------- Patient login ---------- */
// Patients sign in with their mobile number or Patient ID (PCP-00001) plus their password
function renderPatientLogin(prefill = '') {
  S.auth = 'patient';
  $('#screen').innerHTML = `
    <div class="auth">
      ${authBack()}
      <div class="auth-top">${LOGO_H}</div>
      <div class="auth-card">
        <span class="chip c-pat-chip">${I('user')} Patient Login</span>
        <h1>Sign in</h1>
        <p>Use your mobile number or Patient ID with your password.</p>
        ${bioQuickCard(['patient'])}
        <div class="form-error" id="loginErr">${I('alert')}<span></span></div>
        <form id="pLoginForm" novalidate>
          ${F.text('id', 'Mobile number or Patient ID', { icon: 'phone', ph: 'e.g. 9876543210 or PCP-00001', max: 15, value: prefill, attrs: 'autocapitalize="characters" spellcheck="false"' })}
          ${F.text('password', 'Password', { icon: 'lock', type: 'password', ph: 'Your password', max: 64, auto: 'current-password' })}
          <button class="link-btn forgot" type="button" id="forgot">Forgot password?</button>
          <button class="btn primary block" type="submit">${I('lock')} Sign in</button>
        </form>
        <div class="or"><span>New to Prime Care?</span></div>
        <button class="btn ghost block" id="toRegister">${I('userPlus')} Register as a patient</button>
      </div>
      <div class="auth-foot">Prime Care Hospital · v${APP_VERSION}</div>
    </div>`;
  bindAuthBack();
  bindBioQuick();
  const form = $('#pLoginForm');
  $$('.eye', form).forEach(bindEye);
  liveClear(form);
  $('#forgot').onclick = () => forgotPatient(form.id.value.trim());
  $('#toRegister').onclick = () => renderPatientRegister(digits(form.id.value).length >= 10 ? form.id.value.trim() : '');
  form.onsubmit = async e => {
    e.preventDefault();
    const v = readForm(form, { id: R.req('Enter your mobile number or Patient ID'), password: R.req('Enter your password') });
    if (!v) return;
    const btn = $('button[type=submit]', form);
    busy(btn, true);
    try {
      await startSession(await Api.post('/api/login/patient', { id: v.id, password: v.password }));
    } catch (e) {
      busy(btn, false);
      if (e.code === 'NO_ACCOUNT') {
        authError(`No patient account found for <b>${esc(v.id)}</b>. <button type="button" class="link-btn" id="errReg">Register now</button>`);
        $('#errReg').onclick = () => renderPatientRegister(digits(v.id).length >= 10 ? v.id : '');
        return;
      }
      return e.status && e.status < 500 ? authError(esc(e.message)) : showError(e);
    }
    buzz('success');
    renderMain();
  };
}

/* ---------- Patient registration ---------- */
function renderPatientRegister(phone = '') {
  S.auth = 'register';
  $('#screen').innerHTML = `
    <div class="auth">
      ${authBack('Back to sign in')}
      <div class="auth-top">${LOGO_H}</div>
      <div class="auth-card">
        <span class="chip c-pat-chip">${I('userPlus')} New patient</span>
        <h1>Create your account</h1>
        <p>You'll get a Patient ID. Sign in later with it or your mobile number.</p>
        <form id="pRegForm" novalidate>
          ${F.text('name', 'Full name', { req: true, icon: 'user', ph: 'As on your ID', max: 60, auto: 'name' })}
          ${F.text('phone', 'Mobile number', { req: true, icon: 'phone', type: 'tel', mode: 'tel', ph: '10-digit mobile number', max: 15, value: phone })}
          ${F.seg('gender', 'Gender', GENDERS, { req: true })}
          ${F.text('dob', 'Date of birth', { req: true, icon: 'calendar', type: 'date', attrs: `max="${today()}"` })}
          <p class="field-note">${I('info')} Your date of birth is used to reset your password if you forget it.</p>
          ${F.text('email', 'Email', { icon: 'mail', type: 'email', mode: 'email', ph: 'Optional', max: 80 })}
          ${F.section('Set a password')}
          ${F.text('password', 'Password', { req: true, icon: 'lock', type: 'password', ph: 'At least 6 characters', max: 64, auto: 'new-password' })}
          ${F.text('confirm', 'Confirm password', { req: true, icon: 'lock', type: 'password', ph: 'Type it again', max: 64, auto: 'new-password' })}
          <button class="btn primary block" type="submit">${I('check')} Register</button>
        </form>
      </div>
      <div class="auth-foot">Prime Care Hospital · v${APP_VERSION}</div>
    </div>`;
  bindAuthBack(() => renderPatientLogin(phone));
  const form = $('#pRegForm');
  $$('.eye', form).forEach(bindEye);
  liveClear(form);
  form.onsubmit = async e => {
    e.preventDefault();
    const v = readForm(form, {
      name: R.name,
      phone: R.phone(),
      gender: R.req('Select your gender'),
      dob: x => (!x ? 'Enter your date of birth' : R.notFuture(x)),
      email: R.email,
      password: adminRules.password,
      confirm: adminRules.confirm,
    });
    if (!v) return;
    const r = await attempt($('button[type=submit]', form), async () => {
      const res = await Api.post('/api/patients/register', { name: v.name, phone: v.phone, gender: v.gender, dob: v.dob, email: v.email, password: v.password });
      await startSession(res);
      return res;
    }, form);
    if (!r) return;
    dbLine('add');
    buzz('success');
    patientWelcome(S.user);
  };
}
// Shows the new Patient ID once, prominently, before entering the app
function patientWelcome(p) {
  S.auth = 'welcome';
  $('#screen').innerHTML = `
    <div class="auth welcome">
      <div class="auth-top">${LOGO_H}</div>
      <div class="auth-card center">
        <div class="ok-badge">${I('check')}</div>
        <h1>You're registered!</h1>
        <p>Welcome to Prime Care, ${esc(p.name)}. This is your Patient ID:</p>
        <div class="pid-big">${esc(p.id)}</div>
        <p class="small">Sign in next time with this ID or your mobile number <b>${esc(p.phone)}</b> and your password. A screenshot of this page is a handy way to keep it.</p>
        <button class="btn primary block" id="enter">${I('chevron')} Continue</button>
      </div>
    </div>`;
  $('#enter').onclick = () => renderMain();
}

/* ---------- Forgot password ----------
   There is no SMS service yet, so identity is checked against details on file:
   hospital accounts give their username + registered phone, patients give their ID/mobile + date of birth. */
function resetSheet({ title, intro, fields, rules, path, body }) {
  const sheet = openSheet({
    html: `
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${I('x')}</button></div>
      <form class="sheet-body" id="resetForm" novalidate>
        <p class="muted" style="font-size:14px;margin-bottom:14px">${intro}</p>
        <div class="form-error" id="resetErr">${I('alert')}<span></span></div>
        ${fields}
        ${F.section('New password')}
        ${F.text('password', 'New password', { icon: 'key', type: 'password', ph: 'At least 6 characters', max: 64, auto: 'new-password' })}
        ${F.text('confirm', 'Confirm new password', { icon: 'key', type: 'password', max: 64, auto: 'new-password' })}
      </form>
      <div class="sheet-foot"><button class="btn primary" id="doReset">${I('key')} Reset password</button></div>`,
  });
  const form = $('#resetForm', sheet.el);
  liveClear(form);
  form.onsubmit = e => { e.preventDefault(); $('#doReset', sheet.el).click(); };
  $('#doReset', sheet.el).onclick = async () => {
    const v = readForm(form, { ...rules, password: adminRules.password, confirm: adminRules.confirm });
    if (!v) return;
    const btn = $('#doReset', sheet.el);
    busy(btn, true);
    try {
      await Api.post(path, { ...body(v), password: v.password });
    } catch (e) {
      busy(btn, false);
      if (e.field) return showError(e, form);
      if (!e.status || e.status >= 500) return showError(e);
      // Details that don't match the records are shown at the top of the sheet
      const el = $('#resetErr', sheet.el);
      $('span', el).textContent = e.message;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      buzz('error');
      return;
    }
    dbLine('update');
    buzz('success');
    sheet.close();
    toast('Password reset. You can sign in now.');
  };
}
function forgotHospital() {
  resetSheet({
    title: 'Reset password',
    intro: 'Enter your username and the phone number registered with your account.',
    fields: `${F.text('username', 'Username', { icon: 'at', max: 20, attrs: 'autocapitalize="none" spellcheck="false"' })}
      ${F.text('phone', 'Registered phone number', { icon: 'phone', type: 'tel', mode: 'tel', max: 15 })}`,
    rules: { username: R.req('Enter your username'), phone: R.phone() },
    path: '/api/reset/hospital',
    body: v => ({ username: v.username.toLowerCase(), phone: v.phone }),
  });
}
function forgotPatient(prefill = '') {
  resetSheet({
    title: 'Reset password',
    intro: 'Enter your mobile number or Patient ID, and your date of birth.',
    fields: `${F.text('id', 'Mobile number or Patient ID', { icon: 'phone', max: 15, value: prefill, attrs: 'autocapitalize="characters" spellcheck="false"' })}
      ${F.text('dob', 'Date of birth', { icon: 'calendar', type: 'date', attrs: `max="${today()}"` })}`,
    rules: { id: R.req('Enter your mobile number or Patient ID'), dob: R.req('Enter your date of birth') },
    path: '/api/reset/patient',
    body: v => ({ id: v.id, dob: v.dob }),
  });
}

/* ---------- Patient app: home, visits, profile ---------- */
const myTokens = () => Store.db.tokens
  .filter(t => t.patientId === S.user.id || digits(t.patient.phone).slice(-10) === digits(S.user.phone).slice(-10))
  .sort((a, b) => (b.date + String(b.seq).padStart(4, '0')).localeCompare(a.date + String(a.seq).padStart(4, '0')));

function renderPatientHome() {
  const p = S.user;
  const todays = patientTokenToday(p);
  const visits = myTokens().filter(t => t.status === 'Completed').length;
  let tokenBlock;
  if (todays) {
    const st = TOKEN_STYLE[todays.status];
    const ahead = aheadOf(todays);
    tokenBlock = `
      <div class="my-token tk-${st[1]}" data-token="${esc(todays.id)}">
        <div class="mt-top"><span>Today's OP token</span><span class="badge ${st[0]}">${I(st[2])} ${esc(statusLabel(todays.status))}</span></div>
        <div class="mt-seq">${String(todays.seq).padStart(3, '0')}</div>
        <div class="mt-no">${esc(todays.id)}</div>
        <div class="mt-rows">
          <div><span>Doctor</span><b>${esc(doctorLabel(todays.doctorId))}</b></div>
          <div><span>Booked</span><b>${fmtTime(todays.issuedAt)}</b></div>
        </div>
        ${todays.status === 'Waiting' ? `<div class="slip-wait">${ahead ? `${ahead} patient${ahead === 1 ? '' : 's'} ahead of you` : "You're next in the queue"}</div>` : ''}
        ${todays.status === 'In consultation' ? `<div class="slip-wait blue">The doctor is seeing you now</div>` : ''}
        ${todays.status === 'Completed' ? `<div class="slip-wait green">Your visit today is complete. Tap to see the doctor's notes.</div>` : ''}
        ${todays.status === 'Pending' ? `<div class="slip-wait violet">${I('lock')} Number reserved. Waiting for the hospital to confirm your booking.</div>` : ''}
        ${todays.status === 'Cancelled' ? `<div class="slip-wait grey">${todays.rejected
          ? `The hospital could not accept this booking${todays.cancelReason && todays.cancelReason !== 'Not accepted by the hospital' ? ': ' + esc(todays.cancelReason) : ''}. Please contact the reception.`
          : 'This booking was cancelled. Only one booking is allowed per day, so you can book again tomorrow.'}</div>` : ''}
      </div>`;
  } else {
    tokenBlock = `
      <button class="issue-cta big" id="bookBtn">${I('ticket')}<span><b>Book today's OP token</b><small>${fmtDate(today())} · tokens are for today only</small></span>${I('chevron')}</button>`;
  }
  $('#page').innerHTML = `
    <section class="hello">
      <p>${greeting()},</p>
      <h1>${esc(p.name)}</h1>
    </section>
    <div class="pid-card">
      <div><small>PATIENT ID</small><b>${esc(p.id)}</b></div>
      <div class="pid-meta"><span>${esc(p.phone)}</span><span>${visits} completed visit${visits === 1 ? '' : 's'}</span></div>
    </div>
    ${!todays || ['Waiting', 'Pending'].includes(todays.status) ? nowConsulting(todays) : ''}
    ${tokenBlock}
    <div class="sec-title">Recent visits <button id="allVisits">View all</button></div>
    ${myTokens().filter(t => t !== todays).slice(0, 3).map(visitCard).join('') || emptyState('clock', 'blue', 'No visits yet', 'Your OP visits will be listed here.')}`;
  if ($('#bookBtn')) $('#bookBtn').onclick = () => patientBook();
  if ($('.my-token')) $('.my-token').onclick = () => tokenDetail(todays.id);
  $('#allVisits').onclick = () => go('pvisits');
  bindVisitCards($('#page'));
}

/* "Now consulting": the token each doctor is seeing right now. The patient's own doctor comes first.
   Shown only while the patient is still waiting for their turn (or has no token yet); once the
   doctor calls them in, or the visit is completed or cancelled, the board is hidden. */
function nowConsulting(mine) {
  const todays = tokensOn(today());
  const myDoc = mine && mine.status !== 'Cancelled' ? mine.doctorId : '';
  const docs = [...doctors()].sort((a, b) => (b.id === myDoc) - (a.id === myDoc));
  if (!docs.length) return '';
  const rows = docs.map(d => {
    const cur = todays.filter(t => t.status === 'In consultation' && t.doctorId === d.id).sort((a, b) => b.seq - a.seq)[0];
    const waiting = todays.filter(t => t.status === 'Waiting' && (t.doctorId === d.id || !t.doctorId)).length;
    const isMe = cur && mine && cur.id === mine.id;
    return `
      <div class="nc-row ${d.id === myDoc ? 'mine' : ''}">
        <div class="nc-doc"><b>${esc(displayName(d))}</b><small>${d.title ? esc(d.title) + ' · ' : ''}${waiting} waiting</small></div>
        ${cur ? `<div class="nc-tok ${isMe ? 'me' : ''}"><small>${isMe ? 'YOU' : 'TOKEN'}</small><b>${String(cur.seq).padStart(3, '0')}</b></div>`
          : `<div class="nc-idle">Not consulting</div>`}
      </div>`;
  }).join('');
  return `
    <div class="now-consult">
      <div class="nc-head"><span class="live-dot"></span>Now consulting<time>Updated ${fmtTime(new Date().toISOString())}</time></div>
      ${rows}
    </div>`;
}
const visitCard = (t, i = 0) => {
  const st = TOKEN_STYLE[t.status];
  return `
  <div class="card tok tk-${st[1]}" role="button" tabindex="0" data-token="${esc(t.id)}" style="animation-delay:${Math.min(i, 8) * 30}ms">
    <div class="tno"><small>${esc(fmtDate(t.date).split(' ').slice(0, 2).join(' ').toUpperCase())}</small><b>${String(t.seq).padStart(3, '0')}</b></div>
    <div class="meta"><div class="nm">${esc(doctorLabel(t.doctorId))}</div><div class="sub">${esc(t.id)}${t.complaint ? ' · ' + esc(t.complaint) : ''}</div></div>
    <div class="side"><span class="id">${fmtDate(t.date)}</span><span class="badge ${st[0]}">${esc(t.status)}</span></div>
  </button>`;
};
function bindVisitCards(root) { $$('.card[data-token]', root).forEach(c => { c.onclick = () => tokenDetail(c.dataset.token); }); }

function renderPatientVisits() {
  const list = myTokens();
  const c = tokenCounts(list);
  $('#page').innerHTML = `
    <div class="page-head"><h1>My visits</h1><span class="count">${list.length} token${list.length === 1 ? '' : 's'}</span>${headRep('repVis')}</div>
    <div class="mini">
      <button><b>${c.total}</b><span>Total</span></button>
      <button class="m-green"><b>${c.Completed}</b><span>Completed</span></button>
      <button class="m-amber"><b>${c.Waiting + c['In consultation']}</b><span>Active</span></button>
      <button><b>${c.Cancelled}</b><span>Cancelled</span></button>
    </div>
    ${list.length ? `<label class="search">${I('search')}<input id="q" type="search" placeholder="Search token, doctor, reason or date" value="${esc(S.visitQ || '')}" autocomplete="off"><button class="clear ${S.visitQ ? '' : 'hidden'}" type="button" aria-label="Clear">${I('x')}</button></label>
    <div id="results"></div>`
      : emptyState('clock', 'blue', 'No visits yet', 'Book an OP token from the Home tab. It will appear here with the doctor\'s notes after your visit.')}`;
  $('#repVis').onclick = () => openReports({ type: 'visits', preset: 'all' });
  if (!list.length) return;
  const draw = () => {
    const q = (S.visitQ || '').toLowerCase();
    const shown = list.filter(t => !q || [t.id, doctorLabel(t.doctorId), t.complaint, t.status, t.visitType, fmtDate(t.date), t.doctorNotes].some(x => String(x || '').toLowerCase().includes(q)));
    $('#results').innerHTML = shown.length ? `<div class="list">${shown.map(visitCard).join('')}</div>` : emptyState('search', 'violet', 'No matching visits', 'Try a token number, doctor name or date.');
    bindVisitCards($('#results'));
  };
  bindSearch('visitQ', draw);
  draw();
}

function renderPatientProfile() {
  const p = S.user;
  const a = age(p.dob);
  $('#page').innerHTML = `
    <div class="page-head"><h1>Profile</h1></div>
    <div class="profile">${avatar(p.name, 'lg')}<div><h2>${esc(p.name)}</h2><p>Patient ID ${esc(p.id)}</p><p>Registered ${fmtDate(p.createdAt)}</p></div></div>
    <div class="info" style="margin-bottom:22px;background:var(--surface);box-shadow:var(--shadow)">
      ${infoRow('phone', 'Mobile', p.phone)}
      ${infoRow('user', 'Gender', p.gender)}
      ${infoRow('calendar', 'Date of birth', `${fmtDate(p.dob)}${a !== null ? ` (${a} years)` : ''}`)}
      ${infoRow('mail', 'Email', p.email)}
    </div>
    <div class="group">${row('mode', Mode.resolved() === 'dark' ? 'moon' : 'sun', 'violet', 'Display mode', Mode.name)}${row('theme', 'palette', 'blue', 'Theme', Theme.name)}${toggleRow('fingerprint', 'fingerprint', 'green', 'Fingerprint unlock', Bio.enabledFor('patient', p.id) ? 'On · unlock with your fingerprint' : 'Off · sign in with your password', Bio.enabledFor('patient', p.id))}${toggleRow('sounds', 'volume', 'amber', 'Sound effects', Sound.on ? 'On' : 'Off', Sound.on)}${row('reports', 'download', 'amber', 'Visit history PDF', 'Download your visits as a report')}${row('tour', 'info', 'green', 'App tour', 'See what Prime Care can do')}${row('password', 'key', 'violet', 'Change password', 'Update your sign-in password')}</div>
    <div class="group">${row('logout', 'logout', 'red', 'Sign out', `Signed in as ${p.id}`, true)}</div>
    <div class="version">Prime Care Hospital · v${APP_VERSION}</div>`;
  const actions = { mode: () => modeSheet(() => { $('.row[data-act=mode] small').textContent = Mode.name; }), fingerprint: () => toggleFingerprint($('.row[data-act=fingerprint]')), sounds: () => { Sound.set(!Sound.on); setSwitch($('.row[data-act=sounds]'), Sound.on, Sound.on ? 'On' : 'Off'); }, reports: () => openReports({ type: 'visits', preset: 'all' }), tour: () => renderTour(renderMain), password: passwordSheet, logout: signOut, theme: () => themeSheet(() => { $('.row[data-act=theme] small').textContent = Theme.name; }) };
  $$('.row[data-act]').forEach(r => { r.onclick = () => actions[r.dataset.act](); });
}

/* Patients book their own token, for today only, one per mobile number */
function patientBook() {
  const p = S.user;
  const existing = patientTokenToday(p) || activeTokenFor(p.phone, today());
  if (existing) { toast(existing.status === 'Cancelled' ? 'You can book only one token per day. Please try again tomorrow.' : `You already have token ${existing.id} today`, 'error'); return; }
  const docOpts = doctors().map(d => `<option value="${esc(d.id)}">${esc(displayName(d))}${d.title ? ' · ' + esc(d.title) : ''}</option>`).join('');
  const a = age(p.dob);
  const sheet = openSheet({
    full: true,
    html: `
      <div class="sheet-head"><button class="icon-btn" data-close aria-label="Close">${I('x')}</button><h2>Book OP token</h2><span class="chip">${I('calendar')}Today</span></div>
      <form class="sheet-body" id="bookForm" novalidate>
        <div class="book-who">${avatar(p.name)}<div><b>${esc(p.name)}</b><small>${esc(p.id)} · ${a !== null ? a + ' yrs · ' : ''}${esc(p.gender)} · ${esc(p.phone)}</small></div></div>
        <div class="hint">${I('info')} Tokens can only be booked for today, ${fmtDate(today())}.</div>
        <label class="field"><span class="lbl">Doctor</span>
          <div class="ctl sel">${I('stetho')}<select name="doctorId"><option value="">Any available doctor</option>${docOpts}</select></div><small class="err"></small></label>
        ${F.seg('visitType', 'Visit type', ['New', 'Follow-up'], { value: myTokens().length ? 'Follow-up' : 'New' })}
        ${F.area('complaint', 'Reason for visit', { ph: 'e.g. Fever for 3 days, headache', max: 300 })}
      </form>
      <div class="sheet-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="doBook">${I('ticket')} Book token</button></div>`,
  });
  const form = $('#bookForm', sheet.el);
  form.onsubmit = e => { e.preventDefault(); $('#doBook', sheet.el).click(); };
  $('#doBook', sheet.el).onclick = async () => {
    const v = readForm(form, { complaint: R.req('Tell the doctor briefly why you are visiting') });
    if (!v) return;
    // The server re-checks the one-token-per-day rule, in case the front desk issued one meanwhile
    const r = await attempt($('#doBook', sheet.el), () => Api.post('/api/tokens/book', { doctorId: v.doctorId || '', visitType: v.visitType, complaint: v.complaint }), form);
    if (!r) { if (!$('.field.invalid', form)) { sheet.close(); refresh(); } return; }
    dbLine('add');
    buzz('success');
    sheet.close();
    refresh();
    tokenSlip(r.record);
  };
}

/* ---------- Main tabbed shell ---------- */
// Doctors and managers manage everything; staff run the OP token desk
const tabsFor = () => isPatient()
  ? [['phome', 'Home', 'home'], ['pvisits', 'My visits', 'clock'], ['pprofile', 'Profile', 'user']]
  : isStaff()
  ? [['home', 'Home', 'home'], ['tokens', 'OP Tokens', 'ticket'], ['settings', 'Settings', 'settings']]
  : [['home', 'Home', 'home'], ['tokens', 'OP Tokens', 'ticket'], ['staff', 'Staff', 'users'], ['settings', 'Settings', 'settings']];
function renderMain() {
  if (!S.tokenDate) S.tokenDate = today();
  $('#screen').innerHTML = `
    <div class="shell">
      <header class="topbar">${LOGO_H}<div class="tb-acts">${isPatient() ? '' : `<button class="icon-btn tb-search" id="gsBtn" aria-label="Search">${I('search')}</button>`}<button class="avatar-btn" id="meBtn" aria-label="Your account">${avatar(S.user.name, 'sm')}</button></div></header>
      <div id="ptr" aria-hidden="true">${I('refresh')}</div>
      <main class="page" id="page"></main>
      <button class="fab hide" id="fab" aria-label="Add">${I('plus')}</button>
      <nav class="tabbar">${tabsFor().map(([id, label, icon]) => `<button class="tab" data-tab="${id}"><span class="pill"></span>${I(icon)}<span>${label}</span></button>`).join('')}</nav>
    </div>`;
  $$('.tab').forEach(t => { t.onclick = () => { if (S.tab !== t.dataset.tab) { buzz(); go(t.dataset.tab); } }; });
  $('#meBtn').onclick = () => go(isPatient() ? 'pprofile' : 'settings');
  if ($('#gsBtn')) $('#gsBtn').onclick = () => { buzz(); openSearch(); };
  $('#fab').onclick = () => { buzz(); ({ staff: staffForm, tokens: tokenForm })[S.tab](); };
  if (!tabsFor().some(t => t[0] === S.tab)) S.tab = tabsFor()[0][0];
  go(S.tab);
}
// Back arrow on list pages returns to the home screen
const backBtn = () => `<button class="icon-btn back-btn" id="pgBack" aria-label="Back to home">${I('chevL')}</button>`;
function bindBack() { const b = $('#pgBack'); if (b) b.onclick = () => { buzz(); go(tabsFor()[0][0]); }; }
// quiet = redraw in place (after a background update): no page animation, keep the scroll position
function go(tab, quiet = false) {
  S.tab = tab;
  if (typeof hideVizTip === 'function') hideVizTip();
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  // Only staff issue OP tokens, so the + button on the tokens tab is theirs
  const fab = tab === 'staff' || (tab === 'tokens' && isStaff());
  $('#fab').classList.toggle('hide', !fab);
  const page = $('#page');
  const y = window.scrollY;
  if (!quiet) { page.style.animation = 'none'; void page.offsetWidth; page.style.animation = ''; }
  ({ home: isStaff() ? renderStaffHome : renderHome, tokens: renderTokens, staff: renderStaff, settings: renderSettings, phome: renderPatientHome, pvisits: renderPatientVisits, pprofile: renderPatientProfile, insights: renderInsights })[tab]();
  window.scrollTo(0, quiet ? y : 0);
}
const refresh = (quiet = false) => { if (S.user && $('#page')) go(S.tab, quiet); };

/* ---------- Tab: Home ---------- */
function renderHome() {
  const { staff, patients } = Store.db;
  const a = S.user;
  const month = today().slice(0, 7);
  // Patient accounts registered this month, counted by the date in India (createdAt is stored in UTC)
  const newThisMonth = patients.filter(p => p.createdAt && localDate(p.createdAt).slice(0, 7) === month).length;
  const activeStaff = staff.filter(s => s.status === 'Active').length;
  const recent = [...staff].sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || '')).slice(0, 5);

  $('#page').innerHTML = `
    <section class="hello">
      <p>${greeting()},</p>
      <h1>${esc(displayName(a))}</h1>
      <span class="chip">${I(a.role === 'Doctor' ? 'stetho' : 'briefcase')}${esc(a.role)}${a.title ? ' · ' + esc(a.title) : ''}</span>
    </section>
    ${opPanel()}
    ${insightsCta()}
    ${reportsCta()}
    <div class="kpis">
      ${kpiTile('staff', 'users', 'blue', staff.length, 'Total staff')}
      ${kpiTile('staff', 'activity', 'violet', activeStaff, 'Active staff')}
      ${kpiTile('rep:all', 'user', 'green', patients.length, 'Patient accounts')}
      ${kpiTile('rep:month', 'userPlus', 'amber', newThisMonth, 'New this month')}
    </div>
    <div class="sec-title">Quick actions</div>
    <div class="qa-row">
      <button class="qa-tile t-blue" id="qaStaff"><span class="ic">${I('userPlus')}</span><span><b>Register staff</b><small>Nurses, technicians…</small></span></button>
      <button class="qa-tile t-green" id="qaAdmin"><span class="ic">${I('shield')}</span><span><b>Add doctor or manager</b><small>Hospital sign-in</small></span></button>
    </div>
    <div class="sec-title">Recently registered staff</div>
    ${recent.length ? `<div class="list">${recent.map(staffCard).join('')}</div>`
      : emptyState('users', 'blue', 'No staff registered yet', 'Start by registering nurses, technicians and the front desk.')}
  `;
  // Staff tiles open the Staff list; patient-account tiles open the Patient Accounts report
  $$('.kpi').forEach(b => {
    b.onclick = () => {
      buzz();
      const g = b.dataset.go;
      if (g.startsWith('rep:')) openReports({ type: 'patients', preset: g.slice(4) }); else go(g);
    };
  });
  $$('.op-panel .mini button').forEach(b => { b.onclick = () => { S.tokenDate = today(); S.tokenStatus = b.dataset.st; go('tokens'); }; });
  bindTokenCards($('.op-panel'));
  bindPendingBanner();
  $('#insBtn').onclick = () => go('insights');
  $('#repHome').onclick = () => openReports({ type: 'tokens', preset: 'today' });
  $('#qaStaff').onclick = () => staffForm();
  $('#qaAdmin').onclick = () => addAdminSheet();
  bindCards($('#page'));
}
const headRep = id => `<button class="head-rep" id="${id}">${I('download')}<span>Report</span></button>`;
const reportsCta = () => `<button class="ins-cta rep-cta" id="repHome"><span class="rep-doc">${I('note')}</span><span><b>Reports</b><small>PDF registers and summaries for any period</small></span>${I('chevron')}</button>`;
const insightsCta = () => `<button class="ins-cta" id="insBtn"><span class="ins-spark"><i></i><i></i><i></i><i></i><i></i></span><span><b>Insights</b><small>Trends, peak hours, doctor workload and more</small></span>${I('chevron')}</button>`;
// Today's OP summary on the doctor/manager home; doctors also see who is waiting for them
// Patient app bookings waiting for the hospital to accept them
function pendingBanner() {
  const n = Store.db.tokens.filter(t => t.status === 'Pending').length;
  if (!n) return '';
  return `<button class="pending-banner" data-pending>${I('lock')}<span><b>${n} patient booking${n === 1 ? '' : 's'} awaiting confirmation</b><small>Token number${n === 1 ? ' is' : 's are'} held until you accept or reject</small></span>${I('chevron')}</button>`;
}
function bindPendingBanner() {
  $$('[data-pending]').forEach(b => { b.onclick = () => { S.tokenStatus = 'Pending'; S.tokenDate = today(); go('tokens'); }; });
}
function opPanel() {
  const list = tokensOn(today());
  const c = tokenCounts(list);
  const mine = isDoctor() ? list.filter(t => (t.doctorId === S.user.id || !t.doctorId) && (t.status === 'Waiting' || t.status === 'In consultation')).slice(0, 4) : [];
  return `<div class="op-panel">
    ${pendingBanner()}
    <div class="sec-title">Today's OP · ${fmtDate(today())}</div>
    ${miniStats(c)}
    ${isDoctor() && mine.length ? `<div class="sec-title" style="margin-top:4px">Waiting for you</div><div class="list">${mine.map(tokenCard).join('')}</div>` : ''}
  </div>`;
}
// Compact light-coloured count tile on the home screen; opens its list (which has a back arrow)
const kpiTile = (goTo, icon, color, num, cap) =>
  `<button class="kpi k-${color}" data-go="${goTo}"><span class="ic">${I(icon)}</span><b class="${String(num).length > 3 ? 'long' : ''}">${num}</b><small>${cap}</small></button>`;
const emptyState = (icon, color, title, text, btn = '') =>
  `<div class="empty"><div class="ic ${color}">${I(icon)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${btn}</div>`;

function bindCards(root) {
  $$('.card[data-staff]', root).forEach(c => { c.onclick = () => staffDetail(c.dataset.staff); });
}

/* ---------- Tab: Staff ---------- */
const staffCard = (s, i = 0) => `
  <button class="card" data-staff="${esc(s.id)}" style="animation-delay:${Math.min(i, 8) * 30}ms">
    ${avatar(s.name)}
    <div class="meta"><div class="nm">${esc(s.name)}</div><div class="sub">${esc(s.role)}${s.department ? ' · ' + esc(s.department) : ''}</div></div>
    <div class="side"><span class="id">${esc(s.id)}</span><span class="badge ${(STATUS_STYLE[s.status] || STATUS_STYLE.Active)[0]}">${esc(s.status || 'Active')}</span></div>
  </button>`;

function renderStaff() {
  const roles = ['All', ...STAFF_ROLES.filter(r => Store.db.staff.some(s => s.role === r))];
  if (!roles.includes(S.staffRole)) S.staffRole = 'All';
  $('#page').innerHTML = `
    <div class="page-head">${backBtn()}<h1>Staff</h1><span class="count">${Store.db.staff.length} registered</span>${headRep('repStaff')}</div>
    <label class="search">${I('search')}<input id="q" type="search" placeholder="Search name, ID, phone, role" value="${esc(S.staffQ)}" autocomplete="off"><button class="clear ${S.staffQ ? '' : 'hidden'}" type="button" aria-label="Clear">${I('x')}</button></label>
    ${roles.length > 2 ? `<div class="filters">${roles.map(r => `<button data-f="${esc(r)}" class="${r === S.staffRole ? 'on' : ''}">${esc(r)}</button>`).join('')}</div>` : ''}
    <div id="results"></div>`;
  $('#repStaff').onclick = () => openReports({ type: 'staff' });
  bindBack();
  bindSearch('staffQ', drawStaffList);
  $$('.filters button').forEach(b => { b.onclick = () => { S.staffRole = b.dataset.f; $$('.filters button').forEach(x => x.classList.toggle('on', x === b)); drawStaffList(); }; });
  drawStaffList();
}
function drawStaffList() {
  const q = S.staffQ.toLowerCase();
  const list = Store.db.staff
    .filter(s => S.staffRole === 'All' || s.role === S.staffRole)
    .filter(s => !q || [s.name, s.id, s.phone, s.role, s.department].some(x => String(x || '').toLowerCase().includes(q)))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const box = $('#results');
  if (!Store.db.staff.length) {
    box.innerHTML = emptyState('users', 'blue', 'No staff yet', 'Register nurses, technicians and other staff of the hospital.', `<button class="btn primary" id="emptyAdd">${I('userPlus')} Register staff</button>`);
    $('#emptyAdd').onclick = () => staffForm();
  } else if (!list.length) {
    box.innerHTML = emptyState('search', 'violet', 'No matches', 'Try a different name, ID or phone number.');
  } else {
    box.innerHTML = `<div class="list">${list.map(staffCard).join('')}</div>`;
    bindCards(box);
  }
}
function bindSearch(key, draw) {
  const input = $('#q'), clear = $('.search .clear');
  input.oninput = () => { S[key] = input.value.trim(); clear.classList.toggle('hidden', !input.value); draw(); };
  clear.onclick = () => { input.value = ''; S[key] = ''; clear.classList.add('hidden'); draw(); input.focus(); };
}

function staffForm(existing) {
  const s = existing || { gender: 'Female', shift: 'Morning', status: 'Active', joinDate: today() };
  const sheet = openSheet({
    full: true,
    html: `
      <div class="sheet-head"><button class="icon-btn" data-close aria-label="Close">${I('x')}</button><h2>${existing ? 'Edit staff' : 'Register staff'}</h2>${existing ? `<span class="chip">${esc(s.id)}</span>` : ''}</div>
      <form class="sheet-body" id="staffForm" novalidate>
        ${F.section('Personal details')}
        ${F.text('name', 'Full name', { req: true, icon: 'user', ph: 'e.g. Priya Nair', max: 60, value: s.name })}
        ${F.seg('gender', 'Gender', GENDERS, { value: s.gender })}
        <div class="row2">
          ${F.text('phone', 'Phone', { req: true, icon: 'phone', type: 'tel', mode: 'tel', ph: 'Mobile number', max: 15, value: s.phone })}
          ${F.text('email', 'Email', { icon: 'mail', type: 'email', mode: 'email', ph: 'Optional', max: 80, value: s.email })}
        </div>
        ${F.area('address', 'Address', { ph: 'House, street, city', max: 200, value: s.address })}
        ${F.section('Job details')}
        ${F.select('role', 'Staff role', STAFF_ROLES, { req: true, icon: 'briefcase', ph: 'Select a role', value: s.role })}
        ${F.select('department', 'Department', DEPARTMENTS, { icon: 'building', ph: 'Select a department', value: s.department })}
        <div class="row2">
          ${F.text('joinDate', 'Date of joining', { icon: 'calendar', type: 'date', value: s.joinDate, attrs: `max="${today()}"` })}
          ${F.text('qualification', 'Qualification', { icon: 'grad', ph: 'e.g. B.Sc Nursing', max: 60, value: s.qualification })}
        </div>
        ${F.seg('shift', 'Shift', SHIFTS, { value: s.shift, wrap: true })}
        ${F.seg('status', 'Status', STAFF_STATUS, { value: s.status })}
        ${F.section('App sign-in')}
        ${F.seg('loginEnabled', 'Can sign in to the app', [['Yes', 'check'], ['No', 'ban']], { value: s.login && s.login.enabled ? 'Yes' : existing ? 'No' : 'Yes' })}
        <div class="login-fields">
          <p class="hint">${I('ticket')} Staff who can sign in can issue and manage OP tokens.</p>
          ${F.text('username', 'Username', { icon: 'at', ph: 'e.g. priya', max: 20, value: s.login ? s.login.username : '', attrs: 'autocapitalize="none" spellcheck="false"' })}
          ${F.text('password', s.login ? 'New password' : 'Password', { icon: 'lock', type: 'password', ph: s.login ? 'Leave blank to keep the current one' : 'At least 6 characters', max: 64, auto: 'new-password' })}
        </div>
      </form>
      <div class="sheet-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="saveStaff">${I('check')} ${existing ? 'Save changes' : 'Register'}</button></div>`,
  });
  const form = $('#staffForm', sheet.el);
  liveClear(form);
  const syncLogin = () => { $('.login-fields', form).classList.toggle('hidden', form.loginEnabled.value !== 'Yes'); };
  form.addEventListener('change', e => { if (e.target.name === 'loginEnabled') syncLogin(); });
  syncLogin();
  form.onsubmit = e => { e.preventDefault(); $('#saveStaff', sheet.el).click(); };
  $('#saveStaff', sheet.el).onclick = async () => {
    const v = readForm(form, {
      name: R.name,
      phone: v2 => {
        const m = R.phone()(v2);
        if (m) return m;
        const dup = Store.db.staff.find(x => x.id !== s.id && digits(x.phone).slice(-10) === digits(v2).slice(-10));
        return dup ? `Already registered to ${dup.name} (${dup.id})` : '';
      },
      email: R.email,
      role: R.req('Select a staff role'),
      joinDate: R.notFuture,
      username: (u, all) => {
        if (all.loginEnabled !== 'Yes') return '';
        if (!u) return 'Choose a username for signing in';
        if (!/^[a-z0-9._]{3,20}$/i.test(u)) return 'Use 3–20 letters, numbers, dots or underscores';
        return usernameTaken(u, s.id) ? 'This username is already taken' : '';
      },
      password: (p, all) => {
        if (all.loginEnabled !== 'Yes') return '';
        if (!p) return s.login ? '' : 'Set a password for signing in';
        return p.length < 6 ? 'Use at least 6 characters' : '';
      },
    });
    if (!v) return;
    // The server keeps the sign-in password, hashed; it is never sent back to phones
    const body = { ...v, username: (v.username || '').toLowerCase() };
    const r = await attempt($('#saveStaff', sheet.el), () => (existing ? Api.put(`/api/staff/${encodeURIComponent(s.id)}`, body) : Api.post('/api/staff', body)), form);
    if (!r) return;
    dbLine(existing ? 'update' : 'add');
    buzz('success');
    sheet.close();
    toast(existing ? 'Staff details updated' : `${v.name} registered as ${v.role}`);
    refresh();
  };
}

function staffDetail(id) {
  const s = Store.db.staff.find(x => x.id === id);
  if (!s) return;
  const st = STATUS_STYLE[s.status] || STATUS_STYLE.Active;
  const sheet = openSheet({
    html: `
      <div class="sheet-body">
        <div class="detail-top">${avatar(s.name, 'lg')}<h2>${esc(s.name)}</h2><div class="idl">${esc(s.id)}</div>
          <div class="badges"><span class="badge b-blue">${esc(s.role)}</span><span class="badge ${st[0]}">${esc(s.status || 'Active')}</span></div></div>
        <div class="quick">
          <a href="tel:${esc(digits(s.phone))}" class="ic green">${I('phone')}Call</a>
          <button class="ic blue" id="dEdit">${I('edit')}Edit</button>
          <button class="ic red" id="dDel">${I('trash')}Delete</button>
        </div>
        <div class="info">
          ${infoRow('phone', 'Phone', s.phone)}
          ${infoRow('mail', 'Email', s.email)}
          ${infoRow('building', 'Department', s.department)}
          ${infoRow('clock', 'Shift', s.shift)}
          ${infoRow('calendar', 'Joined', fmtDate(s.joinDate))}
          ${infoRow('grad', 'Qualification', s.qualification)}
          ${infoRow('user', 'Gender', s.gender)}
          ${infoRow('pin', 'Address', s.address)}
          ${infoRow('key', 'App sign-in', s.login && s.login.enabled ? '@' + s.login.username : 'No app access')}
        </div>
        <div class="stamp">Registered ${fmtDate(s.createdAt)} by ${esc(personName(s.createdBy))}${s.updatedAt ? ` · edited ${fmtDate(s.updatedAt)}` : ''}</div>
      </div>`,
  });
  $('#dEdit', sheet.el).onclick = () => { sheet.close(); staffForm(s); };
  $('#dDel', sheet.el).onclick = async () => {
    const ok = await confirmDialog({ title: 'Delete staff record?', message: `${s.name} (${s.id}) will be removed permanently.`, ok: 'Delete', danger: true, icon: 'trash' });
    if (!ok) return;
    if (!(await attempt(null, () => Api.del(`/api/staff/${encodeURIComponent(s.id)}`)))) return;
    dbLine('delete');
    sheet.close();
    toast('Staff record deleted');
    refresh();
  };
}
const infoRow = (icon, label, value) => (value ? `<div class="ir">${I(icon)}<span>${esc(label)}<b>${esc(value)}</b></span></div>` : '');

/* ---------- OP tokens ----------
   Staff issue tokens at the front desk. Each token number is the date as ddmmyy
   plus that day's running count, e.g. 151026-007 is the 7th OP token on 15 Oct 2026. */
// 'Pending' = booked by a patient in the app, number reserved (frozen) until the hospital accepts it
const TOKEN_STATUS = ['Pending', 'Waiting', 'In consultation', 'Completed', 'Cancelled'];
const statusLabel = s => (s === 'Pending' ? 'Awaiting confirmation' : s);
const TOKEN_STYLE = {
  Pending: ['b-violet', 'violet', 'lock'],
  Waiting: ['b-amber', 'amber', 'clock'],
  'In consultation': ['b-blue', 'blue', 'stetho'],
  Completed: ['b-green', 'green', 'checkCircle'],
  Cancelled: ['b-grey', 'grey', 'ban'],
};
const VISIT_TYPES = ['New', 'Follow-up', 'Emergency'];
const PAY_MODES = ['Cash', 'UPI', 'Card', 'Free'];

function nextToken(date) {
  const [y, m, d] = date.split('-');
  const seq = (Store.db.tokenSeq[date] || 0) + 1;
  return { seq, no: `${d}${m}${y.slice(2)}-${String(seq).padStart(3, '0')}` };
}
function addDays(date, n) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmtTime = iso => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
const dayLabel = date => (date === today() ? 'Today' : date === addDays(today(), -1) ? 'Yesterday' : new Date(date + 'T00:00:00').toLocaleDateString([], { weekday: 'long' }));
const tokensOn = date => Store.db.tokens.filter(t => t.date === date).sort((a, b) => a.seq - b.seq);
const doctorLabel = id => { const d = Store.db.doctors.find(a => a.id === id); return d ? displayName(d) : 'Any available doctor'; };
// Patients still waiting before this one for the same doctor (or the shared queue)
const aheadOf = t => Store.db.tokens.filter(x => x.date === t.date && x.status === 'Waiting' && x.seq < t.seq && (!t.doctorId || !x.doctorId || x.doctorId === t.doctorId)).length;
function tokenCounts(list) {
  const c = { total: list.length };
  TOKEN_STATUS.forEach(s => { c[s] = list.filter(t => t.status === s).length; });
  return c;
}

const tokenCard = (t, i = 0) => {
  const st = TOKEN_STYLE[t.status];
  const p = t.patient;
  return `
  <div class="card tok tk-${st[1]}" role="button" tabindex="0" data-token="${esc(t.id)}" style="animation-delay:${Math.min(i, 8) * 30}ms">
    <div class="tno"><small>TOKEN</small><b>${String(t.seq).padStart(3, '0')}</b></div>
    <div class="meta"><div class="nm">${esc(p.name)}</div>
      <div class="sub">${p.age ? esc(p.age) + ' yrs · ' : ''}${esc(p.gender || '')} · ${esc(doctorLabel(t.doctorId))}</div>${t.source === 'patient' && !isPatient() ? `<span class="by-patient">${I('user')} Booked by patient</span>` : ''}${t.status === 'Pending' && !isPatient() ? ` <span class="frozen">${I('lock')} Number held · tap to accept</span>` : ''}</div>
    <div class="side"><span class="id">${fmtTime(t.issuedAt)}</span><span class="badge ${st[0]}">${t.status === 'Pending' ? I('lock') + ' Pending' : esc(t.status)}</span><button class="tk-view" data-view="${esc(t.id)}" aria-label="View token">${I('ticket')} View</button></div>
  </div>`;
};
function bindTokenCards(root) {
  $$('.card[data-token]', root).forEach(c => { c.onclick = () => tokenDetail(c.dataset.token); });
  // 'View token' opens the printable slip without opening the details
  $$('.tk-view', root).forEach(b => { b.onclick = e => { e.stopPropagation(); buzz(); viewToken(b.dataset.view); }; });
}
const miniStats = c => `
  <div class="mini">
    <button data-st="All"><b>${c.total}</b><span>Total</span></button>
    <button data-st="Waiting" class="m-amber"><b>${c.Waiting}</b><span>Waiting</span></button>
    <button data-st="In consultation" class="m-blue"><b>${c['In consultation']}</b><span>With doctor</span></button>
    <button data-st="Completed" class="m-green"><b>${c.Completed}</b><span>Done</span></button>
  </div>`;

/* Tab: OP Tokens. Staff see today; doctors and managers can move through dates. */
function renderTokens() {
  const date = isStaff() ? today() : S.tokenDate || today();
  const list = tokensOn(date);
  const c = tokenCounts(list);
  const canBrowse = !isStaff();
  $('#page').innerHTML = `
    <div class="page-head">${backBtn()}<h1>OP Tokens</h1><span class="count">${dayLabel(date)}</span>${headRep('repTok')}</div>
    ${canBrowse ? `
    <div class="datebar">
      <button class="icon-btn" id="dPrev" aria-label="Previous day">${I('chevL')}</button>
      <label class="datepick">${I('calendar')}<span>${fmtDate(date)}</span><input type="date" id="dPick" value="${date}" max="${today()}"></label>
      <button class="icon-btn" id="dNext" aria-label="Next day" ${date >= today() ? 'disabled' : ''}>${I('chevron')}</button>
      ${date !== today() ? `<button class="btn soft today-btn" id="dToday">Today</button>` : ''}
    </div>` : `
    <button class="issue-cta" id="issueBtn">${I('ticket')}<span><b>Issue OP token</b><small>Next number ${esc(nextToken(today()).no)}</small></span>${I('chevron')}</button>`}
    ${miniStats(c)}
    <label class="search">${I('search')}<input id="q" type="search" placeholder="Search patient, phone or token no." value="${esc(S.tokenQ)}" autocomplete="off"><button class="clear ${S.tokenQ ? '' : 'hidden'}" type="button" aria-label="Clear">${I('x')}</button></label>
    <div class="filters">
      ${['All', ...TOKEN_STATUS].map(s => `<button data-f="${esc(s)}" class="${s === S.tokenStatus ? 'on' : ''}">${esc(s)}</button>`).join('')}
      ${isDoctor() ? `<button data-mine class="${S.tokenMine ? 'on' : ''}">${I('stetho')} My patients</button>` : ''}
    </div>
    <div id="results"></div>`;

  if (canBrowse) {
    const setDate = d => { S.tokenDate = d > today() ? today() : d; buzz(); renderTokens(); };
    $('#dPrev').onclick = () => setDate(addDays(date, -1));
    $('#dNext').onclick = () => setDate(addDays(date, 1));
    $('#dPick').onchange = e => { if (e.target.value) setDate(e.target.value); };
    if ($('#dToday')) $('#dToday').onclick = () => setDate(today());
  } else {
    $('#issueBtn').onclick = () => tokenForm();
  }
  const setStatus = st => { S.tokenStatus = st; $$('.filters [data-f]').forEach(x => x.classList.toggle('on', x.dataset.f === st)); drawTokenList(date); };
  $$('.mini button').forEach(b => { b.onclick = () => setStatus(b.dataset.st); });
  $$('.filters [data-f]').forEach(b => { b.onclick = () => setStatus(b.dataset.f); });
  const mine = $('.filters [data-mine]');
  if (mine) mine.onclick = () => { S.tokenMine = !S.tokenMine; mine.classList.toggle('on', S.tokenMine); drawTokenList(date); };
  $('#repTok').onclick = () => openReports({ type: 'tokens', preset: date === today() ? 'today' : 'custom', from: date, to: date, filters: S.tokenStatus !== 'All' ? { status: S.tokenStatus } : {} });
  bindBack();
  bindSearch('tokenQ', () => drawTokenList(date));
  drawTokenList(date);
}
function drawTokenList(date) {
  const q = S.tokenQ.toLowerCase();
  const all = tokensOn(date);
  const list = all
    .filter(t => S.tokenStatus === 'All' || t.status === S.tokenStatus)
    .filter(t => !S.tokenMine || !isDoctor() || t.doctorId === S.user.id || !t.doctorId)
    .filter(t => !q || [t.patient.name, t.patient.phone, t.id].some(x => String(x || '').toLowerCase().includes(q)));
  const box = $('#results');
  if (!all.length) {
    const msg = isStaff() ? 'Issue the first OP token of the day.' : date === today() ? 'Tokens issued by the front desk today will appear here.' : `No OP tokens were issued on ${fmtDate(date)}.`;
    box.innerHTML = emptyState('ticket', 'amber', 'No tokens yet', msg, isStaff() ? `<button class="btn primary" id="emptyAdd">${I('ticket')} Issue OP token</button>` : '');
    if ($('#emptyAdd')) $('#emptyAdd').onclick = () => tokenForm();
  } else if (!list.length) {
    box.innerHTML = emptyState('search', 'violet', 'No matching tokens', 'Try another status filter or search.');
  } else {
    box.innerHTML = `<div class="list">${list.map(tokenCard).join('')}</div>`;
    bindTokenCards(box);
  }
}

/* Issue (or edit) an OP token */
function tokenForm(existing) {
  const t = existing || { patient: { gender: 'Male' }, visitType: 'New', payMode: 'Cash', doctorId: doctors().length === 1 ? doctors()[0].id : '' };
  const p = t.patient;
  const docOpts = doctors().map(d => `<option value="${esc(d.id)}" ${d.id === t.doctorId ? 'selected' : ''}>${esc(displayName(d))}${d.title ? ' · ' + esc(d.title) : ''}</option>`).join('');
  const preview = existing ? existing.id : nextToken(today()).no;
  const sheet = openSheet({
    full: true,
    html: `
      <div class="sheet-head"><button class="icon-btn" data-close aria-label="Close">${I('x')}</button><h2>${existing ? 'Edit OP token' : 'Issue OP token'}</h2><span class="chip">${I('ticket')}${esc(preview)}</span></div>
      <form class="sheet-body" id="tokenForm" novalidate>
        ${existing ? '' : `
        <label class="search lookup">${I('search')}<input id="lookup" type="search" placeholder="Find returning patient: phone or name" autocomplete="off"></label>
        <div id="lookRes" class="look-res"></div>`}
        ${F.section('Patient details')}
        ${F.text('name', 'Patient name', { req: true, icon: 'user', ph: 'Full name', max: 60, value: p.name })}
        <div class="row2">
          ${F.text('age', 'Age (years)', { req: true, icon: 'calendar', type: 'number', mode: 'numeric', ph: 'e.g. 34', max: 3, value: p.age, attrs: 'min="0" max="120"' })}
          ${F.text('phone', 'Phone', { req: true, icon: 'phone', type: 'tel', mode: 'tel', ph: 'Mobile number', max: 15, value: p.phone })}
        </div>
        ${F.seg('gender', 'Gender', GENDERS, { req: true, value: p.gender })}
        ${F.section('Visit')}
        <label class="field"><span class="lbl">Consulting doctor <i>*</i></span>
          <div class="ctl sel">${I('stetho')}<select name="doctorId"><option value="">Any available doctor</option>${docOpts}</select></div><small class="err"></small></label>
        ${F.seg('visitType', 'Visit type', VISIT_TYPES, { value: t.visitType })}
        ${F.area('complaint', 'Complaint / reason for visit', { ph: 'e.g. Fever for 3 days, headache', max: 300, value: t.complaint })}
        ${F.section('Vitals (optional)')}
        <div class="row2">
          ${F.text('weight', 'Weight (kg)', { icon: 'activity', type: 'number', mode: 'decimal', ph: 'e.g. 68', max: 5, value: t.vitals && t.vitals.weight })}
          ${F.text('temp', 'Temperature (°F)', { icon: 'thermo', type: 'number', mode: 'decimal', ph: 'e.g. 98.6', max: 5, value: t.vitals && t.vitals.temp })}
        </div>
        <div class="row2">
          ${F.text('bp', 'Blood pressure', { icon: 'heart', ph: 'e.g. 120/80', max: 9, value: t.vitals && t.vitals.bp })}
          ${F.text('pulse', 'Pulse (bpm)', { icon: 'activity', type: 'number', mode: 'numeric', ph: 'e.g. 72', max: 3, value: t.vitals && t.vitals.pulse })}
        </div>
        ${F.section('Payment')}
        <div class="row2">
          ${F.text('fee', 'OP fee (₹)', { icon: 'rupee', type: 'number', mode: 'numeric', ph: 'e.g. 200', max: 6, value: t.fee })}
          <div></div>
        </div>
        ${F.seg('payMode', 'Paid by', PAY_MODES, { value: t.payMode })}
      </form>
      <div class="sheet-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="saveToken">${I('ticket')} ${existing ? 'Save changes' : 'Issue token'}</button></div>`,
  });
  const form = $('#tokenForm', sheet.el);
  liveClear(form);

  // Returning-patient lookup: anyone who had a token before
  const look = $('#lookup', form);
  if (look) {
    look.oninput = () => {
      const q = look.value.trim().toLowerCase();
      const qd = digits(q);
      const box = $('#lookRes', form);
      if (q.length < 2) { box.innerHTML = ''; return; }
      const seen = new Set();
      const hits = [];
      const consider = (name, phone, age, gender, src) => {
        const key = `${name.toLowerCase()}|${digits(phone).slice(-10)}`;
        if (seen.has(key)) return;
        const match = name.toLowerCase().includes(q) || (qd.length >= 3 && digits(phone).includes(qd));
        if (!match) return;
        seen.add(key);
        hits.push({ name, phone, age, gender, src });
      };
      [...Store.db.tokens].reverse().forEach(x => consider(x.patient.name, x.patient.phone, x.patient.age, x.patient.gender, `Last visit ${fmtDate(x.date)}`));
      box.innerHTML = hits.slice(0, 4).map((h, i) => `<button type="button" class="look-hit" data-i="${i}">${avatar(h.name, 'sm')}<span><b>${esc(h.name)}</b><small>${esc(h.phone)} · ${esc(h.src)}</small></span>${I('plus')}</button>`).join('') ||
        `<div class="look-none">No match. Fill in the details below for a new patient.</div>`;
      $$('.look-hit', box).forEach(b => {
        b.onclick = () => {
          const h = hits[+b.dataset.i];
          form.name.value = h.name;
          form.phone.value = h.phone || '';
          if (h.age !== null && h.age !== undefined && h.age !== '') form.age.value = h.age;
          $$('[name="gender"]', form).forEach(r => { r.checked = r.value === h.gender; });
          $$('[name="visitType"]', form).forEach(r => { r.checked = r.value === 'Follow-up'; });
          look.value = '';
          box.innerHTML = '';
          $$('.field.invalid', form).forEach(f => f.classList.remove('invalid'));
          buzz();
        };
      });
    };
  }

  form.onsubmit = e => { e.preventDefault(); $('#saveToken', sheet.el).click(); };
  $('#saveToken', sheet.el).onclick = async () => {
    const v = readForm(form, {
      name: R.name,
      age: a => (a === '' ? 'Enter the age' : +a < 0 || +a > 120 ? 'Enter an age between 0 and 120' : ''),
      phone: ph => {
        const m = R.phone()(ph);
        if (m) return m;
        // A mobile number can hold only one active token per day (desk or patient app)
        const clash = activeTokenFor(ph, existing ? existing.date : today(), existing && existing.id);
        return clash ? `Token ${clash.id} is already booked for this number today (${clash.patient.name})` : '';
      },
      gender: R.req('Select a gender'),
      bp: b => (!b || /^\d{2,3}\/\d{2,3}$/.test(b) ? '' : 'Use the format 120/80'),
      fee: f => (f === '' || +f >= 0 ? '' : 'Fee cannot be negative'),
    });
    if (!v) return;
    // The server gives out the token number, so two desks can never issue the same one,
    // and links the token to the patient's app account by phone number
    const r = await attempt($('#saveToken', sheet.el), () => (existing ? Api.put(`/api/tokens/${encodeURIComponent(existing.id)}`, v) : Api.post('/api/tokens', v)), form);
    if (!r) return;
    const tok = r.record;
    dbLine(existing ? 'update' : 'add');
    buzz('success');
    sheet.close();
    refresh();
    if (existing) toast(`Token ${tok.id} updated`);
    else { tokenSlip(tok); if (tok.patient.phone) setTimeout(() => askWhatsApp(tok), 700); }
  };
}

/* The slip shown after a token is issued */
function tokenSlip(t) {
  const ahead = aheadOf(t);
  openSheet({
    html: `
      <div class="sheet-body">
        <div class="slip">
          <div class="slip-top">${LOGO_PRINT}</div>
          <div class="slip-label">OP TOKEN</div>
          <div class="slip-seq">${String(t.seq).padStart(3, '0')}</div>
          <div class="slip-no">${esc(t.id)}</div>
          <div class="slip-cut"></div>
          <div class="slip-rows">
            <div><span>Patient</span><b>${esc(t.patient.name)}</b></div>
            <div><span>Age / gender</span><b>${esc(t.patient.age)} yrs · ${esc(t.patient.gender)}</b></div>
            <div><span>Doctor</span><b>${esc(doctorLabel(t.doctorId))}</b></div>
            <div><span>Issued</span><b>${fmtDate(t.date)}, ${fmtTime(t.issuedAt)}</b></div>
            ${t.fee ? `<div><span>OP fee</span><b>₹${esc(t.fee)} · ${esc(t.payMode)}</b></div>` : ''}
          </div>
          ${t.status === 'Pending'
            ? `<div class="slip-wait violet">${I('lock')} Number reserved for you. The hospital will confirm your booking shortly.</div>`
            : `<div class="slip-wait">${ahead ? `${ahead} patient${ahead === 1 ? '' : 's'} ahead in the queue` : 'Next in the queue'}</div>`}
        </div>
      </div>
      <div class="sheet-foot"><button class="btn ghost" data-close>Done</button><button class="btn primary" id="another">${I('ticket')} Issue another</button></div>`,
    onMount: (el, api) => { const b = $('#another', el); if (isPatient()) b.remove(); else b.onclick = () => { api.close(); tokenForm(); }; },
  });
  Sound.play('token');
  toast(t.status === 'Pending' ? `Token ${t.id} reserved, awaiting confirmation` : `Token ${t.id} issued to ${t.patient.name}`);
}

/* Token details, with status actions for doctors (consult) and front desk (cancel/edit) */
function tokenDetail(id) {
  const t = Store.db.tokens.find(x => x.id === id);
  if (!t) return;
  const st = TOKEN_STYLE[t.status];
  const p = t.patient;
  const v = t.vitals || {};
  const vitals = [v.weight && `${v.weight} kg`, v.temp && `${v.temp} °F`, v.bp && `BP ${v.bp}`, v.pulse && `Pulse ${v.pulse}`].filter(Boolean).join(' · ');
  const doc = isDoctor();
  const canDesk = (isStaff() || (S.kind === 'admin' && !doc)) && t.status === 'Waiting';
  // Any hospital user (doctor, manager, staff) confirms or rejects an app booking
  const canConfirm = !isPatient() && t.status === 'Pending';
  // Patients can cancel their own token while it is still pending or waiting today
  const patCancel = isPatient() && (t.status === 'Waiting' || t.status === 'Pending') && t.date === today();
  const timeline = [
    ['ticket', t.source === 'patient' ? `Booked by patient (${p.name}) in the app` : `Issued by ${personName(t.issuedBy)}`, t.issuedAt],
    t.acceptedAt && ['checkCircle', `Booking accepted by ${personName(t.acceptedBy)}`, t.acceptedAt],
    t.calledAt && ['stetho', `Consultation started${t.consultedBy ? ' by ' + personName(t.consultedBy) : ''}`, t.calledAt],
    t.completedAt && ['checkCircle', 'Consultation completed', t.completedAt],
    t.cancelledAt && ['ban', `${t.rejected ? 'Booking rejected' : 'Cancelled'} by ${personName(t.cancelledBy)}${t.cancelReason ? ': ' + t.cancelReason : ''}`, t.cancelledAt],
  ].filter(Boolean);

  const sheet = openSheet({
    html: `
      <div class="sheet-body">
        <div class="tok-head tk-${st[1]}">
          <div class="tno big"><small>TOKEN</small><b>${String(t.seq).padStart(3, '0')}</b></div>
          <div><h2>${esc(p.name)}</h2><div class="idl">${esc(t.id)} · ${fmtDate(t.date)}</div><span class="badge ${st[0]}">${I(st[2])} ${esc(statusLabel(t.status))}</span>${t.source === 'patient' && !isPatient() ? ` <span class="by-patient">${I('user')} Booked by patient</span>` : ''}</div>
        </div>
        ${canConfirm ? `
          <div class="confirm-box">${I('lock')}<div><b>Token number ${String(t.seq).padStart(3, '0')} is held for this patient</b><span>Booked in the patient app. Accept it to add the patient to the queue, or reject it to release the booking.</span></div></div>
          <div class="act-row"><button class="btn danger-soft" id="tReject">${I('ban')} Reject</button><button class="btn primary" id="tAccept">${I('checkCircle')} Accept</button></div>` : ''}
        ${isPatient() && t.status === 'Pending' ? `<div class="confirm-box">${I('lock')}<div><b>Waiting for the hospital to confirm</b><span>Your token number is reserved. You will join the queue once the hospital accepts your booking.</span></div></div>` : ''}
        ${isPatient() && t.rejected ? `<div class="confirm-box grey">${I('ban')}<div><b>Booking not accepted</b><span>The hospital could not accept this booking${t.cancelReason && t.cancelReason !== 'Not accepted by the hospital' ? `: ${esc(t.cancelReason)}` : ''}. Please contact the reception.</span></div></div>` : ''}
        ${doc && t.status === 'Waiting' ? `<button class="btn primary block act" id="tStart">${I('play')} Start consultation</button>` : ''}
        ${doc && (t.status === 'In consultation' || t.status === 'Completed') ? `
          <label class="field"><span class="lbl">Consultation notes</span><div class="ctl"><textarea id="tNotes" maxlength="1000" placeholder="Diagnosis, prescription, advice">${esc(t.doctorNotes)}</textarea></div></label>
          ${t.status === 'In consultation'
            ? `<div class="act-row"><button class="btn ghost" id="tBack">${I('undo')} Back to queue</button><button class="btn primary" id="tDone">${I('checkCircle')} Complete</button></div>`
            : `<button class="btn soft block act" id="tSaveNotes">${I('check')} Save notes</button>`}` : ''}
        <div class="act-row"><button class="btn soft" id="tView">${I('ticket')} View token</button>${isPatient() ? `<button class="btn ghost" id="tPdf">${I('download')} PDF</button>` : t.status === 'Pending' ? '' : `<button class="btn wa-btn" id="tWa">${I('whatsapp')} WhatsApp</button>`}</div>
        ${patCancel ? `<button class="btn danger-soft block act" id="tCancel">${I('ban')} Cancel my token</button>` : ''}
        ${canDesk ? `<div class="act-row"><button class="btn ghost" id="tEdit">${I('edit')} Edit</button><button class="btn danger-soft" id="tCancel">${I('ban')} Cancel token</button></div>` : ''}
        <div class="info">
          ${infoRow('user', 'Age / gender', `${p.age} yrs · ${p.gender}`)}
          ${infoRow('phone', 'Phone', p.phone)}
          ${infoRow('stetho', 'Doctor', doctorLabel(t.doctorId))}
          ${infoRow('note', 'Visit', [t.visitType, t.complaint].filter(Boolean).join(': '))}
          ${infoRow('activity', 'Vitals', vitals)}
          ${infoRow('rupee', 'OP fee', t.fee ? `₹${t.fee} · ${t.payMode}` : '')}
          ${!doc ? infoRow('note', 'Doctor\'s notes', t.doctorNotes) : ''}
        </div>
        <div class="timeline">${timeline.map(([ic, txt, at]) => `<div class="tl">${I(ic)}<span>${esc(txt)}</span><time>${fmtTime(at)}</time></div>`).join('')}</div>
      </div>`,
  });
  const el = sheet.el;
  // Sends a status change to the server; if someone else changed the token first, the server says so
  const act = async (action, msg, fx = 'update', body = {}, btn) => {
    let r;
    if (btn) busy(btn, true);
    try { r = await Api.post(`/api/tokens/${encodeURIComponent(t.id)}/${action}`, body); } catch (e) {
      if (btn) busy(btn, false);
      showError(e);
      // Changed on another phone meanwhile: show the token as it is now
      if (e.code === 'STALE') { sheet.close(); refresh(); }
      return null;
    }
    dbLine(fx);
    buzz('success');
    sheet.close();
    toast(msg);
    refresh();
    return r.record;
  };
  const notes = () => ({ notes: $('#tNotes', el).value.trim() });
  const on = (sel, fn) => { const b = $(sel, el); if (b) b.onclick = () => fn(b); };
  on('#tStart', b => act('start', `Consultation started for ${p.name}`, 'update', {}, b));
  on('#tBack', b => act('back', `${p.name} moved back to the queue`, 'update', notes(), b));
  on('#tDone', b => act('complete', `Token ${t.id} completed`, 'update', notes(), b));
  on('#tSaveNotes', b => act('notes', 'Notes saved', 'update', notes(), b));
  on('#tAccept', async b => {
    const rec = await act('accept', `Token ${t.id} confirmed for ${p.name}`, 'update', {}, b);
    if (rec && rec.patient.phone) setTimeout(() => askWhatsApp(rec), 500);
  });
  on('#tReject', () => {
    const s2 = openSheet({
      dialog: true,
      html: `
        <button class="icon-btn dlg-x" data-close aria-label="Close">${I('x')}</button>
        <div class="ic red">${I('ban')}</div>
        <h2>Reject booking ${esc(t.id)}?</h2>
        <p>${esc(p.name)} will be told the booking was not accepted. The token number is not reused.</p>
        <label class="field" style="text-align:left"><span class="lbl">Reason (optional)</span><div class="ctl"><input id="rjReason" maxlength="120" placeholder="e.g. Doctor on leave today"></div></label>
        <div class="acts"><button class="btn ghost" data-close>Keep</button><button class="btn danger" id="rjGo">Reject</button></div>`,
    });
    $('#rjGo', s2.el).onclick = () => {
      const reason = $('#rjReason', s2.el).value.trim();
      s2.close();
      act('reject', `Booking ${t.id} rejected`, 'delete', { reason });
    };
  });
  on('#tEdit', () => { sheet.close(); tokenForm(t); });
  on('#tView', () => viewToken(t.id));
  on('#tWa', () => sendTokenWhatsApp(t));
  on('#tPdf', async () => { const sv = await saveTokenPdf(t); if (sv.uri) openPdf(sv.uri); else toast('Token PDF downloaded'); });
  on('#tCancel', async () => {
    const ok = await confirmDialog({ title: `Cancel token ${t.id}?`, message: isPatient() ? "You will be removed from today's queue. Only one booking is allowed per day, so you will not be able to book again today." : `${p.name} will be removed from today's queue. The token number is not reused.`, ok: 'Cancel token', danger: true, icon: 'ban' });
    if (!ok) return;
    act('cancel', `Token ${t.id} cancelled`, 'delete');
  });
}

/* Home screen for staff: the token desk */
function renderStaffHome() {
  const u = S.user;
  const list = tokensOn(today());
  const c = tokenCounts(list);
  const queue = list.filter(t => t.status === 'Waiting' || t.status === 'In consultation').slice(0, 6);
  $('#page').innerHTML = `
    <section class="hello">
      <p>${greeting()},</p>
      <h1>${esc(u.name)}</h1>
      <span class="chip">${I('briefcase')}${esc(u.role)}${u.department ? ' · ' + esc(u.department) : ''}</span>
    </section>
    <button class="issue-cta big" id="issueBtn">${I('ticket')}<span><b>Issue OP token</b><small>Next number ${esc(nextToken(today()).no)}</small></span>${I('chevron')}</button>
    ${pendingBanner()}
    <div class="sec-title">Today · ${fmtDate(today())}</div>
    ${miniStats(c)}
    ${insightsCta()}
    ${reportsCta()}
    <div class="sec-title">In the queue <button id="allTok">View all</button></div>
    ${queue.length ? `<div class="list">${queue.map(tokenCard).join('')}</div>`
      : emptyState('ticket', 'amber', 'Queue is empty', list.length ? 'Everyone issued a token today has been seen.' : 'No OP tokens issued yet today.')}
    <div class="qa-row" style="margin-top:20px">
      <button class="qa-tile t-green" id="qaFind"><span class="ic">${I('search')}</span><span><b>Find a token</b><small>Name, phone or number</small></span></button>
      <button class="qa-tile t-violet" id="qaTok"><span class="ic">${I('ticket')}</span><span><b>All tokens</b><small>Today's list</small></span></button>
    </div>`;
  $('#issueBtn').onclick = () => tokenForm();
  $('#allTok').onclick = () => go('tokens');
  bindPendingBanner();
  $('#insBtn').onclick = () => go('insights');
  $('#repHome').onclick = () => openReports({ type: 'tokens', preset: 'today' });
  $('#qaTok').onclick = () => go('tokens');
  $('#qaFind').onclick = () => { buzz(); openSearch(); };
  $$('.mini button').forEach(b => { b.onclick = () => { S.tokenStatus = b.dataset.st; go('tokens'); }; });
  bindTokenCards($('#page'));
}

/* ---------- Themes ----------
   The choice is per device: saved in Preferences (and mirrored to localStorage so
   index.html can apply it before the first paint). Styles live in themes.css. */
const THEMES = [
  { id: 'default', name: 'Default', desc: 'Soft shadows and the Prime Care colours', bar: '#ffffff', darkBar: '#0b1220',
    pv: { bg: '#f5f7fb', card: 'background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(15,23,42,.08)', btn: 'background:linear-gradient(120deg,#60a5fa,#818cf8,#a78bfa);border-radius:8px' } },
  { id: 'neu', name: 'Neumorphism', desc: 'Soft surfaces that look pressed out of the page', bar: '#e4e9f0', darkBar: '#1d2330',
    pv: { bg: '#e4e9f0', card: 'background:#e4e9f0;border-radius:12px;box-shadow:4px 4px 8px #c2cad6,-4px -4px 8px #fff', btn: 'background:#e4e9f0;border-radius:10px;box-shadow:inset 3px 3px 6px #c2cad6,inset -3px -3px 6px #fff' } },
  { id: 'flat', name: 'Flat Design', desc: 'Solid colours, no shadows, crisp corners', bar: '#ffffff', darkBar: '#1a2230',
    pv: { bg: '#eef1f5', card: 'background:#fff;border-radius:4px', btn: 'background:#2563eb;border-radius:4px' } },
  { id: 'material', name: 'Material Design', desc: 'Google Material 3: tonal colours, pill buttons', bar: '#fef7ff', darkBar: '#141218',
    pv: { bg: '#fef7ff', card: 'background:#f3edf7;border-radius:12px', btn: 'background:#6750a4;border-radius:12px' } },
  { id: 'bento', name: 'Bento UI', desc: 'Rounded tiles of different sizes in a grid', bar: '#f3f1ec', darkBar: '#111111',
    pv: { bg: '#f3f1ec', card: 'background:#dbeafe;border-radius:14px', card2: 'background:#dcfce7;border-radius:14px', btn: 'background:#18181b;border-radius:12px' } },
];
const Theme = {
  current: 'default',
  apply(id) {
    const t = THEMES.find(x => x.id === id) || THEMES[0];
    this.current = t.id;
    if (t.id === 'default') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t.id;
    try { localStorage.setItem('pc-theme', t.id); } catch (e) { /* private mode */ }
    const dark = document.documentElement.dataset.mode === 'dark';
    const bar = dark ? t.darkBar : t.bar;
    $('meta[name="theme-color"]').setAttribute('content', bar);
    call('StatusBar', 'setBackgroundColor', { color: bar });
    call('StatusBar', 'setStyle', { style: dark ? 'DARK' : 'LIGHT' });
  },
  async init() {
    const r = await call('Preferences', 'get', { key: 'theme' });
    this.apply((r && r.value) || document.documentElement.dataset.theme || 'default');
  },
  choose(id) {
    this.apply(id);
    call('Preferences', 'set', { key: 'theme', value: this.current });
  },
  get name() { return (THEMES.find(x => x.id === this.current) || THEMES[0]).name; },
};
function themeSheet(onChange) {
  const preview = t => {
    const p = t.pv;
    return `<div class="tp" style="background:${p.bg}"><i style="${p.card}"></i><i style="${p.card2 || p.card}"></i>${t.id === 'default' ? `<i style="${p.card}"></i>` : ''}<i class="tp-btn" style="${p.btn}"></i></div>`;
  };
  openSheet({
    html: `
      <div class="sheet-head"><h2>Theme</h2><button class="icon-btn" data-close aria-label="Close">${I('x')}</button></div>
      <div class="sheet-body">
        <div class="form-section" style="margin-top:0">Display mode</div>
        ${modeSeg()}
        <div class="form-section">Theme</div>
        <p class="muted" style="font-size:14px;margin-bottom:14px">Tap a theme to try it. It is saved on this phone.</p>
        <div class="theme-list">${THEMES.map(t => `
          <button class="theme-opt ${t.id === Theme.current ? 'on' : ''}" data-theme-id="${t.id}">
            <span class="tick">${I('check')}</span>${preview(t)}<b>${esc(t.name)}</b><small>${esc(t.desc)}</small>
          </button>`).join('')}
        </div>
      </div>`,
    onMount: el => {
      bindModeSeg(el, onChange);
      $$('.theme-opt', el).forEach(b => {
        b.onclick = () => {
          Theme.choose(b.dataset.themeId);
          $$('.theme-opt', el).forEach(x => x.classList.toggle('on', x === b));
          buzz();
          if (onChange) onChange();
        };
      });
    },
  });
}

/* ---------- Tab: Settings ---------- */
function renderSettings() {
  const a = S.user;
  const { doctors: admins, staff, tokens } = Store.db;
  const roleLine = isStaff() ? `${a.role} · Staff` : `${a.role}${a.title ? ' · ' + a.title : ''}`;
  $('#page').innerHTML = `
    <div class="page-head"><h1>Settings</h1></div>
    <div class="profile">${avatar(a.name, 'lg')}<div><h2>${esc(displayName(a))}</h2><p>${esc(roleLine)}</p><p>@${esc(userHandle(a))} · ${esc(a.id)}</p></div></div>

    <div class="group-title">Account</div>
    <div class="group">
      ${isStaff() ? '' : row('admins', 'shield', 'blue', 'Doctors & managers', `${admins.length} account${admins.length === 1 ? '' : 's'} can sign in`)}
      ${row('password', 'key', 'violet', 'Change password', 'Update your sign-in password')}
    </div>

    <div class="group-title">Security</div>
    <div class="group">${toggleRow('fingerprint', 'fingerprint', 'green', 'Fingerprint unlock', Bio.enabledFor(S.kind, a.id) ? 'On · unlock with your fingerprint' : 'Off · sign in with your password', Bio.enabledFor(S.kind, a.id))}</div>

    <div class="group-title">Appearance</div>
    <div class="group">${row('mode', Mode.resolved() === 'dark' ? 'moon' : 'sun', 'violet', 'Display mode', Mode.name)}${row('theme', 'palette', 'blue', 'Theme', Theme.name)}${toggleRow('sounds', 'volume', 'amber', 'Sound effects', Sound.on ? 'Short sounds for taps, saves and alerts' : 'Off', Sound.on)}${row('tour', 'info', 'violet', 'App tour', 'See what Prime Care can do')}</div>

    <div class="group-title">Records</div>
    <div class="group">${row('reports', 'download', 'amber', 'Reports', 'Token registers, summaries and directories as PDF')}</div>

    <div class="group-title">Data</div>
    <div class="group">
      ${row('server', 'database', 'green', 'Online data', syncLine())}
      ${isStaff() ? '' : `
      ${row('export', 'download', 'blue', 'Download backup', 'Save or send a copy of all records as a JSON file')}
      ${row('erase', 'trash', 'red', 'Erase all data', `Delete all accounts, ${staff.length} staff, ${tokens.length} tokens for every phone`, true)}`}
    </div>

    <div class="group">${row('logout', 'logout', 'red', 'Sign out', `Signed in as @${userHandle(a)}`, true)}</div>
    <div class="version">Prime Care Hospital Management System · v${APP_VERSION}</div>`;
  const actions = {
    admins: adminsSheet,
    password: passwordSheet,
    fingerprint: () => toggleFingerprint($('.row[data-act=fingerprint]')),
    sounds: () => { Sound.set(!Sound.on); setSwitch($('.row[data-act=sounds]'), Sound.on, Sound.on ? 'Short sounds for taps, saves and alerts' : 'Off'); },
    theme: () => themeSheet(() => { $('.row[data-act=theme] small').textContent = Theme.name; }),
    mode: () => modeSheet(() => { $('.row[data-act=mode] small').textContent = Mode.name; }),
    server: serverSheet,
    export: exportBackup,
    erase: eraseAll,
    tour: () => renderTour(renderMain),
    reports: () => openReports(),
    logout: signOut,
  };
  $$('.row[data-act]').forEach(r => { r.onclick = () => actions[r.dataset.act](); });
}
const syncLine = () => (Store.syncedAt ? `Saved online · updated ${fmtTime(Store.syncedAt)}` : 'Saved online');
const row = (act, icon, color, title, sub, danger = false) =>
  `<button class="row ${danger ? 'danger' : ''}" data-act="${act}"><div class="ic ${color}">${I(icon)}</div><div class="tx"><b>${esc(title)}</b><small>${esc(sub)}</small></div>${I('chevron')}</button>`;

function adminsSheet() {
  const draw = el => {
    const q = (($('#adminQ', el) || {}).value || '').trim().toLowerCase();
    $('#adminList', el).innerHTML = Store.db.doctors.filter(a => !q || [a.name, a.username, a.phone, a.role, a.title, a.id].some(x => String(x || '').toLowerCase().includes(q))).map(a => `
      <div class="card" style="box-shadow:none;background:var(--field)">
        ${avatar(a.name)}
        <div class="meta"><div class="nm">${esc(displayName(a))}${a.id === S.user.id ? ' <span class="badge b-green">You</span>' : ''}</div><div class="sub">${esc(a.role)}${a.title ? ' · ' + esc(a.title) : ''} · @${esc(a.username)}</div></div>
        ${a.id !== S.user.id ? `<button class="icon-btn" data-del="${esc(a.id)}" aria-label="Remove">${I('trash')}</button>` : ''}
      </div>`).join('');
    $$('[data-del]', el).forEach(b => {
      b.onclick = async ev => {
        ev.stopPropagation();
        const a = Store.db.doctors.find(x => x.id === b.dataset.del);
        const ok = await confirmDialog({ title: 'Remove account?', message: `${displayName(a)} will no longer be able to sign in. Records they registered are kept.`, ok: 'Remove', danger: true, icon: 'trash' });
        if (!ok) return;
        if (!(await attempt(null, () => Api.del(`/api/doctors/${encodeURIComponent(a.id)}`)))) return;
        dbLine('delete');
        toast('Account removed');
        draw(el);
        refresh();
      };
    });
  };
  openSheet({
    html: `
      <div class="sheet-head"><h2>Doctors &amp; managers</h2><button class="icon-btn" data-close aria-label="Close">${I('x')}</button></div>
      <div class="sheet-body"><label class="search">${I('search')}<input id="adminQ" type="search" placeholder="Search name, username, phone" autocomplete="off"></label><div class="list" id="adminList"></div></div>
      <div class="sheet-foot"><button class="btn primary" id="addAdmin">${I('userPlus')} Add doctor or manager</button></div>`,
    onMount: (el, api) => {
      draw(el);
      $('#adminQ', el).oninput = () => draw(el);
      $('#addAdmin', el).onclick = () => { api.close(); addAdminSheet(); };
    },
  });
}

function addAdminSheet() {
  const sheet = openSheet({
    full: true,
    html: `
      <div class="sheet-head"><button class="icon-btn" data-close aria-label="Close">${I('x')}</button><h2>Add doctor or manager</h2></div>
      <form class="sheet-body" id="adminForm" novalidate>${adminFields()}</form>
      <div class="sheet-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="saveAdmin">${I('check')} Create account</button></div>`,
  });
  const form = $('#adminForm', sheet.el);
  bindRoleSwitch(form);
  liveClear(form);
  form.onsubmit = e => { e.preventDefault(); $('#saveAdmin', sheet.el).click(); };
  $('#saveAdmin', sheet.el).onclick = async () => {
    const v = readForm(form, adminRules);
    if (!v) return;
    const r = await attempt($('#saveAdmin', sheet.el), () => Api.post('/api/doctors', adminBody(v)), form);
    if (!r) return;
    const a = r.record;
    dbLine('add');
    buzz('success');
    sheet.close();
    toast(`${displayName(a)} can now sign in`);
    refresh();
  };
}

function passwordSheet() {
  const sheet = openSheet({
    html: `
      <div class="sheet-head"><h2>Change password</h2><button class="icon-btn" data-close aria-label="Close">${I('x')}</button></div>
      <form class="sheet-body" id="pwForm" novalidate>
        ${F.text('current', 'Current password', { icon: 'lock', type: 'password', max: 64, auto: 'current-password' })}
        ${F.text('password', 'New password', { icon: 'key', type: 'password', ph: 'At least 6 characters', max: 64, auto: 'new-password' })}
        ${F.text('confirm', 'Confirm new password', { icon: 'key', type: 'password', max: 64, auto: 'new-password' })}
      </form>
      <div class="sheet-foot"><button class="btn primary" id="savePw">${I('check')} Update password</button></div>`,
  });
  const form = $('#pwForm', sheet.el);
  liveClear(form);
  form.onsubmit = e => { e.preventDefault(); $('#savePw', sheet.el).click(); };
  $('#savePw', sheet.el).onclick = async () => {
    const v = readForm(form, {
      current: R.req('Enter your current password'),
      password: adminRules.password,
      confirm: adminRules.confirm,
    });
    if (!v) return;
    const r = await attempt($('#savePw', sheet.el), () => Api.post('/api/password', { current: v.current, password: v.password }), form);
    if (!r) return;
    // The server signs this account out everywhere else; this phone carries on with a new session
    await Session.set(r.token, S.kind, S.user.id);
    if (Bio.enabledFor(S.kind, S.user.id)) Bio.remember(S.kind, S.user, r.token);
    dbLine('update');
    buzz('success');
    sheet.close();
    toast('Password updated. Other phones signed in to this account are signed out.');
  };
}

// Where the data lives and when this phone last got the latest copy
function serverSheet() {
  const { doctors: admins, staff, patients, tokens } = Store.db;
  openSheet({
    html: `
      <div class="sheet-head"><h2>Online data</h2><button class="icon-btn" data-close aria-label="Close">${I('x')}</button></div>
      <div class="sheet-body">
        <p class="muted" style="margin-bottom:14px;font-size:14px">Every change is saved on the Prime Care server straight away, so every phone signed in to the hospital sees the same records. This phone checks for changes every 15 seconds, and when you pull down on a screen.</p>
        <div class="legend"><span><i class="lg-add"></i>Added</span><span><i class="lg-update"></i>Updated</span><span><i class="lg-delete"></i>Deleted</span></div>
        <div class="info">
          ${infoRow(Conn.state ? 'checkCircle' : 'alert', 'Connection', Conn.state ? 'Connected (green dot in the logo)' : 'Not connected (red dot in the logo). Changes can be made once it reconnects.')}
          ${infoRow('database', 'Server', API_URL.replace(/^https?:\/\//, ''))}
          ${infoRow('clock', 'Last updated', Store.syncedAt ? new Date(Store.syncedAt).toLocaleString() : 'Not yet')}
          ${isPatient() ? '' : infoRow('users', 'Records', `${admins.length} accounts · ${staff.length} staff · ${patients.length} patients · ${tokens.length} OP tokens`)}
        </div>
      </div>
      <div class="sheet-foot"><button class="btn primary" id="syncNow">${I('refresh')} Check for changes</button></div>`,
    onMount: (el, api) => {
      $('#syncNow', el).onclick = async () => {
        const r = await attempt($('#syncNow', el), () => Store.load(20000));
        if (!r) return;
        api.close();
        toast('Up to date');
        refresh(true);
      };
    },
  });
}

// A copy of every record (without passwords) from the server, saved or sent through the share sheet
async function exportBackup() {
  const d = await attempt(null, () => Api.get('/api/export', { timeout: 60000 }));
  if (!d) return;
  const name = `PrimeCare-backup-${today()}.json`;
  const data = JSON.stringify(d, null, 2);
  if (NATIVE) {
    try {
      const w = await Plug.Filesystem.writeFile({ path: name, directory: 'CACHE', encoding: 'utf8', data });
      await Plug.Share.share({ title: 'Prime Care backup', text: `Prime Care Hospital data backup (${today()})`, url: w.uri, dialogTitle: 'Save or send backup' });
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) toast('Could not save the backup', 'error');
    }
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  }
}

// Erasing everything needs the signed-in person's password, typed again
function eraseAll() {
  const { staff, tokens, patients } = Store.db;
  const sheet = openSheet({
    dialog: true,
    html: `
      <button class="icon-btn dlg-x" data-close aria-label="Close">${I('x')}</button>
      <div class="ic red">${I('trash')}</div>
      <h2>Erase all data?</h2>
      <p>This deletes every account, ${staff.length} staff, ${patients.length} patient accounts and ${tokens.length} tokens from the server, for every phone. It cannot be undone. Download a backup first if you may need these records.</p>
      <form id="eraseForm" novalidate style="text-align:left">
        ${F.text('password', 'Enter your password to confirm', { icon: 'lock', type: 'password', ph: 'Your password', max: 64, auto: 'current-password' })}
      </form>
      <div class="acts"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="eraseGo">${I('trash')} Erase</button></div>`,
  });
  const form = $('#eraseForm', sheet.el);
  liveClear(form);
  setTimeout(() => form.password.focus(), 300);
  form.onsubmit = e => { e.preventDefault(); $('#eraseGo', sheet.el).click(); };
  $('#eraseGo', sheet.el).onclick = async () => {
    const pw = form.password.value;
    if (!pw) { setErr(form, 'password', 'Enter your password'); buzz('error'); return; }
    const r = await attempt($('#eraseGo', sheet.el), () => Api.post('/api/erase', { password: pw }), form);
    if (!r) return;
    sheet.close();
    Bio.forget();
    await endSession();
    Store.setupNeeded = true;
    dbLine('delete');
    toast('All data erased');
    route();
  };
}

async function signOut() {
  const ok = await confirmDialog({ title: 'Sign out?', message: 'You will need your username and password to sign in again.', ok: 'Sign out', icon: 'logout' });
  if (!ok) return;
  const wasPatient = isPatient();
  const role = isStaff() ? 'Staff' : S.user.role;
  await endSession();
  if (wasPatient) renderPatientLogin(); else renderLogin(role);
}

/* ---------- Android back button ---------- */
if (Plug.App) {
  try {
    Plug.App.addListener('backButton', () => {
      if (sheets.length) { sheets[sheets.length - 1].close(); return; }
      if ($('.tour')) { if (S.tourStep && S.tourStep(-1)) return; call('App', 'minimizeApp'); return; }
      if (S.user && S.tab !== tabsFor()[0][0]) { go(tabsFor()[0][0]); return; }
      if (!S.user && S.auth && S.auth !== 'landing' && S.auth !== 'offline' && !Store.setupNeeded) { renderLanding(); return; }
      call('App', 'minimizeApp');
    });
  } catch (e) { /* not available on web */ }
}

/* ---------- Launch animation ----------
   Starts with the mark alone in the centre, the same as the native splash icon, then the
   mark glides left and the wordmark is revealed to form the horizontal logo. */
function playLaunch() {
  const L = $('#launch');
  const mark = $('.launch-mark', L);
  // The ring spins once while the cross stays upright
  mark.innerHTML = MARK.replace('class="ring"', 'class="ring spin"');
  const lock = $('.launch-lockup', L).getBoundingClientRect();
  const m = mark.getBoundingClientRect();
  // m is measured with scale(2) applied around its centre, so its centre is still the final centre
  const dx = lock.left + lock.width / 2 - (m.left + m.width / 2);
  L.style.setProperty('--dx', dx + 'px');
  // The native splash centres on the whole screen; the web view starts below the status bar
  if (NATIVE) { L.style.setProperty('--dy', '11px'); L.style.setProperty('--s0', '2.12'); }
  // On a phone, hold still until the native splash (300 ms fade) has handed over, so there is no double image
  setTimeout(() => L.classList.add('play'), NATIVE ? 380 : 30);
}

/* ---------- Opening the app ----------
   The app opens straight away from what this phone already knows (the saved session and its copy
   of the data) and connects to the server in the background. The dot after HOSPITAL in the logo
   turns green once it is connected. */
// Picks up the saved session and data copy: 'none' (signed out), 'cached' (ready to show),
// or 'token' (signed in, but no copy yet, as on the first launch after updating)
async function restore() {
  // Sign-ins from the earlier on-phone version can't be used with the server
  call('Preferences', 'remove', { key: 'session' });
  const sn = await call('Preferences', 'get', { key: 'setupNeeded' });
  Store.setupNeeded = !!(sn && sn.value === '1');
  const sess = await Session.get();
  if (!sess || !sess.token) return 'none';
  Api.token = sess.token;
  const c = await Store.readCache();
  // A copy saved by an older version (doctors were then called "admins") is reloaded from the server
  if (!c || !c.db || !c.db.doctors || c.kind !== sess.kind || !c.user || c.user.id !== sess.id) return 'token';
  Store.db = { ...Store.blank(), ...c.db };
  Store.rev = c.rev || 0;
  Store.epoch = c.epoch || '';
  Store.syncedAt = c.syncedAt || null;
  S.kind = c.kind;
  S.user = c.user;
  S.tab = c.kind === 'patient' ? 'phome' : 'home';
  S.tokenDate = today();
  return 'cached';
}
// Reaches the server: checks whether the hospital is set up and, for a signed-in person, loads
// their latest data. Throws when the server can't be reached. A session the server no longer
// accepts ends here (with a message, if the person was already on screen).
async function connect() {
  await Store.status();
  if (!Api.token) return null;
  try {
    const r = await Store.load();
    if (!S.user || S.user.id !== r.user.id) {
      S.tab = r.kind === 'patient' ? 'phome' : 'home';
      S.tokenDate = today();
    }
    S.kind = r.kind;
    S.user = r.user;
    Store.saveCache();
    return r;
  } catch (e) {
    if (e.status === 401 || e.status === 403) { if (S.user) await sessionEnded(e.message); else await endSession(); return null; }
    throw e;
  }
}
// When signed out, keeps the first screen right once the server says whether setup is still needed
function syncAuthScreen() {
  if (S.user || sheets.length || !['landing', 'setup'].includes(S.auth)) return;
  if ((S.auth === 'setup') !== Store.setupNeeded) route();
}
// The first screen: the tour on first launch, the fingerprint lock, or the right screen
async function enterApp() {
  const seen = await call('Preferences', 'get', { key: 'onboarded' });
  if (!(seen && seen.value === '1')) renderTour(route);
  else if (S.user && Bio.enabledFor(S.kind, S.user.id)) renderLock();
  else route();
}
// Only for a phone that is signed in but has no copy of the data yet, and can't reach the server
function renderOffline(err) {
  S.auth = 'offline';
  $('#screen').innerHTML = `
    <div class="auth">
      <div class="auth-top">${LOGO_H}</div>
      <div class="auth-card center">
        <div class="ok-badge off">${I('alert')}</div>
        <h1>Can't reach Prime Care</h1>
        <p id="offMsg">${esc(err.message || OFFLINE_MSG)}</p>
        <p class="small">Your records are loaded from the Prime Care server the first time you open this version. Check the internet connection and try again.</p>
        <button class="btn primary block" id="retry">${I('refresh')} Try again</button>
      </div>
      <div class="auth-foot">Prime Care Hospital · v${APP_VERSION}</div>
    </div>`;
  $('#retry').onclick = async () => {
    const b = $('#retry');
    busy(b, true);
    try { await connect(); } catch (e) {
      busy(b, false);
      buzz('error');
      $('#offMsg').textContent = e.message;
      return;
    }
    buzz('success');
    S.auth = null;
    enterApp();
  };
}

/* ---------- Boot ---------- */
async function boot() {
  playLaunch();
  call('StatusBar', 'setStyle', { style: 'LIGHT' });
  call('StatusBar', 'setBackgroundColor', { color: '#ffffff' });
  call('SplashScreen', 'hide', { fadeOutDuration: 250 });
  await Theme.init();
  await Mode.init();
  await Sound.init();
  await Bio.init();
  const minShow = wait(NATIVE ? 2850 : 2500);
  const known = await restore();
  // Connect in the background; checks repeat every 15 seconds after that
  const online = connect().catch(e => e);
  Live.start();
  if (known === 'token') {
    // Signed in but nothing to show yet: wait for the server this once
    const r = await online;
    await minShow;
    if (r instanceof Error) renderOffline(r); else await enterApp();
  } else {
    await minShow;
    await enterApp();
    online.then(r => {
      if (r instanceof Error) return;
      if (r && r.changed) refresh(true);
      syncAuthScreen();
    });
  }
  $('#launch').classList.add('done');
  setTimeout(() => $('#launch') && $('#launch').remove(), 700);
}
// Start once every script (insights, reports, features) has loaded
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
