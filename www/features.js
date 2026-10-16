/* Prime Care: sound effects, fingerprint lock and global search. */
'use strict';

/* ---------- Sound effects ----------
   Short tones synthesised with Web Audio (no files, all under a second).
   Sounds are queued for a moment so that one action plays one sound: if a save
   ("add") is followed straight away by a token slip, only the token chime plays. */
const SFX = {
  tap: { pr: 0, notes: [{ f: 1150, d: 0.035, g: 0.035 }] },
  success: { pr: 1, notes: [{ f: 784, d: 0.12, g: 0.07 }, { f: 1047, t: 0.09, d: 0.22, g: 0.07 }] },
  add: { pr: 2, notes: [{ f: 523, d: 0.09, g: 0.07 }, { f: 659, t: 0.07, d: 0.09, g: 0.07 }, { f: 784, t: 0.14, d: 0.2, g: 0.07 }] },
  update: { pr: 2, notes: [{ f: 660, d: 0.08, g: 0.06 }, { f: 880, t: 0.08, d: 0.16, g: 0.06 }] },
  delete: { pr: 2, notes: [{ f: 560, f2: 240, d: 0.28, g: 0.08, type: 'triangle' }] },
  error: { pr: 3, notes: [{ f: 220, d: 0.11, g: 0.035, type: 'square' }, { f: 175, t: 0.13, d: 0.17, g: 0.035, type: 'square' }] },
  token: { pr: 4, notes: [{ f: 1318, d: 0.6, g: 0.07 }, { f: 1976, d: 0.45, g: 0.025 }, { f: 2637, t: 0.02, d: 0.3, g: 0.012 }] },
  report: { pr: 4, notes: [{ f: 587, d: 0.1, g: 0.07 }, { f: 880, t: 0.08, d: 0.1, g: 0.07 }, { f: 1175, t: 0.16, d: 0.28, g: 0.07 }] },
  unlock: { pr: 4, notes: [{ f: 880, d: 0.07, g: 0.06 }, { f: 1320, t: 0.07, d: 0.18, g: 0.06 }] },
};
const Sound = {
  on: true,
  ctx: null,
  pending: null,
  async init() {
    const r = await call('Preferences', 'get', { key: 'sounds' });
    this.on = !(r && r.value === 'off');
    // Browsers and web views only start audio after a touch
    document.addEventListener('pointerdown', () => this.ac(), { once: true, capture: true });
  },
  set(on) { this.on = on; call('Preferences', 'set', { key: 'sounds', value: on ? 'on' : 'off' }); if (on) this.play('success'); },
  ac() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  play(name) {
    if (!this.on || !SFX[name]) return;
    const pr = SFX[name].pr;
    if (this.pending && this.pending.pr > pr) return;
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = { pr, timer: setTimeout(() => { this.pending = null; this.render(SFX[name].notes); }, 35) };
  },
  render(notes) {
    const ac = this.ac();
    if (!ac) return;
    const t0 = ac.currentTime + 0.01;
    notes.forEach(n => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = n.type || 'sine';
      const s = t0 + (n.t || 0), e = s + n.d;
      o.frequency.setValueAtTime(n.f, s);
      if (n.f2) o.frequency.exponentialRampToValueAtTime(n.f2, e);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(n.g, s + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, e);
      o.connect(g).connect(ac.destination);
      o.start(s);
      o.stop(e + 0.02);
    });
  },
};

/* ---------- Fingerprint unlock ----------
   One person per phone can turn it on. Their name and a server session are remembered in
   Preferences ("bioUser"); the app then locks on launch and after a minute in the background,
   and the sign-in screens offer "Sign in with fingerprint", which reuses that session. */
