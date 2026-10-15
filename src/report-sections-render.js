// ---------- DOM sections: hero text, KPI tiles, concentration alert, funnel, store matrix ----------

function deltaBadge(cur, prev, goodWhenUp, label = 'MoM') {
  const d = pctChange(cur, prev);
  if (d == null || !isFinite(d)) return `<span class="delta">— ${label}</span>`;
  const arrow = d >= 0 ? '▲' : '▼';
  const cls = goodWhenUp == null ? '' : (d >= 0) === goodWhenUp ? 'up' : 'down';
  return `<span class="delta ${cls}">${arrow} ${Math.abs(d * 100).toFixed(1)}% ${label}</span>`;
}

function renderHero(month, t) {
  document.getElementById('hero-sub').innerHTML =
    `<b>Channel Marketing · ${monthLabel(month)}</b> · ${t.shops} stores with data · Facebook Ads + store revenue · ROAS/CIR weighted (sum ÷ sum)`;
  document.title = `CM Digital Performance · ${monthLabel(month)}`;
}

/** Coloured "▲12% MoM" text for compact tiles. */
function momText(cur, prev, goodUp) {
  const d = pctChange(cur, prev);
  if (d == null || !isFinite(d)) return '';
  const cls = goodUp == null ? '' : (d >= 0) === goodUp ? 'good-t' : 'bad-t';
  return ` · <span class="${cls}">${d >= 0 ? '▲' : '▼'}${Math.abs(d * 100).toFixed(0)}% MoM</span>`;
}

function renderKpis(t, p) {
  const P = p || {};
  // Part 1 — business view: sell-in, target, marketing cost and what it returned
  const tiles = [
    ['Sell-in Revenue', fmtMoney(t.rev), `${t.hits}/${t.nT} stores on adjusted target`, deltaBadge(t.rev, P.rev, true)],
    ['Stores on Target', `${t.hits}/${t.nT}`, `monthly plan only ${t.planHits}/${t.nT}`, `<span class="delta">adjusted to ${t.qLabel}</span>`],
    ['Marketing Cost (FB)', fmtMoney(t.ad), `${fmtPct(t.budgetUse, 0)} of budget ${fmtMoney(t.budget)}`, deltaBadge(t.ad, P.ad, null)],
    ['% CIR', fmtPct(t.cir, 2), 'marketing cost ÷ sell-in', deltaBadge(t.cir, P.cir, false)],
    ['ROAS', fmtNum(t.roas, 1), 'sell-in ÷ marketing cost', deltaBadge(t.roas, P.roas, true)],
    ['Sale Units', fmtInt(t.units), `${fmtPct(t.unitAch, 0)} of unit target ${fmtInt(t.tUnits)}`, deltaBadge(t.units, P.units, true)],
  ];
  document.getElementById('kpi-hero').innerHTML = tiles.map(([l, v, s, d]) =>
    `<div class="kpi"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div>${d}</div>`).join('');

  // Part 2 — digital view: conversations, their cost and quality
  const chips = [
    ['FB Messages', fmtInt(t.msg), `${fmtInt(t.msg2)} two-way${momText(t.msg, P.msg, true)}`],
    ['Cost/Message', fmtMoney(t.cpm), `FB cost ÷ messages${momText(t.cpm, P.cpm, false)}`],
    ['% 2-way / message', fmtPct(t.r2, 0), `${fmtInt(t.msg2)} conversations`],
    ['% 5-way / 2-way', fmtPct(t.r5, 1), `${fmtInt(t.msg5)} deep conversations${momText(t.msg5, P.msg5, true)}`],
    ['Purchases from msg', fmtInt(t.buy), `${fmtPct(t.buyRate, 2)} of messages${momText(t.buy, P.buy, true)}`],
    ['FB Comments', fmtInt(t.cmt), `${fmtMoney(t.cpc)} / comment${momText(t.cmt, P.cmt, true)}`],
    ['New followers', fmtInt(t.fol), `fanpage${momText(t.fol, P.fol, true)}`],
  ];
  document.getElementById('kpi-strip').innerHTML = chips.map(([l, v, s]) =>
    `<div class="chip"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`).join('');
}

