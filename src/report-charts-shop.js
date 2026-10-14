// ---------- Per-shop charts for the selected month: bar+line combos, quadrant bubble, engagement ----------

/** Cap extreme outliers on a line so one shop does not flatten the rest; the label keeps the real value. */
function capOutliers(values, factor = 4) {
  const med = median(values.filter(v => v != null && v > 0));
  const cap = med ? med * factor : null;
  return { data: values.map(v => (cap && v > cap ? cap : v)), isCapped: values.map(v => !!(cap && v > cap)) };
}

function renderShopCombos(shops) {
  const C = themeColors();
  const list = [...shops].sort((a, b) => b.adCost - a.adCost);
  const labels = list.map(s => s.name);
  const base = { labels, rotate: 35, barMax: 40, title: i => `${list[i].name} (${list[i].tier})` };
  const money0 = v => fmtMoney(v, 0);

  makeCombo('c-spend-roas', { ...base,
    bars: [{ label: 'Ad spend', data: list.map(s => s.adCost), color: C.brand, _label: v => fmtMoney(v, 1) }],
    lines: [{ label: 'ROAS', data: list.map(s => s.roas), color: C.line, _label: v => fmtNum(v, 1) }],
    yFmt: money0, y1Fmt: v => v, tipFmt: { 'Ad spend': v => fmtMoney(v), ROAS: v => fmtNum(v, 1) } });

  const cpc = capOutliers(list.map(s => s.cpc));
  makeCombo('c-cost-msg-cmt', { ...base,
    bars: [{ label: 'FB Ad Cost', data: list.map(s => s.adCost), color: C.brand }],
    lines: [
      { label: 'Cost/Message', data: list.map(s => s.cpm), color: C.line, _label: v => fmtMoney(v, 1) },
      { label: 'Cost/Comment', data: cpc.data, color: C.line2, _label: (v, i) => (cpc.isCapped[i] ? fmtMoney(list[i].cpc) + '↑' : '') },
    ],
    yFmt: money0, y1Fmt: money0,
    tipFmt: { 'FB Ad Cost': v => fmtMoney(v), 'Cost/Message': v => fmtMoney(v), 'Cost/Comment': v => fmtMoney(v) } });

  const byUnits = [...shops].sort((a, b) => n0(b.units) - n0(a.units));
  makeCombo('c-aov-units', { labels: byUnits.map(s => s.name), rotate: 35, barMax: 40, title: i => byUnits[i].name,
    bars: [{ label: 'Sale units', data: byUnits.map(s => n0(s.units)), color: C.brand, _label: v => fmtInt(v) }],
    lines: [{ label: 'AOV', data: byUnits.map(s => s.aov), color: C.line, _label: v => fmtMoney(v, 1) }],
    yFmt: v => fmtInt(v), y1Fmt: money0, tipFmt: { 'Sale units': fmtInt, AOV: v => fmtMoney(v) } });

  const byContacts = [...shops].sort((a, b) => n0(b.contacts) - n0(a.contacts));
  makeCombo('c-contacts', { labels: byContacts.map(s => s.name), rotate: 35, barMax: 40, stacked: true, title: i => byContacts[i].name,
    bars: [
      { label: 'Paid contacts', data: byContacts.map(s => n0(s.contacts_paid)), color: C.brand, stack: 'c' },
      { label: 'Organic contacts', data: byContacts.map(s => n0(s.contacts_org)), color: C.s2, stack: 'c' },
    ],
    lines: [{ label: '% Organic', data: byContacts.map(s => (s.contacts ? (n0(s.contacts_org) / s.contacts) * 100 : null)), color: C.line, _label: v => v.toFixed(0) + '%' }],
    yFmt: v => fmtInt(v), y1Fmt: v => v + '%',
    tipFmt: { 'Paid contacts': fmtInt, 'Organic contacts': fmtInt, '% Organic': v => v.toFixed(1) + '%' } });
}