const BIO_REASONS = {
  none_enrolled: 'No fingerprint is set up on this phone. Add one in the phone\'s Settings → Security, then try again.',
  no_hardware: 'This phone has no fingerprint sensor.',
  unavailable: 'The fingerprint sensor is not available right now. Try again in a moment.',
  update_required: 'A security update is needed before fingerprints can be used.',
  unsupported: 'Fingerprint unlock is not available on this device.',
};
const Bio = {
  user: null,          // { kind, id, name, token } of the person who turned it on
  lockedAt: 0,
  async init() {
    const r = await call('Preferences', 'get', { key: 'bioUser' });
    try { this.user = r && r.value ? JSON.parse(r.value) : null; } catch (e) { this.user = null; }
    // Set up in the earlier on-phone version, without a server session
    if (this.user && !this.user.token) this.forget();
  },
  enabledFor(kind, id) { return !!(this.user && this.user.kind === kind && this.user.id === id); },
  async available() {
    if (!Plug.PrimeBiometric) return { available: false, reason: 'unsupported' };
    return (await call('PrimeBiometric', 'isAvailable')) || { available: false, reason: 'unsupported' };
  },
  async verify(title, subtitle, negative = 'Cancel') {
    try {
      const r = await Plug.PrimeBiometric.authenticate({ title, subtitle, negative });
      return !!(r && r.verified);
    } catch (e) { return false; }
  },
  remember(kind, user, token) {
    this.user = { kind, id: user.id, name: kind === 'patient' ? user.name : displayName(user), token };
    call('Preferences', 'set', { key: 'bioUser', value: JSON.stringify(this.user) });
  },
  forget() { this.user = null; call('Preferences', 'remove', { key: 'bioUser' }); },
};

// Settings toggle: turning it on requires a successful scan first
async function toggleFingerprint(rowEl) {
  const on = Bio.enabledFor(S.kind, S.user.id);
  if (on) {
    Bio.forget();
    setSwitch(rowEl, false, 'Off · sign in with your password');
    toast('Fingerprint unlock turned off');
    buzz();
    return;
  }
  const a = await Bio.available();
  if (!a.available) {
    buzz('error');
    openSheet({ dialog: true, html: `<div class="ic amber">${I('fingerprint')}</div><h2>Fingerprint not available</h2><p>${esc(BIO_REASONS[a.reason] || BIO_REASONS.unsupported)}</p><div class="acts"><button class="btn primary" data-close>OK</button></div>` });
    return;
  }
  const ok = await Bio.verify('Turn on fingerprint unlock', `Confirm it's you, ${S.user.name}`);
  if (!ok) { toast('Fingerprint not confirmed', 'error'); return; }
  const replacing = Bio.user && !Bio.enabledFor(S.kind, S.user.id);
  Bio.remember(S.kind, S.user, Api.token);
  setSwitch(rowEl, true, 'On · unlock with your fingerprint');
  Sound.play('unlock');
  toast(replacing ? 'Fingerprint unlock moved to your account' : 'Fingerprint unlock is on');
}
function setSwitch(rowEl, on, sub) {
  $('.switch', rowEl).classList.toggle('on', on);
  if (sub) $('.tx small', rowEl).textContent = sub;
}
const toggleRow = (act, icon, color, title, sub, on) =>
  `<button class="row" data-act="${act}"><div class="ic ${color}">${I(icon)}</div><div class="tx"><b>${esc(title)}</b><small>${esc(sub)}</small></div><span class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}"><i></i></span></button>`;

// Lock screen shown on launch (or resume) when fingerprint unlock is on for the signed-in person
function renderLock() {
  S.auth = 'lock';
  const a = S.user;
  $('#screen').innerHTML = `
    <div class="auth lock">
      <div class="auth-top">${LOGO_H}</div>
      <div class="auth-card center">
        ${avatar(a.name, 'lg')}
        <h1>${esc(isPatient() ? a.name : displayName(a))}</h1>
        <p>${esc(isPatient() ? `Patient ${a.id}` : isStaff() ? a.role : a.role)} · Prime Care is locked</p>
        <button class="fp-btn" id="fpGo" aria-label="Unlock with fingerprint">${I('fingerprint')}</button>
        <p class="small">Touch the sensor to unlock</p>
        <button class="link-btn" id="usePw">Use password instead</button>
      </div>
    </div>`;
  const unlock = async () => {
    const ok = await Bio.verify('Unlock Prime Care', a.name, 'Use password');
    if (ok) { Sound.play('unlock'); buzz('success'); S.auth = null; renderMain(); }
  };
  $('#fpGo').onclick = unlock;
  $('#usePw').onclick = async () => {
    const kind = S.kind, role = isStaff() ? 'Staff' : S.user.role;
    await endSession();
    if (kind === 'patient') renderPatientLogin(); else renderLogin(role);
  };
  setTimeout(unlock, 450);
}

