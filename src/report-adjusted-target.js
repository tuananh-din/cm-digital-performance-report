// ---------- Monthly target adjusted by the quarter plan ----------
// Shops plan stock-in per QUARTER: a weak month is fine if earlier months already front-loaded.
// Adjusted target of month m = Σ target of quarter months up to m − Σ revenue of the earlier quarter months.
// Revenue(m) ≥ Target ĐC  ⇒ shop is on track for the quarter ⇒ counts as "on target" this month.

/** Months of the selected month's quarter, up to and including it (e.g. 2026.09 -> 07, 08, 09). */
function quarterMonths(month) {
  const y = month.slice(0, 4), q = Math.ceil(+month.slice(5) / 3);
  return MONTHS.filter(x => x.slice(0, 4) === y && Math.ceil(+x.slice(5) / 3) === q && x <= month);
}

/** Attach adjusted-target fields to every shop and the month total. `ach` becomes the adjusted achievement. */
function attachAdjustedTarget(shops, t, month) {
  const qm = quarterMonths(month);
  const prior = qm.filter(m => m !== month);
  shops.forEach(s => {
    const rs = RAW_ROWS.filter(r => r.shop === s.shop && qm.includes(r.month));
    const tQ = rs.reduce((a, r) => a + n0(r.target), 0);
    const priorRev = rs.filter(r => r.month !== month).reduce((a, r) => a + n0(r.revenue), 0);
    const tAdj = tQ - priorRev;
    const met = s.target ? s.rev >= tAdj : null;
    const achM = s.ach; // monthly-plan achievement, read before `ach` is re-pointed below
    Object.assign(s, {
      achM, tQ, priorRev, tAdj, met, gap: tAdj - s.rev,
      ach: !s.target ? null : tAdj > 0 ? s.rev / tAdj : Infinity, // Infinity = quarter already covered before this month
      rescued: !!met && achM != null && achM < 1,                // missed the month plan but on track for the quarter
    });
  });
  const withT = shops.filter(s => s.target);
  const tAdjSum = withT.reduce((a, s) => a + Math.max(0, s.tAdj), 0);
  Object.assign(t, {
    achM: t.ach, tAdj: tAdjSum, ach: div(t.rev, tAdjSum),
    hits: withT.filter(s => s.met).length, planHits: withT.filter(s => s.achM >= 1).length, nT: withT.length,
    rescued: withT.filter(s => s.rescued), qLabel: `Q${Math.ceil(+month.slice(5) / 3)}`,
    priorLabel: prior.length ? prior.map(monthShort).join('+') : '', qMonths: qm,
  });
}

/** Display text for adjusted achievement: met shops read "✓ Met", others the % of the adjusted target. */
const fmtAdj = s => (s.met == null ? '–' : s.met ? '✓ Met' : fmtPct(s.ach, 0));

/** Status pill (✓ Met / % of adjusted target) above the higher of bar top and target tick. */
function statusPills(list) {
  return {
    id: 'statusPills',
    afterDatasetsDraw(chart) {
      const C = themeColors(), { ctx, chartArea } = chart;
      const bar = chart.data.datasets.findIndex(d => d.type === 'bar');
      const tick = chart.data.datasets.findIndex(d => d.type === 'line'); // target tick = first line dataset
      const bars = chart.getDatasetMeta(bar).data, ticks = chart.getDatasetMeta(tick).data;
      ctx.save();
      list.forEach((s, i) => {
        if (!bars[i] || !ticks[i] || s.met == null) return;
        const y = Math.max(chartArea.top + 9, Math.min(bars[i].y, ticks[i].y) - 14);
        drawPill(ctx, bars[i].x, y, fmtAdj(s), s.met ? C.brand : C.line, C);
      });
      ctx.restore();
    },
  };
}

