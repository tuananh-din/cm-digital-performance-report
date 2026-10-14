// ---------- Bootstrap: month picker, theme toggle, render everything for the selected month ----------

const state = { month: MONTHS[MONTHS.length - 1] };

function renderAll() {
  const m = state.month;
  const shops = rowsOf(m).map(shopMetrics);
  const t = aggregate(shops.map(s => s));
  attachAdjustedTarget(shops, t, m); // month target adjusted by what the quarter still needs
  const pm = prevMonth(m);
  const p = pm ? aggregate(rowsOf(pm)) : null;

  if (typeof Chart !== 'undefined') {
    applyChartDefaults(themeColors()); // before any chart (slide/quarter render early)
    if (SLIDE_ONLY) Chart.defaults.animation = false; // static frame for PNG export
  }
  renderHero(m, t);
  renderSlide(m, shops, t);
  fitSlide();
  renderKpis(t, p);
  renderConcentrationAlert(shops, t);
  renderBullet(shops);
  renderFunnel(t, shops);
  renderAdjustedSection(m, shops, t);
  renderMatrix(shops, t, pm ? rowsOf(pm) : []);
  renderCharts(shops, t);
  renderAdvancedInsights(shops, t);
  renderTakeaways(m, shops, t);
  renderQuality(m, shops);
  document.getElementById('foot').innerHTML =
    `Source: CM – Monthly Report (data_media) · ${monthLabel(m)} vs ${pm ? monthLabel(pm) : '—'} · ` +
    'ROAS = revenue ÷ FB ad cost · CIR = FB ad cost ÷ revenue · Cost/Message = FB ad cost ÷ FB messages · ' +
    'Adjusted target = quarter target − revenue booked in earlier months of the quarter · ' +
    'All total ratios are sum ÷ sum (never an average of store ratios).';
}

function renderCharts(shops, t) {
  if (typeof Chart === 'undefined') return; // offline: HTML sections still render
  renderShopCombos(shops);
  renderTrendCharts(state.month);
  renderQuadrant(shops, t);
  renderEngagement(shops);
}

function initControls() {
  const sel = document.getElementById('month-select');
  sel.innerHTML = [...MONTHS].reverse().map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  sel.value = state.month;
  sel.addEventListener('change', () => { state.month = sel.value; renderAll(); });

  const root = document.documentElement;
  try { const saved = localStorage.getItem('dp-theme'); if (saved) root.dataset.theme = saved; } catch (e) { /* storage blocked */ }
  document.getElementById('theme-btn').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('dp-theme', root.dataset.theme); } catch (e) { /* ignore */ }
    renderAll();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!root.dataset.theme) renderAll(); });
}

initControls();
if (SLIDE_ONLY) { document.body.classList.add('slide-only'); document.documentElement.dataset.theme = 'light'; } // slides are always light
renderAll();