// "Sign in with fingerprint" card for the remembered person on the sign-in screens
function bioQuickCard(kindFilter) {
  const u = Bio.user;
  if (!u || (kindFilter && !kindFilter.includes(u.kind))) return '';
  return `<button class="fp-quick" id="fpQuick">${I('fingerprint')}<span><b>Sign in with fingerprint</b><small>Continue as ${esc(u.name)}</small></span>${I('chevron')}</button>`;
}
function bindBioQuick() {
  const b = $('#fpQuick');
  if (!b) return;
  b.onclick = async () => {
    const u = Bio.user;
    if (!u) return;
    const ok = await Bio.verify('Sign in to Prime Care', u.name);
    if (!ok) return;
    // The server decides whether the remembered session is still good
    const r = await attempt(b, async () => {
      try {
        await startSession({ token: u.token, kind: u.kind, user: { id: u.id } });
        return true;
      } catch (e) {
        if (e.status === 401 || e.status === 403) {
          Bio.forget();
          b.remove();
          throw new ApiError('Fingerprint sign-in has expired. Sign in with your password, then turn fingerprint unlock on again.', e.status);
        }
        throw e;
      }
    });
    if (!r) return;
    Sound.play('unlock');
    renderMain();
  };
}

// Lock again after a minute in the background
if (Plug.App) {
  try {
    Plug.App.addListener('pause', () => { Bio.lockedAt = Date.now(); });
    Plug.App.addListener('resume', () => {
      if (S.user && S.auth !== 'lock' && Bio.enabledFor(S.kind, S.user.id) && Date.now() - Bio.lockedAt > 60000) {
        while (sheets.length) sheets[sheets.length - 1].close();
        renderLock();
      }
    });
  } catch (e) { /* not on web */ }
}

/* ---------- Global search ----------
   One search box across tokens, staff, members, patient accounts and doctor/manager accounts. */
