/* Prime Care: printable OP token (PDF + on-screen view) and sending it on WhatsApp. */
'use strict';

/* ---------- Token details shared by the PDF and the on-screen view ---------- */
function tokenRows(t) {
  const p = t.patient, v = t.vitals || {};
  const doc = Store.db.doctors.find(a => a.id === t.doctorId);
  const acct = t.patientId || (patientByPhone(p.phone) || {}).id;
  const vitals = [v.weight && `${v.weight} kg`, v.temp && `${v.temp} °F`, v.bp && `BP ${v.bp}`, v.pulse && `Pulse ${v.pulse}`].filter(Boolean).join('  ·  ');
  return [
    ['Patient', p.name],
    ['Age / gender', [p.age !== '' && p.age !== undefined ? `${p.age} years` : '', p.gender].filter(Boolean).join(' · ')],
    ['Mobile', p.phone],
    acct && ['Patient ID', acct],
    ['Doctor', doc ? `${displayName(doc)}${doc.title ? ' · ' + doc.title : ''}` : 'Any available doctor'],
    ['Visit type', t.visitType || 'New'],
    t.complaint && ['Reason', t.complaint],
    ['Date', fmtDate(t.date)],
    ['Time issued', fmtTime(t.issuedAt)],
    ['Booked via', t.source === 'patient' ? 'Patient app' : `Front desk · ${personName(t.issuedBy)}`],
    t.fee && ['OP fee', `Rs. ${t.fee}${t.payMode ? ' · ' + t.payMode : ''}`],
    vitals && ['Vitals', vitals],
    ['Status', t.status === 'Pending' ? 'Awaiting confirmation (number reserved)' : t.rejected ? 'Booking not accepted' : t.status],
  ].filter(Boolean);
}

/* ---------- Token PDF: a receipt-sized slip with logo and a thin border ---------- */
async function tokenPdf(t) {
  const { jsPDF } = window.jspdf;
  const rows = tokenRows(t);
  const W = 105, M = 9;
  // measure first so the slip is exactly as tall as its content
  const probe = new jsPDF({ unit: 'mm', format: [W, 300] });
  probe.setFontSize(9);
  const wrapped = rows.map(([k, val]) => [k, probe.splitTextToSize(String(val), W - M * 2 - 30)]);
  const listH = wrapped.reduce((s, [, lines]) => s + Math.max(1, lines.length) * 4.2 + 3.2, 0);
  const H = Math.max(160, 92 + listH + 34);
  const doc = new jsPDF({ unit: 'mm', format: [W, H] });
  const logo = await logoPng();

  // thin border and a second hairline inside it
  doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.35); doc.rect(4, 4, W - 8, H - 8);
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.rect(5.5, 5.5, W - 11, H - 11);

  // header
  if (logo) doc.addImage(logo, 'PNG', M, 10, 50, 11.3, 'pc-logo', 'FAST');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 138);
  doc.text('OP TOKEN', W - M, 14.5, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
  doc.text('Out-patient consultation', W - M, 18.5, { align: 'right' });
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.25); doc.line(M, 25, W - M, 25);

  // token number block
  doc.setFillColor(239, 246, 255); doc.setDrawColor(191, 219, 254); doc.setLineWidth(0.3);
  doc.roundedRect(M, 29, W - M * 2, 40, 3, 3, 'FD');
  doc.setFontSize(7.5); doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'bold');
  doc.text('T O K E N   N U M B E R', W / 2, 35, { align: 'center' });
  doc.setFontSize(40); doc.setTextColor(30, 58, 138);
  doc.text(String(t.seq).padStart(3, '0'), W / 2, 52, { align: 'center' });
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(W / 2 - 17, 56, 34, 7.5, 2, 2, 'F');
  doc.setFontSize(10); doc.setTextColor(255, 255, 255);
  doc.text(t.id, W / 2, 61.3, { align: 'center' });

  // date / time strip
  doc.setFontSize(8.5); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
  doc.text(fmtDate(t.date), M, 77);
  doc.text(fmtTime(t.issuedAt), W - M, 77, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
  doc.text('DATE', M, 73); doc.text('TIME', W - M, 73, { align: 'right' });
  doc.setDrawColor(226, 232, 240); doc.line(M, 81, W - M, 81);

  // details
  let y = 87;
  const STATUS = { Pending: [109, 40, 217], Completed: [4, 120, 87], Waiting: [180, 83, 9], 'In consultation': [37, 99, 235], Cancelled: [100, 116, 139] };
  wrapped.forEach(([k, lines], i) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(100, 116, 139);
    doc.text(k, M, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const rgb = k === 'Status' ? STATUS[t.status] : [15, 23, 42];
    doc.setTextColor(...(rgb || [15, 23, 42]));
    doc.text(lines, M + 30, y);
    y += Math.max(1, lines.length) * 4.2 + 3.2;
    if (i < wrapped.length - 1) { doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2); doc.line(M, y - 3.6, W - M, y - 3.6); }
  });

  // cut line and footer
  y += 2;
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(M, y, W - M, y); doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(71, 85, 105);
  const note = doc.splitTextToSize(`Please keep this token and wait for your number to be called. Valid only on ${fmtDate(t.date)}.`, W - M * 2);
  doc.text(note, W / 2, y + 5.5, { align: 'center' });
  doc.setFontSize(6.5); doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${fmtDate(new Date().toISOString())}, ${fmtTime(new Date().toISOString())}  ·  Prime Care Hospital`, W / 2, H - 9, { align: 'center' });
  return doc;
}

async function saveTokenPdf(t) {
  const doc = await tokenPdf(t);
  return saveReport(doc, `PrimeCare_Token_${t.id}.pdf`, 'Tokens');
}

/* ---------- WhatsApp ---------- */
// 10-digit Indian mobile numbers get the 91 country code
const waNumber = phone => {
  const d = digits(phone);
  if (d.length === 10) return '91' + d;
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1);
  return d;
};
const tokenMessage = t => {
  const doc = Store.db.doctors.find(a => a.id === t.doctorId);
  return `Prime Care Hospital\nOP Token ${t.id} (No. ${String(t.seq).padStart(3, '0')}) for ${t.patient.name}\nDoctor: ${doc ? displayName(doc) : 'Any available doctor'}\n${fmtDate(t.date)}, ${fmtTime(t.issuedAt)}\nPlease show this token at the reception.`;
};
async function sendTokenWhatsApp(t) {
  const phone = waNumber(t.patient.phone);
  try {
    const saved = await saveTokenPdf(t);
    if (!NATIVE) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(tokenMessage(t))}`, '_blank');
      toast('Token PDF downloaded and WhatsApp opened');
      return;
    }
    await Plug.PrimeWhatsApp.sendFile({ path: saved.uri, phone, text: tokenMessage(t) });
    Sound.play('success');
  } catch (e) {
    if (e && e.code === 'NOT_INSTALLED') {
      buzz('error');
      openSheet({
        dialog: true,
        html: `<button class="icon-btn dlg-x" data-close aria-label="Close">${I('x')}</button>
          <div class="ic amber">${I('alert')}</div><h2>WhatsApp not installed</h2>
          <p>WhatsApp isn't on this phone. You can share the token PDF another way instead.</p>
          <div class="acts"><button class="btn ghost" data-close>Close</button><button class="btn primary" id="waShare">${I('upload')} Share PDF</button></div>`,
        onMount: async (el, api) => {
          $('#waShare', el).onclick = async () => { const s = await saveTokenPdf(t); sharePdf(s.uri, `Token ${t.id}`); api.close(); };
        },
      });
    } else {
      toast('Could not send on WhatsApp', 'error');
    }
  }
}