/** Bar+tick combo: month revenue vs adjusted target (ink tick) and month plan (grey tick). */
function renderAdjustedCombo(canvasId, legendId, shops, opts = {}) {
  const C = themeColors(), light = cssVar('--q1');
  const per = opts.periodShort || opts.monthShort;              // 'Sep' or 'Q3'
  const tgt = opts.targetName || 'Adjusted target';             // quarter view: 'Q3 target'
  const showPlan = opts.showPlan !== false;                     // grey monthly-plan tick (month view only)
  const list = shops.filter(s => s.target).sort((a, b) => b.rev - a.rev);
  const name = opts.shortNames ? (n => n.replace(/\s*Smart\s?Home$/i, '')) : (n => n);
  // Keep one outlier from flattening everyone else: cap the axis, the bar label keeps the real value.
  const sorted = list.map(s => s.rev).sort((a, b) => b - a);
  const others = Math.max(sorted[1] || 0, ...list.map(s => Math.max(s.tAdj, s.target)));
  const yMax = sorted[0] > others * 1.6 ? others * 1.25 : undefined;
  const lines = [{ label: tgt, data: list.map(s => Math.max(0, s.tAdj)), color: C.ink, axis: 'y', marker: 'tick' }];
  if (showPlan) lines.push({ label: 'Monthly plan', data: list.map(s => s.target), color: C.muted, axis: 'y', marker: 'tick' });
  makeCombo(canvasId, {
    labels: list.map(s => name(s.name)), rotate: opts.rotate ?? 0, barMax: 48, minSlot: 30, yMax,
    title: i => `${list[i].name} · ${list[i].met ? 'on' : 'below'} ${tgt.toLowerCase()}`,
    bars: [{ label: `${per} revenue`, data: list.map(s => s.rev), color: list.map(s => (s.met ? C.brand : light)),
      _label: v => fmtMoney(v, 1) + (yMax && v > yMax ? '↑' : ''), _insideOnly: true }],
    lines,
    yFmt: v => fmtMoney(v, 0), plugins: [statusPills(list)],
    tipFmt: { [`${per} revenue`]: v => fmtMoney(v), [tgt]: v => fmtMoney(v), 'Monthly plan': v => fmtMoney(v) },
  });
  if (legendId) document.getElementById(legendId).innerHTML = comboLegend([
    [`${per} revenue · met`, C.brand, 'bar'], [`${per} revenue · below`, light, 'bar'],
    [opts.targetLegend || `Adjusted target = ${opts.qLabel} target − ${opts.priorLabel || 'prior'} revenue`, C.ink, 'line'],
    ...(showPlan ? [['Monthly plan', C.muted, 'line']] : [])]);
}

/** Detail section: KPI chips, combo chart and the adjusted-target table. */
function renderAdjustedSection(month, shops, t) {
  const ms = monthShort(month);
  document.getElementById('q-title').textContent = `${ms} target adjusted to the ${t.qLabel} plan`;
  document.getElementById('q-note').innerHTML = t.priorLabel
    ? `Adjusted ${ms} target = ${t.qLabel} target (${t.qMonths.map(monthShort).join('+')}) − revenue already booked in ${t.priorLabel}. Stores that front-loaded stock-in earlier need less this month.`
    : `First month of the quarter: adjusted target = monthly plan.`;
  const worst = shops.filter(s => s.met === false).sort((a, b) => b.gap - a.gap)[0];
  document.getElementById('q-kpis').innerHTML = [
    [`Stores on target · ${ms}`, `${t.hits}/${t.nT}`, `vs adjusted target`],
    ['Monthly plan only', `${t.planHits}/${t.nT}`, 'if judged on the monthly plan'],
    [`Saved by ${t.priorLabel || 'prior'} stock-in`, `${t.rescued.length}`, t.rescued.map(s => s.name).join(', ') || '—'],
    ['Total adjusted target', fmtMoney(t.tAdj), `monthly plan ${fmtMoney(t.target)}`],
    [`${ms} revenue`, fmtMoney(t.rev), `${fmtPct(t.ach, 0)} of adjusted target`],
    ['Largest gap', worst ? worst.name : '—', worst ? `−${fmtMoney(worst.gap)} vs adjusted target` : ''],
  ].map(([l, v, s]) => `<div class="chip"><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></div>`).join('');

  const rows = shops.filter(s => s.target).sort((a, b) => (b.met - a.met) || (a.gap - b.gap));
  const head = `<thead><tr><th>Store</th><th>${ms} plan</th><th>${t.qLabel} target</th><th>${t.priorLabel || '—'} revenue</th>
    <th>Adjusted ${ms}</th><th>${ms} revenue</th><th>% of plan</th><th>% of adjusted</th><th>Gap</th><th>Status</th></tr></thead>`;
  const status = s => (s.met ? (s.rescued ? ['good-t', `✓ Met (front-loaded ${t.priorLabel})`] : ['good-t', '✓ Met'])
    : s.ach >= 0.9 ? ['warn-t', '≈ Close'] : ['bad-t', '✕ Below']);
  const body = rows.map(s => {
    const [cls, lbl] = status(s);
    return `<tr><td><div class="shop-cell">${s.name}<span class="pill tier ${(s.tier || '').toLowerCase()}">${s.tier}</span></div></td>
      <td>${fmtMoney(s.target)}</td><td>${fmtMoney(s.tQ)}</td><td>${fmtMoney(s.priorRev)}</td><td><b>${fmtMoney(Math.max(0, s.tAdj))}</b></td>
      <td>${fmtMoney(s.rev)}</td><td class="${s.achM >= 1 ? 'good-t' : 'bad-t'}">${fmtPct(s.achM, 0)}</td>
      <td class="${s.met ? 'good-t' : 'bad-t'}">${fmtAdj(s)}</td>
      <td class="${s.gap > 0 ? 'bad-t' : 'good-t'}">${s.gap > 0 ? '−' + fmtMoney(s.gap) : '+' + fmtMoney(-s.gap)}</td>
      <td class="${cls}">${lbl}</td></tr>`;
  }).join('');
  document.getElementById('q-table').innerHTML = head + `<tbody>${body}</tbody>`;
  if (typeof Chart !== 'undefined') {
    renderAdjustedCombo('c-quarter', 'q-legend', shops, { monthShort: ms, qLabel: t.qLabel, priorLabel: t.priorLabel, rotate: 30 });
  }
}