/** Flag when one store carries an outsized share of revenue — totals then mislead. */
function renderConcentrationAlert(shops, t) {
  const slot = document.getElementById('alert-slot');
  const top = [...shops].sort((a, b) => b.rev - a.rev)[0];
  const share = div(top.rev, t.rev);
  if (!top || share < 0.35) { slot.innerHTML = ''; return; }
  const rest = aggregate(shops.filter(s => s.shop !== top.shop));
  const restOthers = shops.filter(s => s.shop !== top.shop && s.target);
  const restAch = div(restOthers.reduce((a, s) => a + s.rev, 0), restOthers.reduce((a, s) => a + Math.max(0, s.tAdj), 0));
  slot.innerHTML = `<div class="alert"><div class="ico">!</div><div>
    <h4>${top.name} makes up ${fmtPct(share, 0)} of monthly revenue — totals are skewed by a single store</h4>
    <p>${top.name}: <b>${fmtMoney(top.rev)}</b> (${fmtPct(top.achM, 0)} of monthly plan, ${fmtInt(top.units)} units vs target ${fmtInt(top.t_units)}).
    Excluding it, the other stores reach <b>${fmtPct(restAch, 1)} of adjusted target</b> (${restOthers.filter(s => s.met).length}/${restOthers.length} on target),
    ROAS <b>${fmtNum(rest.roas, 1)}</b>, CIR <b>${fmtPct(rest.cir, 2)}</b>, Cost/Message <b>${fmtMoney(rest.cpm)}</b>.</p>
  </div></div>`;
}

/** Message funnel (single series → one colour) + per-shop conversion ranks. */
function renderFunnel(t, shops) {
  const steps = [['Total message', t.msg], ['2-way', t.msg2], ['5-way', t.msg5], ['Purchases', t.buy]];
  const conv = [null, t.r2, t.r5, div(t.buy, t.msg5)];
  const convLbl = [null, '2-way / message', '5-way / 2-way', 'purchase / 5-way'];
  let html = steps.map(([l, v], i) => `
    <div class="f-step"><div class="f-lbl">${l}</div>
      <div class="f-bar" style="width:${Math.max(4, div(v, t.msg) * 100)}%;background:var(--brand)"
        data-tip="<b>${l}</b>: ${fmtInt(v)}<br>${fmtPct(div(v, t.msg), 1)} of total messages">${fmtInt(v)}</div>
      ${conv[i] != null ? `<div class="f-conv"><b>${fmtPct(conv[i], 1)}</b> ${convLbl[i]}</div>` : ''}</div>`).join('');
  const rank = (key, title, fmt) => {
    const top = shops.filter(s => s[key] != null && s.msgs > 0).sort((a, b) => b[key] - a[key]);
    return `<div class="f-split"><h4>${title}</h4><div class="mini-rank">${top.map(s =>
      `<div><span>${s.name}</span><span>${fmt(s[key])}</span></div>`).join('')}</div></div>`;
  };
  html += rank('r5', '% 5-way / 2-way by store', v => fmtPct(v, 0));
  html += rank('buyRate', '% Purchase / message by store', v => fmtPct(v, 1));
  const el = document.getElementById('funnel');
  el.innerHTML = html;
  Tip.bind(el);
}

