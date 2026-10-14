// ---------- Export the 16:9 summary slide as PNG (download or copy to clipboard) ----------
// Uses html-to-image (SVG foreignObject → canvas) so every CSS feature renders exactly as on screen.
// The slide is always exported in the light theme at native 1600×900, pixel ratio 2 (3200×1800).

let EXPORTING = false; // read by renderAll(): disables chart animation so the frame is final
let FONT_CSS = null;    // cached @font-face CSS with the font files inlined as data URLs

/** Inline the Google Font into CSS ourselves (an SVG-rendered image cannot reach the page's web fonts). */
async function slideFontCSS() {
  if (FONT_CSS !== null) return FONT_CSS;
  try {
    const link = document.querySelector('link[href*="fonts.googleapis.com/css2"]');
    let css = await (await fetch(link.href)).text();
    const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) || [])];
    const inlined = await Promise.all(urls.map(async u => {
      const blob = await (await fetch(u)).blob();
      return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res([u, fr.result]); fr.onerror = rej; fr.readAsDataURL(blob); });
    }));
    inlined.forEach(([u, data]) => { css = css.split(u).join(data); });
    FONT_CSS = css;
  } catch (e) {
    FONT_CSS = ''; // fall back to system fonts rather than failing the export
  }
  return FONT_CSS;
}

async function renderSlidePng() {
  if (typeof htmlToImage === 'undefined') throw new Error('Image library not loaded (offline?)');
  const root = document.documentElement;
  const prevTheme = root.dataset.theme;
  const prevAnim = Chart.defaults.animation;
  const wasDark = prevTheme ? prevTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  EXPORTING = true;
  try {
    if (wasDark) root.dataset.theme = 'light';
    renderAll();
    await document.fonts.ready;
    const fontEmbedCSS = await slideFontCSS();
    return await htmlToImage.toBlob(document.getElementById('slide'), {
      width: SLIDE_W, height: SLIDE_H, pixelRatio: 2, cacheBust: true, fontEmbedCSS,
      style: { transform: 'none', borderRadius: '0', boxShadow: 'none', border: '0' },
    });
  } finally {
    EXPORTING = false;
    if (wasDark) { if (prevTheme) root.dataset.theme = prevTheme; else delete root.dataset.theme; }
    Chart.defaults.animation = prevAnim;
    renderAll();
  }
}

function exportStatus(msg, ok = true) {
  const el = document.getElementById('export-status');
  el.textContent = msg;
  el.className = 'export-status ' + (ok ? 'ok' : 'err');
  clearTimeout(exportStatus.t);
  exportStatus.t = setTimeout(() => { el.textContent = ''; }, 4000);
}

async function withBusy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { await fn(); } catch (e) { exportStatus(`Export failed: ${e.message || e}`, false); } finally { btn.disabled = false; }
}

function initSlideExport() {
  const dl = document.getElementById('btn-png'), cp = document.getElementById('btn-copy');
  dl.addEventListener('click', () => withBusy(dl, async () => {
    const blob = await renderSlidePng();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CM-Digital-Performance-${state.month.replace('.', '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    exportStatus('PNG downloaded ✓');
  }));
  cp.addEventListener('click', () => withBusy(cp, async () => {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('clipboard not supported here — use Download');
    // Pass the promise straight into ClipboardItem so Safari keeps the click's user activation.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderSlidePng() })]);
    exportStatus('Copied — paste into your slide (Ctrl/⌘+V) ✓');
  }));
}