// Asked right after the front desk issues a token
function askWhatsApp(t) {
  openSheet({
    dialog: true,
    html: `
      <button class="icon-btn dlg-x" data-close aria-label="Close">${I('x')}</button>
      <div class="ic wa">${I('whatsapp')}</div>
      <h2>Send token on WhatsApp?</h2>
      <p>Send token <b>${esc(t.id)}</b> as a PDF to <b>${esc(t.patient.name)}</b> on <b>+${esc(waNumber(t.patient.phone))}</b>.</p>
      <div class="acts"><button class="btn ghost" data-close>Not now</button><button class="btn wa-btn" id="waYes">${I('whatsapp')} Send</button></div>`,
    onMount: (el, api) => { $('#waYes', el).onclick = () => { api.close(); sendTokenWhatsApp(t); }; },
  });
}

/* ---------- On-screen token view ---------- */
function viewToken(id) {
  const t = Store.db.tokens.find(x => x.id === id);
  if (!t) return;
  const st = TOKEN_STYLE[t.status];
  const hospital = !isPatient();
  openSheet({
    full: true,
    html: `
      <div class="sheet-head"><button class="icon-btn" data-close aria-label="Close">${I('x')}</button><h2>Token ${esc(t.id)}</h2></div>
      <div class="sheet-body tk-view-body">
        <div class="ticket">
          <div class="tk-top">${LOGO_PRINT}<div><b>OP TOKEN</b><small>Out-patient consultation</small></div></div>
          <div class="tk-num"><small>TOKEN NUMBER</small><b>${String(t.seq).padStart(3, '0')}</b><span>${esc(t.id)}</span></div>
          <div class="tk-when"><div><small>DATE</small><b>${fmtDate(t.date)}</b></div><div><small>TIME</small><b>${fmtTime(t.issuedAt)}</b></div></div>
          <div class="tk-rows">${tokenRows(t).filter(r => r[0] !== 'Date' && r[0] !== 'Time issued').map(([k, v]) => `<div><span>${esc(k)}</span><b class="${k === 'Status' ? 'st-' + st[1] : ''}">${esc(v)}</b></div>`).join('')}</div>
          <div class="tk-cut"></div>
          <p class="tk-note">Please keep this token and wait for your number to be called. Valid only on ${fmtDate(t.date)}.</p>
        </div>
      </div>
      <div class="sheet-foot">
        <button class="btn ghost" id="tkPdf">${I('download')} PDF</button>
        ${hospital ? `<button class="btn wa-btn" id="tkWa">${I('whatsapp')} WhatsApp</button>` : `<button class="btn primary" id="tkShare">${I('upload')} Share</button>`}
      </div>`,
    onMount: el => {
      $('#tkPdf', el).onclick = async () => {
        const saved = await saveTokenPdf(t);
        Sound.play('report');
        if (saved.uri) openPdf(saved.uri); else toast('Token PDF downloaded');
      };
      if ($('#tkWa', el)) $('#tkWa', el).onclick = () => sendTokenWhatsApp(t);
      if ($('#tkShare', el)) $('#tkShare', el).onclick = async () => { const s = await saveTokenPdf(t); if (s.uri) sharePdf(s.uri, `Token ${t.id}`); };
    },
  });
}
