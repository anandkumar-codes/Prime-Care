/* Prime Care: PDF reports (jsPDF + AutoTable).
   Every page carries the organisation's logo, the report title and period, a thin
   border and a page footer. Reports are saved to Documents/PrimeCare/Reports. */
'use strict';

/* ---------- Periods ---------- */
const REPORT_PRESETS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['last7', 'Last 7 days'],
  ['month', 'This month'], ['lastmonth', 'Last month'], ['last30', 'Last 30 days'], ['year', 'This year'],
  ['all', 'All time'], ['custom', 'Custom'],
];
function presetRange(id, from, to) {
  const t = today();
  const [y, m] = t.split('-').map(Number);
  const ym = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}`;
  const lastDay = (yy, mm) => new Date(yy, mm, 0).getDate();
  switch (id) {
    case 'today': return { start: t, end: t };
    case 'yesterday': { const d = addDays(t, -1); return { start: d, end: d }; }
    case 'week': return { start: addDays(t, -weekdayOf(t)), end: t };
    case 'last7': return { start: addDays(t, -6), end: t };
    case 'month': return { start: `${ym(y, m)}-01`, end: t };
    case 'lastmonth': { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return { start: `${ym(py, pm)}-01`, end: `${ym(py, pm)}-${lastDay(py, pm)}` }; }
    case 'last30': return { start: addDays(t, -29), end: t };
    case 'year': return { start: `${y}-01-01`, end: t };
    case 'all': return { start: '0000-01-01', end: '9999-12-31', all: true };
    default: {
      const a = from || t, b = to || t;
      return a <= b ? { start: a, end: b } : { start: b, end: a };
    }
  }
}
const periodLabel = r => (r.all ? 'All records' : r.start === r.end ? fmtDate(r.start) : `${fmtDate(r.start)} to ${fmtDate(r.end)}`);
const inRange = (date, r) => !!date && date >= r.start && date <= r.end;
const rs = n => `Rs. ${Math.round(+n || 0).toLocaleString('en-IN')}`;
const ageSex = p => [p.age !== undefined && p.age !== '' ? `${p.age}y` : '', (p.gender || '').charAt(0)].filter(Boolean).join(' / ');
const datesBetween = (a, b) => { const out = []; for (let d = a; d <= b && out.length < 400; d = addDays(d, 1)) out.push(d); return out; };
const tokenSort = (a, b) => (a.date + String(a.seq).padStart(4, '0')).localeCompare(b.date + String(b.seq).padStart(4, '0'));

/* ---------- Report definitions ----------
   build(range, filters) returns { summary: [[label, value]], sections: [{ heading, head, body, foot, widths }] } */
const REPORTS = [
  {
    id: 'tokens', name: 'OP Token Register', icon: 'ticket', who: 'hospital', dated: true, landscape: true,
    desc: 'Every token with patient, doctor, status and fee',
    filters: ['doctor', 'status'],
    rows: (r, f) => Store.db.tokens.filter(t => inRange(t.date, r) && (!f.doctor || (f.doctor === '-' ? !t.doctorId : t.doctorId === f.doctor)) && (!f.status || t.status === f.status) && (!f.phone || digits(t.patient.phone).slice(-10) === f.phone)).sort(tokenSort),
    build(r, f) {
      const list = this.rows(r, f);
      const c = s => list.filter(t => t.status === s).length;
      return {
        summary: [['Tokens', list.length], ['Completed', c('Completed')], ['Waiting / with doctor', c('Waiting') + c('In consultation')], ['Awaiting confirmation', c('Pending')], ['Cancelled', c('Cancelled')], ['OP fees', rs(list.filter(t => t.status !== 'Cancelled').reduce((s, t) => s + (+t.fee || 0), 0))]],
        sections: [{
          heading: 'Tokens',
          head: ['#', 'Token', 'Date', 'Time', 'Patient', 'Age / sex', 'Phone', 'Doctor', 'Visit', 'Booked via', 'Status', 'Fee'],
          body: list.map((t, i) => [i + 1, t.id, fmtDate(t.date), fmtTime(t.issuedAt), t.patient.name, ageSex(t.patient), t.patient.phone, doctorLabel(t.doctorId), t.visitType || '', t.source === 'patient' ? 'Patient app' : 'Front desk', t.status, t.fee ? rs(t.fee) : '-']),
          status: 10,
        }],
      };
    },
  },
  {
    id: 'daily', name: 'Daily OP Summary', icon: 'calendar', who: 'hospital', dated: true,
    desc: 'Day-by-day totals of tokens, outcomes, waiting time and fees',
    rows: r => Store.db.tokens.filter(t => inRange(t.date, r)),
    build(r) {
      const list = this.rows(r);
      let days = r.all ? [...new Set(list.map(t => t.date))].sort() : datesBetween(r.start, r.end);
      if (days.length > 92) days = days.filter(d => list.some(t => t.date === d));
      const row = ts => {
        const v = ts.filter(t => t.status !== 'Cancelled');
        const w = avg(ts.filter(t => t.calledAt).map(t => minutesBetween(t.issuedAt, t.calledAt)));
        return [ts.length, ts.filter(t => t.status === 'Completed').length, ts.filter(t => t.status === 'Cancelled').length,
          ts.filter(t => t.status === 'Waiting' || t.status === 'In consultation').length, ts.filter(t => t.source === 'patient').length,
          w === null ? '-' : fmtMin(w), rs(v.reduce((s, t) => s + (+t.fee || 0), 0))];
      };
      const body = days.map(d => [fmtDate(d), WEEKDAYS[weekdayOf(d)], ...row(list.filter(t => t.date === d))]);
      const busiest = days.reduce((b, d) => (list.filter(t => t.date === d).length > list.filter(t => t.date === b).length ? d : b), days[0]);
      return {
        summary: [['Days', days.length], ['Tokens', list.length], ['Average per day', days.length ? (list.length / days.length).toFixed(1) : 0], ['Busiest day', busiest && list.length ? `${fmtDate(busiest)}` : '-']],
        sections: [{ heading: 'By day', head: ['Date', 'Day', 'Tokens', 'Completed', 'Cancelled', 'Pending', 'App bookings', 'Avg wait', 'Fees'], body, foot: ['Total', '', ...row(list)] }],
      };
    },
  },
  {
    id: 'doctors', name: 'Doctor-wise Consultations', icon: 'stetho', who: 'admin', dated: true,
    desc: 'Visits, completion rate, waiting and consultation time per doctor',
    filters: ['doctor'],
    rows: (r, f) => Store.db.tokens.filter(t => inRange(t.date, r) && t.status !== 'Cancelled' && (!f.doctor || (f.doctor === '-' ? !t.doctorId : t.doctorId === f.doctor))),
    build(r, f) {
      const list = this.rows(r, f);
      const docs = [...doctors().map(d => ({ id: d.id, name: displayName(d), title: d.title || '' })), { id: '', name: 'Any available doctor', title: '' }]
        .filter(d => !f.doctor || (f.doctor === '-' ? !d.id : d.id === f.doctor));
      const body = docs.map(d => {
        const m = list.filter(t => t.doctorId === d.id);
        const done = m.filter(t => t.status === 'Completed');
        const w = avg(m.filter(t => t.calledAt).map(t => minutesBetween(t.issuedAt, t.calledAt)));
        const c = avg(done.filter(t => t.calledAt && t.completedAt).map(t => minutesBetween(t.calledAt, t.completedAt)));
        return [d.name, d.title, m.length, done.length, m.length ? `${Math.round((done.length / m.length) * 100)}%` : '-', w === null ? '-' : fmtMin(w), c === null ? '-' : fmtMin(c), rs(m.reduce((s, t) => s + (+t.fee || 0), 0))];
      }).filter(rw => rw[2] || rw[0] !== 'Any available doctor');
      const done = list.filter(t => t.status === 'Completed');
      const detail = done.filter(t => t.doctorNotes).sort(tokenSort);
      return {
        summary: [['Visits', list.length], ['Completed', done.length], ['Doctors', docs.filter(d => d.id).length], ['Avg consultation', fmtMin(avg(done.filter(t => t.calledAt && t.completedAt).map(t => minutesBetween(t.calledAt, t.completedAt))))]],
        sections: [
          { heading: 'Summary by doctor', head: ['Doctor', 'Speciality', 'Visits', 'Completed', 'Completion', 'Avg wait', 'Avg consult', 'Fees'], body },
          ...(detail.length ? [{ heading: 'Consultation notes', head: ['Token', 'Date', 'Patient', 'Doctor', 'Notes'], body: detail.map(t => [t.id, fmtDate(t.date), t.patient.name, doctorLabel(t.doctorId), t.doctorNotes]), wrapLast: true }] : []),
        ],
      };
    },
  },
  {
    id: 'fees', name: 'OP Fee Collection', icon: 'rupee', who: 'hospital', dated: true,
    desc: 'Fees collected by day and by payment mode',
    rows: r => Store.db.tokens.filter(t => inRange(t.date, r) && t.status !== 'Cancelled' && +t.fee > 0),
    build(r) {
      const list = this.rows(r);
      const modes = ['Cash', 'UPI', 'Card', 'Free'];
      const sum = (ts, m) => ts.filter(t => (t.payMode || 'Cash') === m).reduce((s, t) => s + (+t.fee || 0), 0);
      const days = [...new Set(list.map(t => t.date))].sort();
      const body = days.map(d => { const ts = list.filter(t => t.date === d); return [fmtDate(d), ts.length, ...modes.slice(0, 3).map(m => rs(sum(ts, m))), rs(ts.reduce((s, t) => s + (+t.fee || 0), 0))]; });
      const total = list.reduce((s, t) => s + (+t.fee || 0), 0);
      return {
        summary: [['Total collected', rs(total)], ['Paid visits', list.length], ['Average fee', rs(list.length ? total / list.length : 0)], ['Days with collection', days.length]],
        sections: [
          { heading: 'By payment mode', head: ['Mode', 'Visits', 'Amount', 'Share'], body: modes.map(m => { const n = list.filter(t => (t.payMode || 'Cash') === m); const a = sum(list, m); return [m, n.length, rs(a), total ? `${Math.round((a / total) * 100)}%` : '-']; }) },
          { heading: 'By day', head: ['Date', 'Paid visits', 'Cash', 'UPI', 'Card', 'Total'], body, foot: ['Total', list.length, ...modes.slice(0, 3).map(m => rs(sum(list, m))), rs(total)] },
        ],
      };
    },
  },
  {
    id: 'cancelled', name: 'Cancelled Tokens', icon: 'ban', who: 'hospital', dated: true, landscape: true,
    desc: 'Cancelled bookings with who cancelled them and when',
    rows: r => Store.db.tokens.filter(t => inRange(t.date, r) && t.status === 'Cancelled').sort(tokenSort),
    build(r) {
      const list = this.rows(r);
      return {
        summary: [['Cancelled', list.length], ['By patients', list.filter(t => t.cancelledBy && t.cancelledBy.startsWith('PCP')).length], ['By hospital', list.filter(t => t.cancelledBy && !t.cancelledBy.startsWith('PCP')).length], ['Share of bookings', (() => { const all = Store.db.tokens.filter(t => inRange(t.date, r)).length; return all ? `${Math.round((list.length / all) * 100)}%` : '-'; })()]],
        sections: [{ heading: 'Cancelled tokens', head: ['Token', 'Date', 'Patient', 'Phone', 'Doctor', 'Booked via', 'Cancelled by', 'Cancelled at'], body: list.map(t => [t.id, fmtDate(t.date), t.patient.name, t.patient.phone, doctorLabel(t.doctorId), t.source === 'patient' ? 'Patient app' : 'Front desk', personName(t.cancelledBy), t.cancelledAt ? `${fmtDate(t.cancelledAt)} ${fmtTime(t.cancelledAt)}` : '-']) }],
      };
    },
  },
  {
    id: 'patients', name: 'Patient Accounts', icon: 'user', who: 'admin', dated: true, defaultPreset: 'all',
    desc: 'Patients who registered in the app, with their visit counts',
    rows: r => Store.db.patients.filter(p => r.all || inRange(localDate(p.createdAt), r)).sort((a, b) => a.id.localeCompare(b.id)),
    build(r) {
      const list = this.rows(r);
      const visits = p => Store.db.tokens.filter(t => t.patientId === p.id || digits(t.patient.phone).slice(-10) === digits(p.phone).slice(-10));
      return {
        summary: [['Patient accounts', list.length], ['With at least one visit', list.filter(p => visits(p).length).length], ['Total visits', list.reduce((s, p) => s + visits(p).length, 0)]],
        sections: [{ heading: 'Patients', head: ['Patient ID', 'Name', 'Gender', 'Age', 'Mobile', 'Email', 'Registered', 'Visits'], body: list.map(p => [p.id, p.name, p.gender, age(p.dob) ?? '', p.phone, p.email || '', fmtDate(p.createdAt), visits(p).length]) }],
      };
    },
  },
  {
    id: 'staff', name: 'Staff Directory', icon: 'users', who: 'admin', dated: false, landscape: true,
    desc: 'All staff with role, department, shift, status and app access',
    filters: ['staffStatus'],
    rows: (r, f) => Store.db.staff.filter(s => !f.staffStatus || (s.status || 'Active') === f.staffStatus).sort((a, b) => a.id.localeCompare(b.id)),
    build(r, f) {
      const list = this.rows(r, f);
      return {
        summary: [['Staff', list.length], ['Active', list.filter(s => (s.status || 'Active') === 'Active').length], ['On leave', list.filter(s => s.status === 'On leave').length], ['With app access', list.filter(s => s.login && s.login.enabled).length]],
        sections: [{ heading: 'Staff', head: ['Staff ID', 'Name', 'Role', 'Department', 'Phone', 'Shift', 'Joined', 'Status', 'App access'], body: list.map(s => [s.id, s.name, s.role, s.department || '', s.phone, s.shift || '', fmtDate(s.joinDate), s.status || 'Active', s.login && s.login.enabled ? `@${s.login.username}` : 'No']), status: 7 }],
      };
    },
  },
  {
    id: 'visits', name: 'My Visit History', icon: 'clock', who: 'patient', dated: true, defaultPreset: 'all',
    desc: 'Your OP visits with doctor and notes',
    rows: r => myTokens().filter(t => r.all || inRange(t.date, r)).sort(tokenSort),
    build(r) {
      const list = this.rows(r);
      return {
        summary: [['Patient', `${S.user.name} (${S.user.id})`], ['Visits', list.length], ['Completed', list.filter(t => t.status === 'Completed').length]],
        sections: [{ heading: 'Visits', head: ['Token', 'Date', 'Doctor', 'Visit', 'Reason', 'Status', "Doctor's notes"], body: list.map(t => [t.id, fmtDate(t.date), doctorLabel(t.doctorId), t.visitType || '', t.complaint || '', t.status, t.doctorNotes || '']), status: 5, wrapLast: true }],
      };
    },
  },
];
const reportsFor = () => REPORTS.filter(r => (isPatient() ? r.who === 'patient' : r.who === 'hospital' || (r.who === 'admin' && !isStaff())));

/* ---------- Logo as an image for the PDF ---------- */
let logoCache = null;
function logoPng() {
  if (logoCache) return logoCache;
  logoCache = new Promise(resolve => {
    const svg = LOGO_PRINT.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1420" height="320" ');
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      // About 600 dpi at the printed 60 mm width, so the logo stays sharp when zoomed or printed;
      // drawn on white so it compresses well
      c.width = 1420; c.height = 320;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  return logoCache;
}

/* ---------- PDF ---------- */
const STATUS_RGB = { Pending: [109, 40, 217], Completed: [4, 120, 87], Waiting: [180, 83, 9], 'In consultation': [37, 99, 235], Cancelled: [100, 116, 139], Active: [4, 120, 87], 'On leave': [180, 83, 9], Inactive: [100, 116, 139] };
async function buildPdf(def, range, filters) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: def.landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 12;                 // content margin
  const B = 7;                  // border inset
  const logo = await logoPng();
  const data = def.build(range, filters);
  const now = new Date();
  const who = isPatient() ? `${S.user.name} (Patient ${S.user.id})` : `${displayName(S.user)} (${isStaff() ? S.user.role : S.user.role})`;
  const filterText = [
    filters.doctor && `Doctor: ${filters.doctor === '-' ? 'Any available doctor' : doctorLabel(filters.doctor)}`,
    filters.status && `Status: ${filters.status}`,
    filters.patientName && `Patient: ${filters.patientName}`,
    filters.staffStatus && `Status: ${filters.staffStatus}`,
  ].filter(Boolean).join('   ·   ');
  const reportId = `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const HEADER_BOTTOM = 31;

  const pageChrome = () => {
    // thin border on every page
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
    doc.rect(B, B, W - B * 2, H - B * 2);
    // header: logo left, title and period right
    // same alias on every page, so the image is stored once in the file
    if (logo) doc.addImage(logo, 'PNG', M, 11, 60, 13.5, 'pc-logo', 'FAST');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 23, 42);
    doc.text(def.name, W - M, 16, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139);
    doc.text(def.dated ? `Period: ${periodLabel(range)}` : `As on ${fmtDate(today())}`, W - M, 21.5, { align: 'right' });
    doc.text(reportId, W - M, 26, { align: 'right' });
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.25);
    doc.line(M, HEADER_BOTTOM - 2, W - M, HEADER_BOTTOM - 2);
    // footer
    doc.line(M, H - 15, W - M, H - 15);
    doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text('Prime Care Hospital  ·  Confidential, for authorised use only', M, H - 10.5);
    doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber} of {total}`, W - M, H - 10.5, { align: 'right' });
  };

  pageChrome();
  let y = HEADER_BOTTOM + 3;
  doc.setFontSize(8.5); doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'normal');
  doc.text(`Generated by ${who} on ${fmtDate(now.toISOString())}, ${fmtTime(now.toISOString())}`, M, y + 2);
  if (filterText) { y += 5; doc.text(`Filters: ${filterText}`, M, y + 2); }
  y += 7;

  // Summary tiles
  const tiles = data.summary;
  const perRow = Math.min(tiles.length, def.landscape ? 6 : 4);
  const tw = (W - M * 2 - (perRow - 1) * 4) / perRow;
  tiles.forEach(([label, value], i) => {
    const col = i % perRow, rowN = Math.floor(i / perRow);
    const x = M + col * (tw + 4), ty = y + rowN * 19;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.25);
    doc.roundedRect(x, ty, tw, 16, 2, 2, 'FD');
    doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
    doc.text(String(label).toUpperCase(), x + 3, ty + 5.5);
    doc.setFontSize(String(value).length > 18 ? 9 : 12.5); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(String(value), tw - 6)[0], x + 3, ty + 12.5);
  });
  y += Math.ceil(tiles.length / perRow) * 19 + 4;

  // Tables
  data.sections.forEach((sec, si) => {
    if (y > H - 45) { doc.addPage(); pageChrome(); y = HEADER_BOTTOM + 4; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(15, 23, 42);
    doc.text(`${sec.heading}${sec.body.length ? `  (${sec.body.length})` : ''}`, M, y + 3);
    y += 6;
    doc.autoTable({
      startY: y,
      head: [sec.head],
      body: sec.body.length ? sec.body.map(r => r.map(c => String(c ?? ''))) : [[{ content: 'No records for this period', colSpan: sec.head.length, styles: { halign: 'center', textColor: [100, 116, 139], fontStyle: 'italic' } }]],
      foot: sec.foot && sec.body.length ? [sec.foot.map(c => String(c))] : undefined,
      showFoot: 'lastPage',
      theme: 'grid',
      margin: { top: HEADER_BOTTOM + 3, bottom: 19, left: M, right: M },
      styles: { font: 'helvetica', fontSize: def.landscape ? 7.6 : 8.2, cellPadding: 1.8, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: [30, 41, 59], overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', lineColor: [30, 58, 138] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: sec.wrapLast ? { [sec.head.length - 1]: { cellWidth: def.landscape ? 90 : 60 } } : {},
      didParseCell: h => {
        if (h.section === 'body' && sec.status !== undefined && h.column.index === sec.status) {
          const rgb = STATUS_RGB[h.cell.raw];
          if (rgb) { h.cell.styles.textColor = rgb; h.cell.styles.fontStyle = 'bold'; }
        }
      },
      didDrawPage: () => { if (doc.internal.getCurrentPageInfo().pageNumber > 1) pageChrome(); },
    });
    y = doc.lastAutoTable.finalY + 8;
    if (si === data.sections.length - 1 && y < H - 30) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
      doc.text('End of report', W / 2, y, { align: 'center' });
    }
  });
  doc.putTotalPages('{total}');
  return { doc, pages: doc.internal.getNumberOfPages() };
}

// Saves to Documents/PrimeCare/Reports on the phone (falls back to app cache), or downloads in a browser
let storageAsked = false;
async function saveReport(doc, name, folder = 'Reports') {
  if (!NATIVE) { doc.save(name); return { uri: null, where: 'Downloads' }; }
  // Android 10 and older need permission to write to Documents; asked the first time a PDF is saved
  if (!storageAsked) {
    storageAsked = true;
    const p = await call('Filesystem', 'checkPermissions');
    if (p && p.publicStorage !== 'granted') await call('Filesystem', 'requestPermissions');
  }
  const data = doc.output('datauristring').split(',')[1];
  try {
    const w = await Plug.Filesystem.writeFile({ path: `PrimeCare/${folder}/${name}`, directory: 'DOCUMENTS', data, recursive: true });
    return { uri: w.uri, where: `Documents/PrimeCare/${folder}` };
  } catch (e) {
    const w = await Plug.Filesystem.writeFile({ path: name, directory: 'CACHE', data });
    return { uri: w.uri, where: 'app storage' };
  }
}
const openPdf = uri => call('FileOpener', 'open', { filePath: uri, contentType: 'application/pdf' });
const sharePdf = (uri, title) => call('Share', 'share', { title, url: uri, dialogTitle: 'Share report' });

/* ---------- Reports sheet ----------
   opts: { type, preset, from, to, filters } lets each screen open it pre-filled. */
function openReports(opts = {}) {
  const list = reportsFor();
  const st = {
    type: list.some(r => r.id === opts.type) ? opts.type : list[0].id,
    preset: opts.preset || null,
    from: opts.from || addDays(today(), -6),
    to: opts.to || today(),
    filters: { ...(opts.filters || {}) },
  };
  const def = () => REPORTS.find(r => r.id === st.type);
  if (!st.preset) st.preset = def().defaultPreset || 'today';
  const range = () => presetRange(st.preset, st.from, st.to);

  const sheet = openSheet({
    full: true,
    html: `
      <div class="sheet-head"><button class="icon-btn" data-close aria-label="Close">${I('x')}</button><h2>Reports</h2><span class="chip">${I('download')} PDF</span></div>
      <div class="sheet-body" id="repBody"></div>
      <div class="sheet-foot"><button class="btn primary block" id="repGo">${I('download')} Generate PDF</button></div>`,
  });
  const body = $('#repBody', sheet.el);

  const draw = () => {
    const d = def();
    const r = range();
    const count = d.rows(r, st.filters).length;
    const docOpts = [['', 'All doctors'], ...doctors().map(x => [x.id, displayName(x)]), ['-', 'Any available doctor']];
    body.innerHTML = `
      ${list.length > 1 ? `${F.section('Report')}
      <div class="rp-list">${list.map(x => `
        <button class="rp-opt ${x.id === st.type ? 'on' : ''}" data-id="${x.id}">
          <span class="ic">${I(x.icon)}</span><span class="tx"><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></span><span class="rp-radio"></span>
        </button>`).join('')}</div>` : `<div class="rp-single"><span class="ic">${I(d.icon)}</span><div><b>${esc(d.name)}</b><small>${esc(d.desc)}</small></div></div>`}
      ${d.dated ? `${F.section('Period')}
      <div class="rp-presets">${REPORT_PRESETS.map(([id, l]) => `<button class="${id === st.preset ? 'on' : ''}" data-p="${id}">${l}</button>`).join('')}</div>
      ${st.preset === 'custom' ? `<div class="row2 rp-custom">
        ${F.text('from', 'From', { icon: 'calendar', type: 'date', value: st.from, attrs: `max="${today()}"` })}
        ${F.text('to', 'To', { icon: 'calendar', type: 'date', value: st.to, attrs: `max="${today()}"` })}</div>` : ''}
      <p class="rp-range">${I('calendar')} ${esc(periodLabel(r))}</p>` : ''}
      ${(d.filters || []).length ? F.section('Filters') : ''}
      ${(d.filters || []).includes('doctor') ? `<label class="field"><span class="lbl">Doctor</span><div class="ctl sel">${I('stetho')}<select data-f="doctor">${docOpts.map(([v, l]) => `<option value="${v}" ${v === (st.filters.doctor || '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></label>` : ''}
      ${(d.filters || []).includes('status') ? `<label class="field"><span class="lbl">Status</span><div class="ctl sel">${I('activity')}<select data-f="status"><option value="">All statuses</option>${TOKEN_STATUS.map(s => `<option ${s === st.filters.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></label>` : ''}
      ${(d.filters || []).includes('staffStatus') ? `<label class="field"><span class="lbl">Status</span><div class="ctl sel">${I('activity')}<select data-f="staffStatus"><option value="">All staff</option>${STAFF_STATUS.map(s => `<option ${s === st.filters.staffStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></div></label>` : ''}
      <div class="rp-preview ${count ? '' : 'empty'}">${I(count ? 'checkCircle' : 'info')}<span>${count ? `<b>${count}</b> record${count === 1 ? '' : 's'} will be included` : 'No records match. The report will still be created, showing that nothing was recorded.'}</span></div>
      <p class="rp-note">${I('note')} Saved as a PDF in Documents/PrimeCare/Reports, with the hospital logo, a page border and page numbers on every page.</p>`;

    $$('.rp-opt', body).forEach(b => { b.onclick = () => { st.type = b.dataset.id; st.filters = {}; st.preset = def().defaultPreset || (st.preset === 'all' ? 'today' : st.preset); buzz(); draw(); }; });
    $$('.rp-presets button', body).forEach(b => { b.onclick = () => { st.preset = b.dataset.p; buzz(); draw(); }; });
    $$('.rp-custom input', body).forEach(inp => { inp.onchange = () => { st[inp.name] = inp.value; draw(); }; });
    $$('select[data-f]', body).forEach(s => { s.onchange = () => { st.filters[s.dataset.f] = s.value; draw(); }; });
  };
  draw();

  $('#repGo', sheet.el).onclick = async () => {
    const btn = $('#repGo', sheet.el);
    if (!window.jspdf) { toast('PDF engine not loaded', 'error'); return; }
    busy(btn, true);
    try {
      const d = def(), r = range();
      const { doc, pages } = await buildPdf(d, r, st.filters);
      const stamp = d.dated ? (r.all ? 'all' : r.start === r.end ? r.start : `${r.start}_to_${r.end}`) : today();
      const name = `PrimeCare_${d.name.replace(/[^A-Za-z]+/g, '-').replace(/-$/, '')}_${stamp}_${Date.now().toString(36).slice(-4)}.pdf`;
      const saved = await saveReport(doc, name);
      busy(btn, false);
      buzz('success');
      reportReady(d, name, pages, saved);
    } catch (e) {
      console.error(e);
      busy(btn, false);
      toast('Could not create the report', 'error');
    }
  };
}

function reportReady(def, name, pages, saved) {
  // Show exactly where the file went: a readable path plus the full device path
  const full = saved.uri ? decodeURIComponent(saved.uri.replace(/^file:\/\//, '')) : '';
  const folder = full ? full.slice(0, full.lastIndexOf('/')) : saved.where;
  const friendly = folder.replace(/^\/storage\/emulated\/0/, 'Internal storage').split('/').filter(Boolean).join(' › ');
  Sound.play('report');
  openSheet({
    dialog: true,
    html: `
      <button class="icon-btn dlg-x" data-close aria-label="Close">${I('x')}</button>
      <div class="ic green">${I('checkCircle')}</div>
      <h2>Report saved</h2>
      <p class="rr-name"><b>${esc(def.name)}</b> · ${pages} page${pages === 1 ? '' : 's'}</p>
      <div class="rr-path">
        <div class="rr-row">${I('database')}<span><small>Folder</small><b>${esc(saved.uri ? friendly : saved.where)}</b>${saved.uri ? `<code>${esc(folder)}</code>` : ''}</span></div>
        <div class="rr-row">${I('note')}<span><small>File name</small><b class="rr-file">${esc(name)}</b></span></div>
      </div>
      ${saved.uri ? `
        <p class="rr-ask">Do you want to open the report now?</p>
        <div class="acts"><button class="btn ghost" id="rpShare">${I('upload')} Share</button><button class="btn primary" id="rpOpen">${I('note')} Open</button></div>`
      : '<div class="acts"><button class="btn primary" data-close>Done</button></div>'}`,
    onMount: (el, api) => {
      if (!saved.uri) return;
      $('#rpOpen', el).onclick = () => { openPdf(saved.uri); api.close(); };
      $('#rpShare', el).onclick = () => { sharePdf(saved.uri, def.name); api.close(); };
    },
  });
}
