// ---------- Bootstrap: month picker, theme toggle, render everything for the selected month ----------

// slideMode: the top slide shows the selected month or its quarter ('#slide-q' opens the quarter slide directly)
const state = { month: MONTHS[MONTHS.length - 1], slideMode: location.hash === '#slide-q' ? 'quarter' : 'month' };

function renderAll() {
  const m = state.month;
  const shops = rowsOf(m).map(shopMetrics);
  const t = aggregate(shops.map(s => s));
  attachAdjustedTarget(shops, t, m); // month target adjusted by what the quarter still needs
  const pm = prevMonth(m);
  const p = pm ? aggregate(rowsOf(pm)) : null;

  if (typeof Chart !== 'undefined') {
    applyChartDefaults(themeColors()); // before any chart (slide/quarter render early)
    if (SLIDE_ONLY || EXPORTING) Chart.defaults.animation = false; // static frame for PNG export
  }
  renderHero(m, t);
  // Chart.js measures its box with getBoundingClientRect on creation, which includes CSS transforms:
  // unscale the slide while its charts are built, then scale it back to fit the page.
  document.getElementById('slide').style.transform = 'none';
  renderSlide(state.slideMode === 'quarter' ? quarterSlideContext(m) : monthSlideContext(m, shops, t));
  fitSlide();
  renderKpis(t, p);
  renderConcentrationAlert(shops, t);
  renderFunnel(t, shops);
  renderAdjustedSection(m, shops, t);
  t.momentum = renderMomentum(m, shops);
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
initSlideExport();
initSlideModeToggle();
if (SLIDE_ONLY) { document.body.classList.add('slide-only'); document.documentElement.dataset.theme = 'light'; } // slides are always light
renderAll();

/** Month / Quarter switch for the summary slide (the detail sections stay monthly). */
function initSlideModeToggle() {
  const box = document.getElementById('slide-mode');
  const sync = () => {
    const { y, q } = quarterKey(state.month);
    box.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.mode === state.slideMode);
      b.setAttribute('aria-pressed', b.dataset.mode === state.slideMode);
      if (b.dataset.mode === 'quarter') b.textContent = `Quarter · Q${q} ${y}`;
      if (b.dataset.mode === 'month') b.textContent = `Month · ${monthLabel(state.month)}`;
    });
  };
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    if (state.slideMode === b.dataset.mode) return;
    state.slideMode = b.dataset.mode; sync(); renderAll();
  }));
  document.getElementById('month-select').addEventListener('change', sync);
  sync();
}
