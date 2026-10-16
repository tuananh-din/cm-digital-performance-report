// ---------- One-slide (16:9, 1600×900) executive summary at the top of the report ----------
// Open the report with "#slide" to get only the slide at native size (used for PNG export).

const SLIDE_W = 1600, SLIDE_H = 900;
const SLIDE_ONLY = location.hash.startsWith('#slide');   // '#slide' = month slide, '#slide-q' = quarter slide

/** Render the slide for a period context (see report-slide-context.js): a month or its quarter. */
function renderSlide(ctx) {
  const { shops, t, p } = ctx;
  const ps = ctx.prevShort;
  document.getElementById('s-eyebrow').textContent = `Channel Marketing · ${ctx.label}`;
  document.getElementById('s-period').innerHTML =
    `${ctx.reportName} · ${ctx.label}${ctx.prevLabel ? ` vs ${ctx.prevLabel}` : ''}<br><span>${t.shops} stores · FB Ads + store revenue · ${ctx.scope}</span>`;
  document.getElementById('s-a-title').textContent = ctx.chartTitle;

  const mom = (cur, prev, goodUp) => {
    const d = pctChange(cur, prev);
    if (d == null || !isFinite(d)) return '';
    const cls = goodUp == null ? '' : (d >= 0) === goodUp ? 'up' : 'down';
    return `<i class="${cls}">${d >= 0 ? '▲' : '▼'}${Math.abs(d * 100).toFixed(0)}%</i>`;
  };
  const vs = (cur, prev, fmt, goodUp) => (prev == null ? '' : `${ps}: ${fmt(prev)} ${mom(cur, prev, goodUp)}`);
  const kpis = [
    ['Amount Spent', fmtMoney(t.ad), vs(t.ad, p && p.ad, v => fmtMoney(v), null)],
    ['Revenue', fmtMoney(t.rev), vs(t.rev, p && p.rev, v => fmtMoney(v), true)],
    ['Stores on Target', `${t.hits}/${t.nT}`, ctx.storesSub],
    ['ROAS', fmtNum(t.roas, 1), vs(t.roas, p && p.roas, v => fmtNum(v, 1), true)],
    ['FB Messages', fmtInt(t.msg), vs(t.msg, p && p.msg, fmtInt, true)],
    ['Cost/Message', fmtMoney(t.cpm), vs(t.cpm, p && p.cpm, v => fmtMoney(v), false)],
  ];
  document.getElementById('s-kpis').innerHTML = kpis.map(([l, v, s]) =>
    `<div class="s-kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

  // Compact message funnel with the change vs the comparison period per step
  const steps = [['Messages', t.msg, p && p.msg], ['2-way', t.msg2, p && p.msg2], ['5-way', t.msg5, p && p.msg5], ['Purchases', t.buy, p && p.buy]];
  const conv = ['', `${fmtPct(t.r2, 0)} of msg`, `${fmtPct(t.r5, 1)} of 2-way`, `${fmtPct(div(t.buy, t.msg5), 1)} of 5-way`];
  document.getElementById('s-funnel').innerHTML = steps.map(([l, v, pv], i) => `
    <div class="sf-row"><span class="sf-l">${l}</span>
      <span class="sf-track"><span class="sf-bar" style="width:${Math.max(3, div(v, t.msg) * 100)}%"></span></span>
      <span class="sf-v">${fmtInt(v)} ${mom(v, pv, true)}<em>${conv[i]}</em></span></div>`).join('');

  // Key takeaways: hand-written insight blocks [tag, headline, detail, action], else the top auto cards
  const note = ctx.notes;
  const items = note && note.slide ? note.slide
    : autoTakeaways(shops, t).slice(0, 4).map(([n, tag, txt, act]) => [tag, n, txt, act]);
  document.getElementById('s-takeaway').innerHTML = items.map(([tag, head, txt, act], i) => `
    <div class="st"><div class="st-top"><span class="st-n">${i + 1}</span><span class="tag ${tag}">${TAG_LABEL[tag] || tag}</span><b>${head}</b></div>
      <p>${txt}</p><div class="st-act">→ ${act}</div></div>`).join('');

  if (typeof Chart === 'undefined') return;
  renderSlideCharts(ctx);
}

const slideName = n => n.replace(/\s*Smart\s?Home$/i, ''); // keep x labels short on the slide

function renderSlideCharts(ctx) {
  const C = themeColors(), shops = ctx.shops;
  const inside = ctx.kind === 'quarter'; // 13 stores: labels above narrow bars would collide with the line pills
  // A. Period revenue vs target (month: adjusted to the quarter plan · quarter: quarter target)
  renderAdjustedCombo('s-c-target', 's-t-legend', shops, { ...ctx.combo, shortNames: true });

  // B. Spent & ROAS by store
  const bySpend = [...shops].sort((a, b) => b.adCost - a.adCost);
  makeCombo('s-c-spend', {
    labels: bySpend.map(s => slideName(s.name)), rotate: 30, minSlot: 30, barMax: 34, title: i => bySpend[i].name, hideY1: true,
    bars: [{ label: 'Ad spend', data: bySpend.map(s => s.adCost), color: C.brand, _label: v => Math.round(v / 1e6) + 'M', _insideOnly: inside }],
    lines: [{ label: 'ROAS', data: bySpend.map(s => s.roas), color: C.line, _label: v => fmtNum(v, 0) }],
    yFmt: v => fmtMoney(v, 0), y1Fmt: v => v, tipFmt: { 'Ad spend': v => fmtMoney(v), ROAS: v => fmtNum(v, 1) },
  });

  // C. Messages & Cost/Message by store
  const byMsg = [...shops].sort((a, b) => b.msgs - a.msgs);
  makeCombo('s-c-msg', {
    labels: byMsg.map(s => slideName(s.name)), rotate: 30, minSlot: 30, barMax: 34, title: i => byMsg[i].name, hideY1: true,
    bars: [{ label: 'FB Messages', data: byMsg.map(s => s.msgs), color: C.brand, _label: v => (v >= 1000 ? (v / 1000).toFixed(1) + 'K' : fmtInt(v)), _insideOnly: inside }],
    lines: [{ label: 'Cost/Message', data: byMsg.map(s => s.cpm), color: C.line, _label: v => fmtMoney(v, 1) }],
    yFmt: v => fmtInt(v), y1Fmt: v => fmtMoney(v, 0), tipFmt: { 'FB Messages': fmtInt, 'Cost/Message': v => fmtMoney(v) },
  });
}

/** Scale the fixed 1600×900 slide to the available width (on-page view only). */
function fitSlide() {
  const wrap = document.getElementById('slide-wrap'), slide = document.getElementById('slide');
  if (!wrap || SLIDE_ONLY) return;
  const k = Math.min(1, wrap.clientWidth / SLIDE_W);
  slide.style.transform = `scale(${k})`;
  wrap.style.height = SLIDE_H * k + 'px';
}
window.addEventListener('resize', fitSlide);
