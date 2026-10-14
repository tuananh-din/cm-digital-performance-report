// ---------- Month-over-month combo charts (bars + line), all months up to the selected one ----------

function renderTrendCharts(month) {
  const C = themeColors();
  const months = MONTHS.filter(m => m <= month);
  const aggs = months.map(m => aggregate(rowsOf(m)));
  const base = {
    labels: months.map(monthShort),
    highlight: months.map(m => m === month),
    title: i => `${monthLabel(months[i])} · ${aggs[i].shops} stores`,
  };
  const money0 = v => fmtMoney(v, 0);

  makeCombo('c-rev-cir', { ...base,
    bars: [{ label: 'Revenue', data: aggs.map(a => a.rev), color: C.brand, _label: v => fmtMoney(v, 1) }],
    lines: [{ label: '% CIR', data: aggs.map(a => a.cir * 100), color: C.line, _label: v => v.toFixed(2) + '%' }],
    yFmt: money0, y1Fmt: v => v.toFixed(1) + '%',
    tipFmt: { Revenue: v => fmtMoney(v), '% CIR': v => v.toFixed(2) + '%' } });

  makeCombo('c-msg-cpm', { ...base,
    bars: [{ label: 'FB Messages', data: aggs.map(a => a.msg), color: C.brand, _label: v => fmtInt(v) }],
    lines: [{ label: 'Cost/Message', data: aggs.map(a => a.cpm), color: C.line, _label: v => fmtMoney(v) }],
    yFmt: v => (v >= 1000 ? v / 1000 + 'K' : v), y1Fmt: money0,
    tipFmt: { 'FB Messages': fmtInt, 'Cost/Message': v => fmtMoney(v) } });

  makeCombo('c-ad-roas', { ...base,
    bars: [{ label: 'Ad spend', data: aggs.map(a => a.ad), color: C.brand, _label: v => fmtMoney(v, 0) }],
    lines: [{ label: 'ROAS', data: aggs.map(a => a.roas), color: C.line, _label: v => fmtNum(v, 1) }],
    yFmt: money0, y1Fmt: v => v,
    tipFmt: { 'Ad spend': v => fmtMoney(v), ROAS: v => fmtNum(v, 1) } });

  makeCombo('c-rev-target', { ...base,
    bars: [{ label: 'Revenue', data: aggs.map(a => a.rev), color: C.brand, _label: (v, i) => fmtPct(aggs[i].ach, 0) }],
    lines: [{ label: 'Target', data: aggs.map(a => a.target), color: C.ink, dashed: true, axis: 'y' }],
    yFmt: money0, tipFmt: { Revenue: v => fmtMoney(v), Target: v => fmtMoney(v) } });

  document.getElementById('trend-note').textContent =
    `${monthShort(months[0])}–${monthShort(month)} ${month.slice(0, 4)} · number of stores with data changes by month (${aggs.map(a => a.shops).join(' → ')}) — read trends with coverage in mind`;
}