function renderQuadrant(shops, t) {
  const C = themeColors(), CAP = 160;
  const pts = shops.filter(s => s.cpm != null && s.ach != null);
  const maxAd = Math.max(...pts.map(s => s.adCost));
  const data = pts.map(s => ({ x: s.cpm, y: Math.min(s.ach * 100, CAP), r: 5 + 13 * Math.sqrt(s.adCost / maxAd), s }));
  const xMax = Math.ceil(Math.max(...pts.map(s => s.cpm)) / 5000) * 5000 + 5000;

  const quadPlugin = {
    id: 'quad',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: { x, y } } = chart;
      const qx = x.getPixelForValue(t.cpm), qy = y.getPixelForValue(100);
      ctx.save();
      ctx.strokeStyle = C.ink2; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(qx, a.top); ctx.lineTo(qx, a.bottom); ctx.moveTo(a.left, qy); ctx.lineTo(a.right, qy); ctx.stroke();
      ctx.font = '700 11px "Be Vietnam Pro"'; ctx.fillStyle = C.muted;
      ctx.textAlign = 'left'; ctx.fillText('SCALE · cheap & on target', a.left + 8, a.top + 14);
      ctx.fillText('FIX CONVERSION · cheap but below', a.left + 8, a.bottom - 8);
      ctx.textAlign = 'right'; ctx.fillText('COSTLY but on target', a.right - 8, a.top + 14);
      ctx.fillText('ACT NOW · costly & below', a.right - 8, a.bottom - 8);
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const { ctx } = chart, meta = chart.getDatasetMeta(0);
      ctx.save(); ctx.font = '600 11.5px "Be Vietnam Pro"'; ctx.fillStyle = C.ink; ctx.textBaseline = 'middle';
      // Place labels top-down; nudge a label below any already-placed box it would collide with.
      const placed = [], LH = 14;
      meta.data.map((el, i) => ({ el, d: data[i] })).sort((a, b) => a.el.y - b.el.y).forEach(({ el, d }) => {
        const over = d.s.ach * 100 > CAP;
        const txt = d.s.name + (over ? ' ↑' : '');
        const w = ctx.measureText(txt).width;
        const right = el.x + d.r + 4 + w < chart.chartArea.right;
        const x0 = right ? el.x + d.r + 4 : el.x - d.r - 4 - w;
        let y = el.y;
        while (placed.some(p => x0 < p.x1 && x0 + w > p.x0 && Math.abs(y - p.y) < LH)) y += 3;
        placed.push({ x0, x1: x0 + w, y });
        if (Math.abs(y - el.y) > 6) { // leader line back to the bubble
          ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.beginPath();
          ctx.moveTo(right ? el.x + d.r : el.x - d.r, el.y); ctx.lineTo(right ? x0 - 2 : x0 + w + 2, y); ctx.stroke();
        }
        ctx.textAlign = 'left';
        ctx.fillText(txt, x0, y);
      });
      ctx.restore();
    },
  };

  makeChart('c-quad', {
    type: 'bubble',
    data: { datasets: [{ data, backgroundColor: C.brand + 'cc', borderColor: C.surface, borderWidth: 2, hoverBorderWidth: 2 }] },
    options: {
      layout: { padding: { top: 6, right: 10 } },
      scales: {
        x: { min: 0, max: xMax, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: 'Cost / Message (₫)' }, ticks: { callback: v => fmtMoney(v, 0) } },
        y: { min: 0, max: CAP + 10, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: '% of adjusted target' }, ticks: { callback: v => (v <= CAP ? v + '%' : ''), stepSize: 40 } },
      },
      plugins: { tooltip: { displayColors: false, callbacks: {
        title: items => items[0].raw.s.name,
        label: c => { const s = c.raw.s; return [`Cost/Message: ${fmtMoney(s.cpm)}`, `Adjusted target: ${fmtAdj(s)} · plan ${fmtPct(s.achM, 0)}`, `Ad spend: ${fmtMoney(s.adCost)}`, `ROAS: ${fmtNum(s.roas, 1)}`]; },
      } } },
    },
    plugins: [quadPlugin],
  });
}

/** Comments vs new followers per shop — two count series on one shared axis. */
function renderEngagement(shops) {
  const C = themeColors();
  const list = [...shops].sort((a, b) => n0(b.cmt) - n0(a.cmt));
  const ds = (k, label, color) => ({ label, data: list.map(s => n0(s[k])), backgroundColor: color, borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: 'left', barPercentage: .8, categoryPercentage: .7, maxBarThickness: 14 });
  makeChart('c-eng', {
    type: 'bar',
    data: { labels: list.map(s => s.name), datasets: [ds('cmt', 'Comments', C.brand), ds('fol', 'New followers', C.s2)] },
    options: {
      indexAxis: 'y', interaction: { mode: 'index', intersect: false },
      scales: { x: { beginAtZero: true, grid: { color: C.grid }, border: { display: false } }, y: { grid: { display: false }, border: { color: C.grid }, ticks: { color: C.ink, font: { weight: '600' } } } },
      plugins: { tooltip: { callbacks: { afterBody: items => { const s = list[items[0].dataIndex]; return `Cost/Comment: ${fmtMoney(s.cpc)}`; } } } },
    },
  });
}