function openSearch() {
  const sheet = openSheet({
    full: true,
    html: `
      <div class="sheet-head gs-head">
        <button class="icon-btn" data-close aria-label="Close">${I('chevL')}</button>
        <label class="search gs-box">${I('search')}<input id="gsQ" type="search" placeholder="Search tokens, staff, members, patients" autocomplete="off"><button class="clear hidden" type="button" aria-label="Clear">${I('x')}</button></label>
      </div>
      <div class="sheet-body" id="gsRes"></div>`,
  });
  const input = $('#gsQ', sheet.el), clear = $('.clear', sheet.el), box = $('#gsRes', sheet.el);
  const hint = () => {
    box.innerHTML = `<div class="gs-hint">${I('search')}<p>Search by name, phone number, token number (like ${esc(tourTokenNo().replace('-007', '-001'))}), or an ID such as PCS-0001, PCM-0001 or PCP-00001.</p></div>`;
  };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    clear.classList.toggle('hidden', !q);
    if (q.length < 2) { hint(); return; }
    const has = (...xs) => xs.some(x => String(x || '').toLowerCase().includes(q));
    const groups = [];
    const toks = Store.db.tokens.filter(t => has(t.id, t.patient.name, t.patient.phone, t.patient.memberId, t.complaint))
      .sort((a, b) => (b.date + b.seq).localeCompare(a.date + a.seq)).slice(0, 15);
    if (toks.length) groups.push(['OP tokens', 'ticket', toks.map(t => `<button class="gs-item" data-kind="token" data-id="${esc(t.id)}"><div class="tno sm-t tk-${TOKEN_STYLE[t.status][1]}"><b>${String(t.seq).padStart(3, '0')}</b></div><span><b>${esc(t.patient.name)}</b><small>${esc(t.id)} · ${fmtDate(t.date)} · ${esc(t.status)}</small></span>${I('chevron')}</button>`)]);
    if (!isPatient()) {
      const mem = Store.db.members.filter(m => has(m.id, m.name, m.phone, m.email)).slice(0, 10);
      if (mem.length) groups.push(['Members', 'idCard', mem.map(m => `<button class="gs-item" data-kind="member" data-id="${esc(m.id)}">${avatar(m.name, 'sm')}<span><b>${esc(m.name)}</b><small>${esc(m.id)} · ${esc(m.phone)} · ${esc(m.plan)}</small></span>${I('chevron')}</button>`)]);
    }
    if (!isStaff()) {
      const stf = Store.db.staff.filter(s => has(s.id, s.name, s.phone, s.role, s.department, s.login && s.login.username)).slice(0, 10);
      if (stf.length) groups.push(['Staff', 'users', stf.map(s => `<button class="gs-item" data-kind="staff" data-id="${esc(s.id)}">${avatar(s.name, 'sm')}<span><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(s.role)}${s.department ? ' · ' + esc(s.department) : ''}</small></span>${I('chevron')}</button>`)]);
      const pts = Store.db.patients.filter(p => has(p.id, p.name, p.phone, p.email)).slice(0, 10);
      if (pts.length) groups.push(['Patient accounts', 'user', pts.map(p => `<button class="gs-item" data-kind="patient" data-id="${esc(p.id)}">${avatar(p.name, 'sm')}<span><b>${esc(p.name)}</b><small>${esc(p.id)} · ${esc(p.phone)}</small></span>${I('chevron')}</button>`)]);
      const adm = Store.db.admins.filter(a => has(a.id, a.name, a.phone, a.username, a.title, a.role)).slice(0, 10);
      if (adm.length) groups.push(['Doctors & managers', 'stetho', adm.map(a => `<div class="gs-item static">${avatar(a.name, 'sm')}<span><b>${esc(displayName(a))}</b><small>${esc(a.role)}${a.title ? ' · ' + esc(a.title) : ''} · @${esc(a.username)}</small></span></div>`)]);
    }
    box.innerHTML = groups.length
      ? groups.map(([title, icon, items]) => `<div class="gs-group"><div class="gs-title">${I(icon)} ${esc(title)} <span>${items.length}</span></div>${items.join('')}</div>`).join('')
      : emptyState('search', 'violet', 'No matches', `Nothing found for "${input.value.trim()}".`);
    $$('.gs-item[data-kind]', box).forEach(b => {
      b.onclick = () => {
        const { kind, id } = b.dataset;
        ({ token: tokenDetail, member: memberDetail, staff: staffDetail, patient: patientDetail })[kind](id);
      };
    });
  };
  input.oninput = draw;
  clear.onclick = () => { input.value = ''; draw(); input.focus(); };
  hint();
  setTimeout(() => input.focus(), 350);
}

/* Patient account details for doctors and managers (reached from search) */
function patientDetail(id) {
  const p = Store.db.patients.find(x => x.id === id);
  if (!p) return;
  const visits = Store.db.tokens.filter(t => t.patientId === p.id || digits(t.patient.phone).slice(-10) === digits(p.phone).slice(-10))
    .sort((a, b) => (b.date + String(b.seq).padStart(4, '0')).localeCompare(a.date + String(a.seq).padStart(4, '0')));
  const a = age(p.dob);
  const sheet = openSheet({
    html: `
      <div class="sheet-body">
        <div class="detail-top">${avatar(p.name, 'lg')}<h2>${esc(p.name)}</h2><div class="idl">${esc(p.id)} · patient account</div>
          <div class="badges"><span class="badge b-violet">${visits.length} visit${visits.length === 1 ? '' : 's'}</span></div></div>
        <div class="quick" style="grid-template-columns:1fr 1fr">
          <a href="tel:${esc(digits(p.phone))}" class="ic green">${I('phone')}Call</a>
          <button class="ic blue" id="pdRep">${I('download')}Visits PDF</button>
        </div>
        <div class="info">
          ${infoRow('phone', 'Mobile', p.phone)}
          ${infoRow('user', 'Gender', p.gender)}
          ${infoRow('calendar', 'Date of birth', p.dob ? `${fmtDate(p.dob)}${a !== null ? ` (${a} years)` : ''}` : '')}
          ${infoRow('mail', 'Email', p.email)}
          ${infoRow('clock', 'Registered', fmtDate(p.createdAt))}
        </div>
        ${visits.length ? `<div class="sec-title" style="margin-top:16px">Visits</div><div class="list">${visits.slice(0, 20).map(visitCard).join('')}</div>` : ''}
      </div>`,
  });
  bindVisitCards(sheet.el);
  $('#pdRep', sheet.el).onclick = () => openReports({ type: 'tokens', preset: 'all', filters: { phone: digits(p.phone).slice(-10), patientName: `${p.name} (${p.id})` } });
}

