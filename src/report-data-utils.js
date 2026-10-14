// ---------- Data helpers: formatting, per-shop derived metrics, month aggregation ----------
// RAW_ROWS comes from build-monthly-report.py: one object per (month, shop) with numeric fields
// target, revenue, units, t_units, budget, ad, msg, msg2, msg5, purchase_msg, cmt, fol, aov, contacts...

const MONTHS = [...new Set(RAW_ROWS.map(r => r.month))].sort();

const n0 = v => (v == null || isNaN(v) ? 0 : v);
const div = (a, b) => (b ? a / b : null);
const shortName = s => s.replace(/^\d+\.\s*/, '');
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = m => `${MONTH_ABBR[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
const monthShort = m => MONTH_ABBR[+m.slice(5) - 1];

/** ₫ money in B / M / K like the reference deck (₫276.0M). */
function fmtMoney(v, digits) {
  if (v == null || isNaN(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1e9) return '₫' + (v / 1e9).toFixed(digits ?? 2) + 'B';
  if (a >= 1e6) return '₫' + (v / 1e6).toFixed(digits ?? 1) + 'M';
  if (a >= 1e3) return '₫' + (v / 1e3).toFixed(digits ?? 1) + 'K';
  return '₫' + Math.round(v);
}
const fmtInt = v => (v == null || isNaN(v) ? '–' : Math.round(v).toLocaleString('en-US'));
const fmtPct = (v, d = 1) => (v == null || isNaN(v) ? '–' : (v * 100).toFixed(d) + '%');
const fmtNum = (v, d = 1) => (v == null || isNaN(v) ? '–' : v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));

/** Derived metrics for one shop-month row (all ratios weighted on raw sums, not averaged). */
function shopMetrics(r) {
  const rev = n0(r.revenue), ad = n0(r.ad), msg = n0(r.msg);
  return {
    ...r,
    name: shortName(r.shop),
    rev, adCost: ad, msgs: msg,
    ach: div(rev, r.target),
    roas: div(rev, ad),
    cir: div(ad, rev),
    cpm: div(ad, msg),
    cpc: div(ad, r.cmt),
    r2: div(n0(r.msg2), msg),
    r5: div(n0(r.msg5), r.msg2),
    buyRate: div(n0(r.purchase_msg), msg),
    budgetUse: r.budget ? ad / r.budget : (ad > 0 ? Infinity : null), // Infinity = spend without plan
    unitAch: div(n0(r.units), r.t_units),
  };
}

/** Sum a list of rows and derive the same ratios at total level. */
function aggregate(rows) {
  const sum = k => rows.reduce((s, r) => s + n0(r[k]), 0);
  const t = {
    shops: rows.length, rev: sum('revenue'), target: sum('target'), ad: sum('ad'), budget: sum('budget'),
    msg: sum('msg'), msg2: sum('msg2'), msg5: sum('msg5'), buy: sum('purchase_msg'),
    cmt: sum('cmt'), fol: sum('fol'), units: sum('units'), tUnits: sum('t_units'),
    contacts: sum('contacts'), paid: sum('contacts_paid'),
  };
  return Object.assign(t, {
    ach: div(t.rev, t.target), roas: div(t.rev, t.ad), cir: div(t.ad, t.rev), cpm: div(t.ad, t.msg),
    cpc: div(t.ad, t.cmt), r2: div(t.msg2, t.msg), r5: div(t.msg5, t.msg2), buyRate: div(t.buy, t.msg),
    budgetUse: div(t.ad, t.budget), unitAch: div(t.units, t.tUnits),
  });
}

const rowsOf = m => RAW_ROWS.filter(r => r.month === m);
const prevMonth = m => MONTHS[MONTHS.indexOf(m) - 1] || null;
const pctChange = (cur, prev) => (prev ? cur / prev - 1 : null);

/** Median of numeric values (nulls dropped). */
function median(vals) {
  const v = vals.filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const h = Math.floor(v.length / 2);
  return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
}

/** Read a CSS custom property so charts follow the active theme. */
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Shared floating tooltip for the HTML-built visuals (bullet, funnel, table cells). */
const Tip = {
  el: null,
  show(html, x, y) {
    this.el = this.el || document.getElementById('tip');
    this.el.innerHTML = html;
    this.el.classList.add('on');
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    this.el.style.left = Math.min(x + 14, window.innerWidth - w - 8) + 'px';
    this.el.style.top = Math.max(8, y - h - 12) + 'px';
  },
  hide() { this.el && this.el.classList.remove('on'); },
  bind(root) {
    root.querySelectorAll('[data-tip]').forEach(n => {
      n.addEventListener('mousemove', e => Tip.show(n.dataset.tip, e.clientX, e.clientY));
      n.addEventListener('mouseleave', () => Tip.hide());
    });
  },
};
