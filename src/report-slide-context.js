// ---------- Slide period contexts: the same 1-page slide rendered for a month or for its quarter ----------
// A context carries everything the slide needs (stores, totals, comparison period, labels, notes), so
// renderSlide() does not care whether it is showing "Sep 2026" or "Q3 2026".

const SUM_FIELDS = ['target', 'revenue', 'units', 't_units', 'units_o2o', 'contacts', 'contacts_org', 'contacts_paid',
  'budget', 'ad', 'msg', 'msg2', 'msg5', 'msg_org', 'msg_cmt', 'purchase_msg', 'cmt', 'fol'];

const quarterKey = month => ({ y: month.slice(0, 4), q: Math.ceil(+month.slice(5) / 3) });
const monthsOfQuarter = (y, q) => MONTHS.filter(m => m.slice(0, 4) === String(y) && Math.ceil(+m.slice(5) / 3) === q);

/** One synthetic row per store with every additive field summed over `months` (ratios are re-derived later). */
function storeRowsOver(months) {
  const by = {};
  RAW_ROWS.filter(r => months.includes(r.month)).forEach(r => {
    const o = by[r.shop] || (by[r.shop] = { month: months[months.length - 1], shop: r.shop, tier: r.tier, has_source: r.has_source });
    SUM_FIELDS.forEach(k => { if (r[k] != null) o[k] = (o[k] || 0) + r[k]; });
  });
  return Object.values(by);
}

function monthSlideContext(month, shops, t) {
  const pm = prevMonth(month);
  return {
    kind: 'month', fileKey: month.replace('.', '-'), label: monthLabel(month), prevLabel: pm ? monthLabel(pm) : '',
    prevShort: pm ? monthShort(pm) : '', shops, t, p: pm ? aggregate(rowsOf(pm)) : null,
    reportName: 'Monthly report', scope: `target adjusted to ${t.qLabel} plan`,
    storesSub: `monthly plan only: ${t.planHits}/${t.nT}`,
    chartTitle: 'Monthly Revenue vs Adjusted Target by Store',
    combo: { periodShort: monthShort(month), qLabel: t.qLabel, priorLabel: t.priorLabel },
    notes: MONTH_NOTES[month],
  };
}

/** Quarter-to-date of the selected month, compared with the same number of months of the previous quarter. */
function quarterSlideContext(month) {
  const { y, q } = quarterKey(month);
  const qm = quarterMonths(month);
  const partial = qm.length < 3;
  const shops = storeRowsOver(qm).map(shopMetrics);
  shops.forEach(s => Object.assign(s, { achM: s.ach, tAdj: n0(s.target), met: s.target ? s.rev >= s.target : null, gap: n0(s.target) - s.rev }));
  const t = aggregate(storeRowsOver(qm));
  Object.assign(t, { hits: shops.filter(s => s.met).length, nT: shops.filter(s => s.target).length });
  const pq = q === 1 ? { y: +y - 1, q: 4 } : { y, q: q - 1 };
  const pm = monthsOfQuarter(pq.y, pq.q).slice(0, qm.length); // like-for-like when the quarter is not finished
  const range = `${monthShort(qm[0])}–${monthShort(qm[qm.length - 1])}`;
  return {
    kind: 'quarter', fileKey: `${y}-Q${q}`, label: `Q${q} ${y}${partial ? ' (QTD)' : ''}`,
    prevLabel: pm.length ? `Q${pq.q} ${pq.y}` : '', prevShort: pm.length ? `Q${pq.q}` : '',
    shops, t, p: pm.length ? aggregate(RAW_ROWS.filter(r => pm.includes(r.month))) : null,
    reportName: 'Quarterly report', scope: `${range} · quarter target = sum of monthly plans`,
    storesSub: `${fmtPct(t.ach, 0)} of ${fmtMoney(t.target)} target`,
    chartTitle: 'Quarterly Revenue vs Target by Store',
    combo: { periodShort: `Q${q}`, targetName: `Q${q} target`, targetLegend: `Q${q} target (sum of monthly plans)`, showPlan: false },
    notes: partial ? null : QUARTER_NOTES[`${y}-Q${q}`],
  };
}
