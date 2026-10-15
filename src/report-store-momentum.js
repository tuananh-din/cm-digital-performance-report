// ---------- Store momentum: last 3 months of sell-in per store, crossed with the adjusted-target status ----------
// A store can be "on target" this month only because earlier months were strong — momentum shows who is slowing.

const MOMENTUM_SIGNAL = {
  healthy: ['good-t', '✓ Healthy', 'on target and holding up'],
  slowing: ['warn-t', '⚠ On target, slowing', 'met thanks to earlier months, but sell-in is falling'],
  recovering: ['warn-t', '↗ Recovering', 'below target but sell-in is rising'],
  risk: ['bad-t', '✕ At risk', 'below target and not improving'],
};

/** Per-store 3-month revenue window ending at `month` + trend vs the average of the two earlier months. */
function storeMomentum(month, shops) {
  const i = MONTHS.indexOf(month);
  const win = MONTHS.slice(Math.max(0, i - 2), i + 1);
  return shops.filter(s => s.target).map(s => {
    const revs = win.map(m => { const r = RAW_ROWS.find(x => x.shop === s.shop && x.month === m); return r && r.revenue != null ? r.revenue : null; });
    const prior = revs.slice(0, -1).filter(v => v != null);
    const base = prior.length ? prior.reduce((a, v) => a + v, 0) / prior.length : null;
    const chg = base ? s.rev / base - 1 : null;
    const trend = chg == null ? 'new' : chg >= 0.1 ? 'up' : chg <= -0.1 ? 'down' : 'flat';
    const signal = s.met ? (trend === 'down' ? 'slowing' : 'healthy') : (trend === 'up' ? 'recovering' : 'risk');
    return { s, revs, chg, trend, signal };
  });
}

/** Three tiny bars (oldest → current), scaled per row; the current month is the solid brand bar. */
function sparkBars(revs) {
  const max = Math.max(...revs.map(v => v || 0)) || 1;
  return `<svg class="spark" viewBox="0 0 54 22" aria-hidden="true">${revs.map((v, k) => {
    const h = v ? Math.max(2, (v / max) * 20) : 0;
    return `<rect x="${k * 19}" y="${22 - h}" width="14" height="${h}" rx="2" class="${k === revs.length - 1 ? 'cur' : ''}"/>`;
  }).join('')}</svg>`;
}

function renderMomentum(month, shops) {
  const rows = storeMomentum(month, shops);
  const i = MONTHS.indexOf(month), win = MONTHS.slice(Math.max(0, i - 2), i + 1);
  const ms = monthShort(month), priorLbl = win.slice(0, -1).map(monthShort).join('–');
  const order = { slowing: 0, risk: 1, recovering: 2, healthy: 3 };
  rows.sort((a, b) => order[a.signal] - order[b.signal] || (a.chg ?? 0) - (b.chg ?? 0));

  const count = k => rows.filter(r => r.signal === k);
  document.getElementById('m-kpis').innerHTML = ['healthy', 'slowing', 'recovering', 'risk'].map(k => {
    const [cls, label, desc] = MOMENTUM_SIGNAL[k], list = count(k);
    return `<div class="chip"><div class="lbl ${cls}">${label}</div><div class="val">${list.length}</div>
      <div class="sub">${list.map(r => r.s.name).join(', ') || desc}</div></div>`;
  }).join('');

  const pct = v => (v == null ? '<span class="muted">new</span>' : `<span class="${v >= 0 ? 'good-t' : 'bad-t'}">${v >= 0 ? '▲' : '▼'}${Math.abs(v * 100).toFixed(0)}%</span>`);
  const head = `<thead><tr><th>Store</th>${win.map(m => `<th>${monthShort(m)}</th>`).join('')}<th>Trend</th>
    <th>${ms} vs ${priorLbl} avg</th><th>Adjusted target</th><th>Signal</th></tr></thead>`;
  const body = rows.map(r => {
    const [cls, label] = MOMENTUM_SIGNAL[r.signal];
    return `<tr><td><div class="shop-cell">${r.s.name}<span class="pill tier ${(r.s.tier || '').toLowerCase()}">${r.s.tier}</span></div></td>
      ${r.revs.map(v => `<td>${v == null ? '<span class="muted">–</span>' : fmtMoney(v)}</td>`).join('')}
      <td>${sparkBars(r.revs)}</td><td>${pct(r.chg)}</td>
      <td class="${r.s.met ? 'good-t' : 'bad-t'}">${fmtAdj(r.s)}</td><td class="${cls}">${label}</td></tr>`;
  }).join('');
  document.getElementById('momentum').innerHTML = head + `<tbody>${body}</tbody>`;
  document.getElementById('m-note').textContent =
    `Sell-in per store, ${win.map(monthShort).join(' → ')} · trend = ${ms} vs the average of ${priorLbl} (±10% = flat)`;
  return rows;
}