/* ---------- sortable shop matrix ---------- */
const MATRIX_COLS = [
  { k: 'name', l: 'Store' },
  { k: 'rev', l: 'Revenue', f: v => fmtMoney(v), bar: true },
  { k: 'ach', l: 'Adj. target', f: v => (v == null ? '–' : v >= 1 ? '✓ Met' : fmtPct(v, 0)), cls: v => (v >= 1 ? 'good-t' : v < 0.7 ? 'bad-t' : '') },
  { k: 'achM', l: '% of plan', f: v => `<span class="muted">${fmtPct(v, 0)}</span>` },
  { k: 'adCost', l: 'Ad spend', f: v => fmtMoney(v), bar: true, navy: true },
  { k: 'budgetUse', l: '% Budget', f: v => (v === Infinity ? '<span class="flag">No plan</span>' : fmtPct(v, 0)) },
  { k: 'roas', l: 'ROAS', f: v => fmtNum(v, 1), bar: true },
  { k: 'cir', l: '% CIR', f: v => fmtPct(v, 2), cls: (v, t) => (v > 2 * t.cir ? 'bad-t' : '') },
  { k: 'msgs', l: 'Messages', f: fmtInt, bar: true, navy: true },
  { k: 'cpm', l: 'Cost/Msg', f: v => fmtMoney(v), bar: true, cls: (v, t) => (v > 1.3 * t.cpm ? 'bad-t' : v < 0.75 * t.cpm ? 'good-t' : '') },
  { k: 'r2', l: '2-way %', f: v => fmtPct(v, 0) },
  { k: 'r5', l: '5-way/2-way', f: v => fmtPct(v, 0) },
  { k: 'purchase_msg', l: 'Purch. (msg)', f: fmtInt },
  { k: 'mom', l: 'Rev. MoM', f: v => (v == null ? '<span class="pill">new</span>' : `<span class="${v >= 0 ? 'good-t' : 'bad-t'}">${v >= 0 ? '▲' : '▼'}${Math.abs(v * 100).toFixed(0)}%</span>`) },
];
const matrixSort = { key: 'rev', dir: -1 };

function renderMatrix(shops, t, prevRows) {
  const prevBy = Object.fromEntries((prevRows || []).map(r => [r.shop, r]));
  shops.forEach(s => { const p = prevBy[s.shop]; s.mom = p && p.revenue ? s.rev / p.revenue - 1 : null; });
  const max = {};
  MATRIX_COLS.filter(c => c.bar).forEach(c => { max[c.k] = Math.max(...shops.map(s => s[c.k] || 0)); });
  const sorted = [...shops].sort((a, b) => {
    const x = a[matrixSort.key], y = b[matrixSort.key];
    if (typeof x === 'string') return matrixSort.dir * x.localeCompare(y);
    return matrixSort.dir * ((x ?? -Infinity) - (y ?? -Infinity));
  });
  const head = `<thead><tr>${MATRIX_COLS.map(c => `<th tabindex="0" data-k="${c.k}"
    class="${matrixSort.key === c.k ? 'sorted' : ''}" data-dir="${matrixSort.dir < 0 ? '↓' : '↑'}">${c.l}</th>`).join('')}</tr></thead>`;
  const cell = (c, s) => {
    if (c.k === 'name') return `<td><div class="shop-cell">${s.name}<span class="pill tier ${(s.tier || '').toLowerCase()}">${s.tier || ''}</span></div></td>`;
    const v = s[c.k], txt = c.f(v), cls = c.cls ? c.cls(v, t) : '';
    if (!c.bar) return `<td class="${cls}">${txt}</td>`;
    const w = max[c.k] ? Math.max(2, ((v || 0) / max[c.k]) * 100) : 0;
    return `<td><span class="cell ${c.navy ? 'n' : ''}"><i style="width:${w}%"></i><b class="${cls}">${txt}</b></span></td>`;
  };
  const body = `<tbody>${sorted.map(s => `<tr>${MATRIX_COLS.map(c => cell(c, s)).join('')}</tr>`).join('')}</tbody>`;
  const totals = { name: 'Total', rev: t.rev, ach: t.ach, achM: t.achM, adCost: t.ad, budgetUse: t.budgetUse, roas: t.roas, cir: t.cir, msgs: t.msg,
    cpm: t.cpm, r2: t.r2, r5: t.r5, purchase_msg: t.buy, mom: null };
  const foot = `<tfoot><tr>${MATRIX_COLS.map(c => (c.k === 'name' ? '<td>Total</td>' : c.k === 'mom' ? '<td></td>' : c.k === 'ach' ? `<td>${t.hits}/${t.nT} met</td>` : `<td>${c.f(totals[c.k])}</td>`)).join('')}</tr></tfoot>`;
  const table = document.getElementById('matrix');
  table.innerHTML = head + body + foot;
  table.querySelectorAll('th').forEach(th => {
    const go = () => {
      const k = th.dataset.k;
      matrixSort.dir = matrixSort.key === k ? -matrixSort.dir : (k === 'name' ? 1 : -1);
      matrixSort.key = k;
      renderMatrix(shops, t, prevRows);
    };
    th.addEventListener('click', go);
    th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}
