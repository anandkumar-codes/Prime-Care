/* Prime Care: Insights for hospital users (doctors, managers, staff).
   Everything is computed from the local database. One range filter scopes every
   tile and chart; each chart card has a chart-type dropdown offering only the
   forms that suit its data. Charts are plain HTML/SVG and follow the active theme. */
'use strict';

const INS_RANGES = [[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days']];
// Categorical order is fixed (validated for colour-vision deficiency). Colour follows the
// category's slot, never its rank, so re-sorting or filtering never repaints a category.
const SLOT = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
// Ordinal blue ramp for heatmap bins (validated: light end clears 2:1 on the surface)
const HEAT = ['var(--h1)', 'var(--h2)', 'var(--h3)', 'var(--h4)', 'var(--h5)'];
const TYPE_LABEL = { bar: 'Bar', line: 'Line', heat: 'Heatmap', pie: 'Pie', donut: 'Donut', stack: 'Stacked bar' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ---------- Data ---------- */
function insWindow(days, back = 0) {
  const end = addDays(today(), -days * back);
  const start = addDays(end, -(days - 1));
  return { start, end, days };
}
const inWin = (date, w) => date >= w.start && date <= w.end;
const minutesBetween = (a, b) => (new Date(b) - new Date(a)) / 60000;
const avg = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const localDate = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hourOf = iso => new Date(iso).getHours();
const weekdayOf = date => (new Date(date + 'T00:00:00').getDay() + 6) % 7; // Mon = 0
const hourLabel = h => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
const fmtMin = m => (m === null ? '–' : m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
const fmtPct = p => (p === null ? '–' : `${Math.round(p * 100)}%`);
const fmtNum = n => (n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));
const fmtRs = n => `₹${n >= 1000 ? fmtNum(n) : Math.round(n)}`;

function insStats(w) {
  const all = Store.db.tokens.filter(t => inWin(t.date, w));
  const visits = all.filter(t => t.status !== 'Cancelled');
  const done = all.filter(t => t.status === 'Completed');
  const waits = all.filter(t => t.calledAt).map(t => minutesBetween(t.issuedAt, t.calledAt)).filter(m => m >= 0 && m < 24 * 60);
  const consults = done.filter(t => t.calledAt && t.completedAt).map(t => minutesBetween(t.calledAt, t.completedAt)).filter(m => m >= 0 && m < 12 * 60);
  const created = list => list.filter(x => x.createdAt && inWin(localDate(x.createdAt), w)).length;
  return {
    all, visits, done,
    completion: visits.length ? done.length / visits.length : null,
    wait: avg(waits),
    consult: avg(consults),
    fees: visits.reduce((s, t) => s + (+t.fee || 0), 0),
    appShare: visits.length ? visits.filter(t => t.source === 'patient').length / visits.length : null,
    newPatients: created(Store.db.patients),
  };
}

/* ---------- Chart primitives ---------- */
function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) { const c = m * p; if (c >= v && (c / 2) % 1 === 0) return c; }
  return Math.ceil(v);
}
const peakIndex = items => items.reduce((b, it, i) => (it.v > items[b].v ? i : b), 0);
const gridLines = max => [0, 0.5, 1].map(f => `<div class="vz-grid" style="bottom:${f * 100}%"><span>${fmtNum(max * f)}</span></div>`).join('');
const xAxis = (items, every) => `<div class="vz-x">${items.map((it, i) => `<span>${i % every === 0 ? esc(it.l) : ''}</span>`).join('')}</div>`;
const noData = '<p class="vz-none">No data in this period</p>';
const total = items => items.reduce((s, x) => s + x.v, 0);

// Vertical columns, one series; only the tallest column carries a direct label
function vizColumns(items, { every = 1 } = {}) {
  if (!total(items)) return noData;
  const max = niceMax(Math.max(...items.map(i => i.v)));
  const pk = peakIndex(items);
  return `
    <div class="vz-cols">
      <div class="vz-plot">${gridLines(max)}
        <div class="vz-bars">${items.map((it, i) => `
          <div class="vz-col" tabindex="0" data-tip="${esc(it.tip || `${it.l}: ${it.v}`)}">
            ${i === pk ? `<em style="bottom:${(it.v / max) * 100}%">${fmtNum(it.v)}</em>` : ''}
            <i style="height:${it.v ? Math.max((it.v / max) * 100, 1.5) : 0}%"></i>
          </div>`).join('')}
        </div>
      </div>${xAxis(items, every)}
    </div>`;
}
// Line: 2px stroke, 10% area wash, 8px dots with a 2px surface ring; each point has a full-height hit column
function vizLine(items, { every = 1 } = {}) {
  if (!total(items)) return noData;
  const max = niceMax(Math.max(...items.map(i => i.v)));
  const n = items.length;
  const x = i => (n === 1 ? 50 : ((i + 0.5) / n) * 100);
  const y = v => 100 - (v / max) * 100;
  const pts = items.map((it, i) => `${x(i)},${y(it.v)}`).join(' ');
  const pk = peakIndex(items);
  const dots = n <= 31;
  return `
    <div class="vz-cols vz-linechart">
      <div class="vz-plot">${gridLines(max)}
        <svg class="vz-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="${x(0)},100 ${pts} ${x(n - 1)},100" class="vz-area"/>
          <polyline points="${pts}" class="vz-line" vector-effect="non-scaling-stroke"/>
        </svg>
        <div class="vz-bars">${items.map((it, i) => `
          <div class="vz-pt" tabindex="0" data-tip="${esc(it.tip || `${it.l}: ${it.v}`)}">
            <b class="${dots || i === pk ? '' : 'faint'}" style="top:${y(it.v)}%"></b>
            ${i === pk ? `<em style="bottom:${(it.v / max) * 100}%">${fmtNum(it.v)}</em>` : ''}
          </div>`).join('')}
        </div>
      </div>${xAxis(items, every)}
    </div>`;
}
// Horizontal bars, one series, value at the tip
function vizHBars(items) {
  if (!items.length) return noData;
  const max = Math.max(1, ...items.map(i => i.v));
  return `<div class="vz-hbars">${items.map(it => `
    <div class="vz-hrow" tabindex="0" data-tip="${esc(it.tip || `${it.l}: ${it.v}`)}">
      <span class="vz-hl">${esc(it.l)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
      <span class="vz-ht"><i style="width:${(it.v / max) * 100}%"></i><b>${fmtNum(it.v)}</b></span>
    </div>`).join('')}</div>`;
}
const legend = items => {
  const t = total(items);
  return `<div class="vz-legend">${items.map(p => `
    <span><i style="background:${SLOT[p.slot % 8]}"></i>${esc(p.l)}<b>${p.v}</b><small>${t ? Math.round((p.v / t) * 100) : 0}%</small></span>`).join('')}</div>`;
};
// Part-to-whole: one stacked bar with 2px surface gaps
function vizStack(items) {
  const t = total(items);
  if (!t) return noData;
  return `
    <div class="vz-stack">${items.filter(p => p.v).map(p => `<i tabindex="0" style="flex:${p.v};background:${SLOT[p.slot % 8]}" data-tip="${esc(`${p.l}: ${p.v} (${Math.round((p.v / t) * 100)}%)`)}"></i>`).join('')}</div>
    ${legend(items)}`;
}
// Pie / donut: slices separated by a surface-coloured gap; the legend carries label, count and share
function vizPie(items, donut) {
  const t = total(items);
  if (!t) return noData;
  const R = 48, r = donut ? 30 : 0, C = 50;
  const pt = (rad, a) => [C + rad * Math.sin(a), C - rad * Math.cos(a)];
  let a0 = 0;
  const slices = items.filter(p => p.v).map(p => {
    const a1 = a0 + (p.v / t) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    let d;
    if (p.v === t) {
      d = donut ? `M${C} ${C - R}A${R} ${R} 0 1 1 ${C - 0.01} ${C - R}ZM${C} ${C - r}A${r} ${r} 0 1 0 ${C + 0.01} ${C - r}Z` : `M${C} ${C - R}A${R} ${R} 0 1 1 ${C - 0.01} ${C - R}Z`;
    } else {
      const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1);
      if (donut) {
        const [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
        d = `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`;
      } else {
        d = `M${C} ${C}L${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}Z`;
      }
    }
    a0 = a1;
    return `<path d="${d}" fill="${SLOT[p.slot % 8]}" fill-rule="evenodd" tabindex="0" data-tip="${esc(`${p.l}: ${p.v} (${Math.round((p.v / t) * 100)}%)`)}"/>`;
  }).join('');
  return `
    <div class="vz-pie">
      <div class="vz-pie-fig">
        <svg viewBox="0 0 100 100" role="img" aria-label="${donut ? 'Donut' : 'Pie'} chart">${slices}</svg>
        ${donut ? `<div class="vz-pie-c"><b>${fmtNum(t)}</b><small>total</small></div>` : ''}
      </div>
      ${legend(items)}
    </div>`;
}
// Heatmap grid: rows × columns of cells binned onto the blue ramp, with a Less → More key
function vizHeat(rows, cols, cell, { rowW = 34 } = {}) {
  let max = 0;
  const vals = rows.map((r, ri) => cols.map((c, ci) => { const v = cell(ri, ci); if (v && v.v > max) max = v.v; return v; }));
  if (!max) return noData;
  const bin = v => (v ? HEAT[Math.min(4, Math.floor((v / max) * 5 - 1e-9))] : 'var(--h0)');
  return `
    <div class="vz-heat" style="--rowW:${rowW}px">
      <div class="vz-heat-grid" style="grid-template-columns:var(--rowW) repeat(${cols.length}, minmax(0, 26px))">
        ${rows.map((r, ri) => `<span class="vz-heat-r">${esc(r)}</span>${cols.map((c, ci) => {
          const v = vals[ri][ci];
          if (!v) return '<i class="blank"></i>';
          return `<i tabindex="0" style="background:${bin(v.v)}" data-tip="${esc(v.tip)}"></i>`;
        }).join('')}`).join('')}
        <span></span>${cols.map(c => `<span class="vz-heat-c">${esc(c)}</span>`).join('')}
      </div>
      <div class="vz-heat-key"><span>Less</span><i style="background:var(--h0)"></i>${HEAT.map(h => `<i style="background:${h}"></i>`).join('')}<span>More</span><small>max ${max}</small></div>
    </div>`;
}
const vizTable = (head, rows) => `<table class="vz-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

/* ---------- Tooltip (hover on desktop, tap on phones) ---------- */
function hideVizTip() { const t = $('#vzTip'); if (t) t.classList.remove('show'); }
function bindTips(root) {
  let tip = $('#vzTip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'vzTip'; document.body.appendChild(tip); }
  let hideT;
  const show = el => {
    clearTimeout(hideT);
    tip.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect();
    tip.classList.add('show');
    const tw = tip.offsetWidth;
    tip.style.left = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2)) + 'px';
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + 'px';
    $$('.vz-on', root).forEach(x => x.classList.remove('vz-on'));
    el.classList.add('vz-on');
  };
  const hide = () => { tip.classList.remove('show'); $$('.vz-on', root).forEach(x => x.classList.remove('vz-on')); };
  $$('[data-tip]', root).forEach(el => {
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(el); });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    el.addEventListener('click', () => { show(el); clearTimeout(hideT); hideT = setTimeout(hide, 2500); });
    el.addEventListener('focus', () => show(el));
    el.addEventListener('blur', hide);
  });
  window.addEventListener('scroll', hide, { passive: true, once: true });
}

/* ---------- Cards ----------
   A card = { id, title, sub, types, items, render(type), table }.
   The chosen type per card is remembered for the session in S.vzTypes. */
const CARD_TINTS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#0891b2', '#db2777'];
function cardHtml(c, i = 0) {
  const type = (S.vzTypes && S.vzTypes[c.id]) || c.types[0];
  return `
  <section class="vz-card" data-card="${c.id}" style="--c:${CARD_TINTS[i % CARD_TINTS.length]}">
    <div class="vz-head"><div><h3>${esc(c.title)}</h3>${c.sub ? `<p>${esc(c.sub)}</p>` : ''}</div>
      ${c.types.length > 1 ? `<label class="vz-type" aria-label="Chart type">${I(typeIcon(type))}<select>${c.types.map(t => `<option value="${t}" ${t === type ? 'selected' : ''}>${TYPE_LABEL[t]}</option>`).join('')}</select></label>` : ''}
      <button class="vz-toggle" type="button" aria-label="Show as table">Table</button></div>
    <div class="vz-body vz-chart">${c.render(type)}</div>
    <div class="vz-body hidden">${c.table}</div>
  </section>`;
}
const typeIcon = t => ({ bar: 'barChart', line: 'activity', heat: 'grid', pie: 'pie', donut: 'donut', stack: 'stackBar' }[t] || 'barChart');
// The default categorical "bar" for part-to-whole cards is a horizontal bar list
const catRender = (items, opts = {}) => type =>
  type === 'pie' ? vizPie(items, false)
    : type === 'donut' ? vizPie(items, true)
      : type === 'stack' ? vizStack(items)
        : type === 'line' ? vizLine(items, opts)
          : opts.columns ? vizColumns(items, opts) : vizHBars(items);

/* ---------- Page ---------- */
function renderInsights() {
  hideVizTip();
  S.vzTypes = S.vzTypes || {};
  const days = S.insRange || 7;
  const w = insWindow(days), prev = insWindow(days, 1);
  const cur = insStats(w), old = insStats(prev);
  const periodName = days === 1 ? 'yesterday' : `the previous ${days} days`;
  const dates = []; for (let d = w.start; d <= w.end; d = addDays(d, 1)) dates.push(d);
  const manager = !isStaff();
  const visitsOn = d => cur.visits.filter(t => t.date === d);
  const cards = [];

  /* Visits over time: by hour (Today), by day (7/30), by week (90). Heatmap = calendar or day × hour */
  let trend, every = 1, trendSub;
  if (days === 1) {
    const hrs = []; for (let h = 7; h <= 21; h++) hrs.push(h);
    trend = hrs.map(h => { const n = cur.visits.filter(t => hourOf(t.issuedAt) === h).length; return { l: hourLabel(h), v: n, tip: `${hourLabel(h)}–${hourLabel(h + 1)}: ${n} visit${n === 1 ? '' : 's'}` }; });
    every = 2; trendSub = 'OP visits by hour, today';
  } else if (days <= 30) {
    trend = dates.map(d => {
      const n = visitsOn(d).length, dt = new Date(d + 'T00:00:00');
      return { l: days === 7 ? WEEKDAYS[weekdayOf(d)] : String(dt.getDate()), v: n, tip: `${fmtDate(d)}: ${n} visit${n === 1 ? '' : 's'}` };
    });
    every = days === 7 ? 1 : 5; trendSub = `OP visits per day, last ${days} days`;
  } else {
    trend = [];
    for (let i = 0; i < dates.length; i += 7) {
      const wk = dates.slice(i, i + 7);
      const n = cur.visits.filter(t => wk.includes(t.date)).length;
      trend.push({ l: fmtDate(wk[0]).split(' ').slice(0, 2).join(' '), v: n, tip: `Week of ${fmtDate(wk[0])}: ${n} visits` });
    }
    every = 3; trendSub = 'OP visits per week, last 90 days';
  }
  const trendHeat = () => {
    if (days <= 7) {
      // rows = each day, columns = hours
      const hrs = []; for (let h = 8; h <= 20; h++) hrs.push(h);
      return vizHeat(dates.map(d => (days === 1 ? 'Today' : WEEKDAYS[weekdayOf(d)])), hrs.map(h => (h % 2 === 0 ? hourLabel(h).replace(/m$/, '') : '')), (ri, ci) => {
        const n = visitsOn(dates[ri]).filter(t => hourOf(t.issuedAt) === hrs[ci]).length;
        return { v: n, tip: `${fmtDate(dates[ri])}, ${hourLabel(hrs[ci])}: ${n} visit${n === 1 ? '' : 's'}` };
      }, { rowW: 40 });
    }
    // calendar: rows = Mon..Sun, columns = weeks
    const first = addDays(dates[0], -weekdayOf(dates[0]));
    const weeks = []; for (let d = first; d <= w.end; d = addDays(d, 7)) weeks.push(d);
    return vizHeat(WEEKDAYS.map((x, i) => (i % 2 === 0 ? x : '')), weeks.map((wk, i) => (i % (days > 30 ? 3 : 1) === 0 ? String(new Date(wk + 'T00:00:00').getDate()) : '')), (ri, ci) => {
      const d = addDays(weeks[ci], ri);
      if (d < w.start || d > w.end) return null;
      const n = visitsOn(d).length;
      return { v: n, tip: `${fmtDate(d)}: ${n} visit${n === 1 ? '' : 's'}` };
    });
  };
  cards.push({
    id: 'trend', title: 'Visits over time', sub: trendSub, types: ['bar', 'line', 'heat'],
    render: t => (t === 'heat' ? trendHeat() : t === 'line' ? vizLine(trend, { every }) : vizColumns(trend, { every })),
    table: vizTable(['Period', 'Visits'], trend.map(t => [t.tip.split(':')[0], t.v])),
  });

  /* Peak hours */
  const byHour = {}; cur.visits.forEach(t => { const h = hourOf(t.issuedAt); byHour[h] = (byHour[h] || 0) + 1; });
  const hourKeys = Object.keys(byHour).map(Number);
  const hLo = Math.min(8, ...hourKeys), hHi = Math.max(20, ...hourKeys);
  const peak = []; for (let h = hLo; h <= hHi; h++) peak.push({ l: hourLabel(h), v: byHour[h] || 0, h, tip: `${hourLabel(h)}–${hourLabel(h + 1)}: ${byHour[h] || 0} visits` });
  const busiest = hourKeys.length ? hourKeys.reduce((a, b) => (byHour[b] > byHour[a] ? b : a)) : null;
  if (days > 1) {
    cards.push({
      id: 'peak', title: 'Peak hours', sub: 'When patients arrive (token issue time)', types: ['bar', 'heat', 'line'],
      render: t => (t === 'heat'
        ? vizHeat(WEEKDAYS, peak.map(p => (p.h % 2 === 0 ? p.l.replace(/m$/, '') : '')), (ri, ci) => {
          const n = cur.visits.filter(x => weekdayOf(x.date) === ri && hourOf(x.issuedAt) === peak[ci].h).length;
          return { v: n, tip: `${WEEKDAYS[ri]} ${peak[ci].l}: ${n} visit${n === 1 ? '' : 's'}` };
        })
        : t === 'line' ? vizLine(peak, { every: 2 }) : vizColumns(peak, { every: 2 })),
      table: vizTable(['Hour', 'Visits'], peak.map(p => [p.tip.split(':')[0], p.v])),
    });
  }

  /* Doctor workload: slot follows the doctor's position in the doctors list, not their rank */
  const docList = [...doctors().map(d => ({ id: d.id, name: displayName(d) })), { id: '', name: 'Any available doctor' }];
  const docRows = docList.map((d, slot) => {
    const mine = cur.visits.filter(t => t.doctorId === d.id);
    const doneN = mine.filter(t => t.status === 'Completed');
    const c = avg(doneN.filter(t => t.calledAt && t.completedAt).map(t => minutesBetween(t.calledAt, t.completedAt)));
    return { l: d.name, v: mine.length, slot, sub: `${doneN.length} completed · avg consult ${fmtMin(c)}`, tip: `${d.name}: ${mine.length} visits, ${doneN.length} completed` };
  }).filter(r => r.v || r.l !== 'Any available doctor');
  const topDoc = [...docRows].sort((a, b) => b.v - a.v).find(r => r.l !== 'Any available doctor' && r.v);
  cards.push({
    id: 'docs', title: 'Doctor workload', sub: 'OP visits assigned to each doctor', types: ['bar', 'pie', 'donut'],
    render: t => (t === 'bar' ? vizHBars([...docRows].sort((a, b) => b.v - a.v)) : catRender(docRows)(t)),
    table: vizTable(['Doctor', 'Visits', 'Details'], docRows.map(r => [r.l, r.v, r.sub])),
  });

  /* Part-to-whole mixes */
  const status = [['Completed', 0], ['Waiting', 1], ['In consultation', 2], ['Cancelled', 3], ['Pending', 4]].map(([s, slot]) => ({ l: s === 'In consultation' ? 'With doctor' : s === 'Pending' ? 'Awaiting confirmation' : s, v: cur.all.filter(t => t.status === s).length, slot }));
  const visitTypes = ['New', 'Follow-up', 'Emergency'].map((v, slot) => ({ l: v, v: cur.visits.filter(t => (t.visitType || 'New') === v).length, slot }));
  const source = [{ l: 'Front desk', v: cur.visits.filter(t => t.source !== 'patient').length, slot: 0 }, { l: 'Patient app', v: cur.visits.filter(t => t.source === 'patient').length, slot: 1 }];
  const genders = GENDERS.map((g, slot) => ({ l: g, v: cur.visits.filter(t => t.patient.gender === g).length, slot }));
  const mix = (id, title, sub, items, head) => cards.push({
    id, title, sub, types: ['stack', 'pie', 'donut', 'bar'], render: catRender(items),
    table: vizTable([head, 'Count', 'Share'], items.map(s => [s.l, s.v, `${total(items) ? Math.round((s.v / total(items)) * 100) : 0}%`])),
  });
  mix('status', 'Token outcomes', 'Where every booking in this period ended up', status, 'Status');
  mix('vtype', 'Visit type', 'New patients, follow-ups and emergencies', visitTypes, 'Type');
  mix('source', 'How tokens were booked', 'Front desk compared with the patient app', source, 'Source');

  /* Patients */
  const bands = [['0–12', 0, 12], ['13–17', 13, 17], ['18–39', 18, 39], ['40–59', 40, 59], ['60+', 60, 200]]
    .map(([l, a, b], slot) => { const n = cur.visits.filter(t => t.patient.age !== '' && +t.patient.age >= a && +t.patient.age <= b).length; return { l, v: n, slot, tip: `Age ${l}: ${n} visits` }; });
  cards.push({
    id: 'age', title: 'Patients by age', sub: 'Age bands of OP visitors', types: ['bar', 'line', 'pie', 'donut'],
    render: catRender(bands, { columns: true }),
    table: vizTable(['Age band', 'Visits'], bands.map(b => [b.l, b.v])),
  });
  mix('gender', 'Patients by gender', '', genders, 'Gender');

  /* Hospital (doctors and managers) */
  if (manager) {
    // More than 8 roles would exceed the palette, so the tail folds into "Other"
    let roles = STAFF_ROLES.map((r, slot) => ({ l: r, v: Store.db.staff.filter(s => s.role === r && s.status !== 'Inactive').length, slot })).filter(r => r.v);
    if (roles.length > 8) {
      const keep = [...roles].sort((a, b) => b.v - a.v).slice(0, 7).map(r => r.l);
      const other = roles.filter(r => !keep.includes(r.l)).reduce((s, r) => s + r.v, 0);
      roles = roles.filter(r => keep.includes(r.l)).map((r, i) => ({ ...r, slot: i })).concat({ l: 'Other', v: other, slot: 7 });
    } else {
      roles = roles.map((r, i) => ({ ...r, slot: i }));
    }
    if (roles.length) {
      cards.push({
        id: 'roles', title: 'Active staff by role', sub: `${total(roles)} active staff`, types: ['bar', 'pie', 'donut'],
        render: t => (t === 'bar' ? vizHBars([...roles].sort((a, b) => b.v - a.v)) : catRender(roles)(t)),
        table: vizTable(['Role', 'Staff'], roles.map(r => [r.l, r.v])),
      });
    }
  }

  const myStats = isDoctor() ? (() => {
    const mine = cur.done.filter(t => t.consultedBy === S.user.id || t.doctorId === S.user.id);
    return { n: mine.length, c: avg(mine.filter(t => t.calledAt && t.completedAt).map(t => minutesBetween(t.calledAt, t.completedAt))) };
  })() : null;

  /* Headline insights in plain words */
  const heads = [];
  const vNow = cur.visits.length, vOld = old.visits.length;
  if (vNow || vOld) {
    const ch = vOld ? Math.round(((vNow - vOld) / vOld) * 100) : null;
    heads.push(['activity', ch === null ? `${vNow} OP visit${vNow === 1 ? '' : 's'} in this period` : ch === 0 ? `Visits are level with ${periodName} (${vNow})` : `Visits are ${ch > 0 ? 'up' : 'down'} ${Math.abs(ch)}% on ${periodName} (${vOld} → ${vNow})`]);
  }
  if (busiest !== null && days > 1) heads.push(['clock', `Busiest hour is ${hourLabel(busiest)}–${hourLabel(busiest + 1)} with ${byHour[busiest]} visits`]);
  if (days >= 7 && vNow) {
    const byDay = WEEKDAYS.map((_, i) => cur.visits.filter(t => weekdayOf(t.date) === i).length);
    const bd = byDay.indexOf(Math.max(...byDay));
    heads.push(['calendar', `${['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'][bd]} are the busiest day of the week (${byDay[bd]} visits)`]);
  }
  if (topDoc) heads.push(['stetho', `${topDoc.l} saw the most patients (${topDoc.v})`]);
  if (cur.wait !== null) heads.push(['clock', `Patients waited ${fmtMin(cur.wait)} on average before seeing a doctor`]);
  const cancelled = status[3].v;
  if (cancelled) heads.push(['ban', `${cancelled} token${cancelled === 1 ? ' was' : 's were'} cancelled (${fmtPct(cancelled / Math.max(1, cur.all.length))} of all bookings)`]);
  if (cur.appShare) heads.push(['user', `${fmtPct(cur.appShare)} of visits were booked by patients in the app`]);

  const delta = (a, b, upGood, fmt = x => x) => {
    if (a === null || b === null || b === 0) return '<span class="vz-d">–</span>';
    const d = a - b;
    if (Math.abs(d) < 1e-9) return '<span class="vz-d">no change</span>';
    const good = (d > 0) === upGood;
    return `<span class="vz-d ${good ? 'good' : 'bad'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</span>`;
  };
  const tile = (icon, label, value, d, hero = false) => `<div class="vz-tile ${hero ? 'hero' : ''}"><span class="vz-tl">${I(icon)}${esc(label)}</span><b>${value}</b>${d}</div>`;

  $('#page').innerHTML = `
    <div class="page-head ins-head"><button class="icon-btn" id="insBack" aria-label="Back">${I('chevL')}</button><h1>Insights</h1>${headRep('repIns')}<span class="count">${days === 1 ? fmtDate(today()) : `${fmtDate(w.start)} – ${fmtDate(w.end)}`}</span></div>
    <div class="filters ins-range">${INS_RANGES.map(([d, l]) => `<button data-days="${d}" class="${d === days ? 'on' : ''}">${l}</button>`).join('')}</div>

    <div class="vz-tiles">
      ${tile('ticket', 'OP visits', fmtNum(vNow), `${delta(vNow, vOld, true)}<small>vs ${periodName}</small>`, true)}
      ${tile('checkCircle', 'Completed', fmtPct(cur.completion), delta(cur.completion, old.completion, true, x => `${Math.round(x * 100)} pts`))}
      ${tile('clock', 'Avg wait', fmtMin(cur.wait), delta(cur.wait, old.wait, false, x => fmtMin(x)))}
      ${tile('stetho', 'Avg consultation', fmtMin(cur.consult), delta(cur.consult, old.consult, false, x => fmtMin(x)))}
      ${tile('rupee', 'OP fees', fmtRs(cur.fees), delta(cur.fees, old.fees, true, x => fmtRs(x)))}
      ${tile('userPlus', 'New patients', String(cur.newPatients), '<span class="vz-d">registered in the app</span>')}
    </div>

    ${myStats ? `<div class="vz-me">${I('stetho')}<span>You completed <b>${myStats.n}</b> consultation${myStats.n === 1 ? '' : 's'} in this period${myStats.c !== null ? `, averaging <b>${fmtMin(myStats.c)}</b> each` : ''}.</span></div>` : ''}

    ${heads.length ? `<section class="vz-card vz-heads"><h3>Key insights</h3>${heads.map(([ic, t]) => `<div class="vz-hl-row">${I(ic)}<span>${esc(t)}</span></div>`).join('')}</section>`
      : emptyState('activity', 'blue', 'Not enough data yet', 'Insights appear here once OP tokens are issued.')}

    ${cards.map(cardHtml).join('')}
  `;

  $('#insBack').onclick = () => go(tabsFor()[0][0]);
  $('#repIns').onclick = () => openReports({ type: 'daily', preset: { 1: 'today', 7: 'last7', 30: 'last30' }[days] || 'custom', from: w.start, to: w.end });
  $$('.ins-range button').forEach(b => { b.onclick = () => { S.insRange = +b.dataset.days; buzz(); renderInsights(); }; });
  $$('.vz-card[data-card]').forEach(el => {
    const card = cards.find(c => c.id === el.dataset.card);
    const sel = $('.vz-type select', el);
    if (sel) {
      sel.onchange = () => {
        hideVizTip();
        S.vzTypes[card.id] = sel.value;
        const body = $('.vz-chart', el);
        body.innerHTML = card.render(sel.value);
        body.classList.remove('hidden');
        $$('.vz-body', el)[1].classList.add('hidden');
        $('.vz-toggle', el).textContent = 'Table';
        $('.vz-type', el).firstElementChild.outerHTML = I(typeIcon(sel.value));
        bindTips(body);
        buzz();
      };
    }
    $('.vz-toggle', el).onclick = () => {
      const [chart, table] = $$('.vz-body', el);
      const showTable = table.classList.contains('hidden');
      chart.classList.toggle('hidden', showTable);
      table.classList.toggle('hidden', !showTable);
      $('.vz-toggle', el).textContent = showTable ? 'Chart' : 'Table';
    };
  });
  bindTips($('#page'));
}