/* ---------- Light / dark display mode ----------
   Independent of the theme: every theme has a light and a dark version.
   'system' follows the phone's own dark-mode setting. */
const MODES = [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'System', 'device']];
const Mode = {
  current: 'light',
  mql: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null,
  resolved() { return this.current === 'system' ? (this.mql && this.mql.matches ? 'dark' : 'light') : this.current; },
  apply(m) {
    this.current = MODES.some(x => x[0] === m) ? m : 'light';
    const dark = this.resolved() === 'dark';
    if (dark) document.documentElement.dataset.mode = 'dark';
    else delete document.documentElement.dataset.mode;
    try { localStorage.setItem('pc-mode', this.current); } catch (e) { /* private mode */ }
    Theme.apply(Theme.current);
  },
  async init() {
    const r = await call('Preferences', 'get', { key: 'mode' });
    this.apply((r && r.value) || 'light');
    if (this.mql && this.mql.addEventListener) this.mql.addEventListener('change', () => { if (this.current === 'system') this.apply('system'); });
  },
  choose(m) { this.apply(m); call('Preferences', 'set', { key: 'mode', value: this.current }); },
  get name() { return (MODES.find(x => x[0] === this.current) || MODES[0])[1]; },
};
const modeSeg = () => `<div class="mode-seg">${MODES.map(([id, label, icon]) => `<button class="${id === Mode.current ? 'on' : ''}" data-mode="${id}">${I(icon)}<span>${label}</span></button>`).join('')}</div>`;
function bindModeSeg(root, onChange) {
  $$('.mode-seg button', root).forEach(b => {
    b.onclick = () => {
      Mode.choose(b.dataset.mode);
      $$('.mode-seg button', root).forEach(x => x.classList.toggle('on', x === b));
      buzz();
      if (onChange) onChange();
    };
  });
}
function modeSheet(onChange) {
  openSheet({
    html: `
      <div class="sheet-head"><h2>Display mode</h2><button class="icon-btn" data-close aria-label="Close">${I('x')}</button></div>
      <div class="sheet-body">
        <p class="muted" style="font-size:14px;margin-bottom:14px">Dark mode is easier on the eyes at night. System follows your phone's setting.</p>
        ${modeSeg()}
      </div>`,
    onMount: el => bindModeSeg(el, onChange),
  });
}

/* ---------- Pull down to refresh ----------
   On the main screens, pulling down from the top fetches the latest changes from the server and redraws the page. */
async function reloadData() {
  await Store.load(20000);
  refresh(true);
}
(function initPullRefresh() {
  const PULL = 80;
  let y0 = null, x0 = 0, dist = 0, busyNow = false;
  const ind = () => $('#ptr');
  document.addEventListener('touchstart', e => {
    y0 = null;
    if (busyNow || !$('.shell') || sheets.length || window.scrollY > 2) return;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dist = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dist = e.touches[0].clientY - y0;
    if (dist <= 0 || Math.abs(e.touches[0].clientX - x0) > dist) return;
    const el = ind(); if (!el) return;
    const p = Math.min(dist, 140);
    el.style.transition = 'none';
    el.style.opacity = Math.min(1, p / PULL);
    el.style.transform = `translate(-50%, ${p * 0.55}px) rotate(${p * 3}deg)`;
    el.classList.toggle('ready', dist >= PULL);
  }, { passive: true });
  document.addEventListener('touchend', async () => {
    if (y0 === null) return;
    y0 = null;
    const el = ind(); if (!el) return;
    el.style.transition = '';
    if (dist >= PULL) {
      busyNow = true;
      el.classList.add('spinning');
      el.style.transform = 'translate(-50%, 44px)';
      buzz();
      try { await Promise.all([reloadData(), wait(600)]); toast('Up to date'); } catch (e) { if (e.code !== 'SESSION') toast(e.message || 'Could not refresh', 'error'); }
      busyNow = false;
    }
    const again = ind();
    if (again) { again.classList.remove('spinning', 'ready'); again.style.transform = ''; again.style.opacity = 0; }
    dist = 0;
  });
})();
