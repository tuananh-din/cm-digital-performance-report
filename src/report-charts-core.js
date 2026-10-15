// ---------- Chart.js core: theme colours, defaults, value-label plugin, bar+line combo builder ----------

const CHARTS = {};

function themeColors() {
  return {
    brand: cssVar('--brand'), s2: cssVar('--series2'), line: cssVar('--line'), line2: cssVar('--line2'), context: cssVar('--context'), ink: cssVar('--ink'),
    ink2: cssVar('--ink-2'), muted: cssVar('--muted'), grid: cssVar('--grid'), surface: cssVar('--surface'),
  };
}

function applyChartDefaults(C) {
  Chart.defaults.font.family = '"Be Vietnam Pro", system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = C.muted;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation.duration = 500;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: C.ink, titleColor: C.surface, bodyColor: C.surface, padding: 10, cornerRadius: 10,
    titleFont: { weight: '700' }, displayColors: true, boxPadding: 4,
  });
  Chart.defaults.plugins.legend.display = false;
}

function makeChart(id, config) {
  if (CHARTS[id]) CHARTS[id].destroy();
  const el = document.getElementById(id);
  if (el) CHARTS[id] = new Chart(el, config);
}

/** Rounded 'pill' value label (reference-deck style). */
function drawPill(ctx, x, y, txt, stroke, C) {
  ctx.font = '700 10.5px "Be Vietnam Pro"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + 12, h = 17;
  ctx.fillStyle = C.surface; ctx.strokeStyle = stroke; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.fillText(txt, x, y + .5);
  return { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
}

/**
 * Draws value labels like the reference deck: pill labels above line points, small text above bars.
 * Enabled per dataset via `_label: v => string`.
 */
const valueLabelPlugin = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart, C = themeColors();
    // Too narrow per category (phones): skip value labels, tooltips still carry every value.
    const minSlot = (chart.options.plugins.valueLabels || {}).minSlot ?? 44;
    if (chart.chartArea.width / Math.max(1, chart.data.labels.length) < minSlot) return;
    const placed = []; // drawn pill boxes — skip a pill that would overlap one already drawn
    chart.data.datasets.forEach((ds, di) => {
      if (!ds._label || !chart.isDatasetVisible(di)) return;
      const meta = chart.getDatasetMeta(di);
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      meta.data.forEach((el, i) => {
        const v = ds.data[i];
        if (v == null || isNaN(v)) return;
        const txt = ds._label(v, i);
        if (!txt) return;
        if (ds.type === 'line' || meta.type === 'line') {
          ctx.font = '700 10.5px "Be Vietnam Pro"';
          const w = ctx.measureText(txt).width + 12, h = 17, x = el.x, y = el.y - 15;
          const box = { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
          if (placed.some(b => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) return;
          placed.push(drawPill(ctx, x, y, txt, ds.borderColor, C));
          ctx.font = '700 10px "Be Vietnam Pro"';
        } else {
          ctx.font = '700 10px "Be Vietnam Pro"';
          const horiz = chart.options.indexAxis === 'y';
          const bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
          if (horiz) { ctx.fillStyle = C.ink2; ctx.textAlign = 'left'; ctx.fillText(txt, el.x + 4, el.y); }
          else if (el.base - el.y > 24 && ctx.measureText(txt).width < el.width - 2) {
            // inside the bar foot (reference-deck style), so labels never collide with line pills above
            ctx.fillStyle = bg === C.brand ? '#fff' : C.ink; // white only on the saturated brand fill
            ctx.fillText(txt, el.x, el.base - 10);
          } else if (!ds._insideOnly) { ctx.fillStyle = C.ink2; ctx.fillText(txt, el.x, Math.min(el.y, el.base) - 8); }
        }
      });
      ctx.restore();
    });
  },
};

/**
 * Bar + line combo with left axis (bars) and right axis (lines) — the layout used in the team's decks.
 * spec: { labels, bars:[{label,data,color,stack,_label}], lines:[{label,data,color,dashed,_label,axis}],
 *         yFmt, y1Fmt, tipFmt:{[label]:fmt}, title(i), highlight:[bool], rotate }
 */
function makeCombo(id, spec) {
  const C = themeColors();
  const bars = spec.bars.map(b => ({
    type: 'bar', label: b.label, data: b.data, yAxisID: 'y', order: 3, stack: b.stack,
    backgroundColor: spec.highlight && !b.stack ? spec.highlight.map(h => (h ? b.color : C.context)) : b.color,
    borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: spec.barMax || 46, _label: b._label, _insideOnly: b._insideOnly,
  }));
  const lines = (spec.lines || []).map(l => ({
    type: 'line', label: l.label, data: l.data, yAxisID: l.axis || 'y1', order: 1,
    borderColor: l.color, backgroundColor: l.color, borderWidth: 2, borderDash: l.dashed ? [5, 4] : [],
    tension: .35, pointRadius: 4.5, pointHoverRadius: 6, pointBackgroundColor: C.surface, pointBorderColor: l.color,
    pointBorderWidth: 2, spanGaps: true, _label: l._label,
    // marker:'tick' -> no connecting line, a wide horizontal tick per category (targets on nominal axes)
    ...(l.marker === 'tick' ? { showLine: false, pointStyle: 'line', pointRadius: 16, pointHoverRadius: 18, pointBorderWidth: 3 } : {}),
  }));
  const fmtFor = label => (spec.tipFmt && spec.tipFmt[label]) || (v => fmtNum(v, 1));
  const hasY1 = lines.some(l => l.yAxisID === 'y1');
  // Float right-axis lines in the upper band of the plot (negative, hidden min) so line pills sit above bar-foot labels.
  const y1Max = Math.max(0, ...lines.filter(l => l.yAxisID === 'y1').flatMap(l => l.data.filter(v => v != null && isFinite(v))));
  // Charts inside the 1600×900 slide are drawn at 2× so the PNG export stays crisp on 1× screens.
  const inSlide = !!(document.getElementById(id) || { closest: () => null }).closest('.slide');
  makeChart(id, {
    data: { labels: spec.labels, datasets: [...lines, ...bars] },
    options: {
      ...(inSlide ? { devicePixelRatio: 2 } : {}),
      layout: { padding: { top: 22 } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: !!spec.stacked, grid: { display: false }, border: { color: C.grid },
          ticks: { color: C.ink2, maxRotation: spec.rotate ?? 0, minRotation: spec.rotate ?? 0, autoSkip: false, font: { weight: '600' } } },
        y: { stacked: !!spec.stacked, beginAtZero: true, max: spec.yMax, border: { display: false }, grid: { color: C.grid },
          ticks: { callback: spec.yFmt, maxTicksLimit: 5 }, grace: '12%' },
        y1: { display: hasY1 && spec.hideY1 === false, position: 'right', min: -(y1Max || 1) * 0.9, max: (y1Max || 1) * 1.15, border: { display: false }, grid: { display: false },
          ticks: { callback: v => (v < 0 || v > y1Max * 1.001 || !spec.y1Fmt ? '' : spec.y1Fmt(v)), maxTicksLimit: 6 } },
      },
      plugins: {
        valueLabels: { minSlot: spec.minSlot ?? 44 },
        tooltip: { callbacks: {
          title: items => (spec.title ? spec.title(items[0].dataIndex) : items[0].label),
          label: c => ` ${c.dataset.label}: ${fmtFor(c.dataset.label)(c.parsed.y)}`,
        } },
      },
    },
    plugins: [valueLabelPlugin, ...(spec.plugins || [])],
  });
}

/** Legend row markup for a combo chart (bars = squares, lines = short strokes). */
function comboLegend(items) {
  return items.map(([label, color, kind]) =>
    `<span><i class="sw ${kind === 'line' ? 'ln' : ''}" style="background:${color}"></i>${label}</span>`).join('');
}
