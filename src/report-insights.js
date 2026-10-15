// ---------- Insights: analyst notes per month (hand-written) + rule-based fallback + data-quality checks ----------

// Analyst notes per month. Add a new key ("2026.10") each month; months without notes use autoTakeaways().
//   overall / action : headline paragraph of the detailed takeaway section (business first, then digital)
//   shops            : [store, tag, finding(c), action] — `finding` is a function of the live context `c`
//                      (see takeawayContext) so every number comes from the data, not typed by hand
//   slide            : [tag, headline, detail, action] — fixed text for the 1-page slide (3–4 real insights)
const MONTH_NOTES = {
  '2026.09': {
    overall: c => `<b>Business:</b> ${c.money(c.t.rev)} sell-in (${c.mom(c.t.rev, c.p.rev)} vs ${c.ps}) for ${c.money(c.t.ad)} marketing cost
      → CIR ${c.pct(c.t.cir, 2)}, ROAS ${c.num(c.t.roas)}. <b>${c.t.hits}/${c.t.nT} stores hit the adjusted target</b>
      (monthly plan only ${c.t.planHits}/${c.t.nT}), but ${c.slowing.length} of them are slowing vs ${c.prior} (${c.names(c.slowing)}).
      Đại Hồng Phát alone is ${c.pct(c.s('Đại Hồng Phát').rev / c.t.rev, 0)} of sell-in.
      <br><b>Digital:</b> messages ${c.mom(c.t.msg, c.p.msg)}, Cost/Message ${c.money(c.t.cpm)} (${c.mom(c.t.cpm, c.p.cpm)}),
      inbox purchases ${c.int(c.p.buy)} → ${c.int(c.t.buy)} (${c.mom(c.t.buy, c.p.buy)}).`,
    action: 'Action: move budget from BigMi & CPS to Mi360 and Hotek · re-activate the slowing on-target stores before Q4 · verify Đại Hồng Phát before closing the numbers.',
    shops: [
      ['Đại Hồng Phát', 'verify', c => { const x = c.s('Đại Hồng Phát'); return `${c.money(x.rev)} sell-in (${c.pct(x.achM, 0)} of plan, ${c.int(x.units)} units vs ${c.int(x.t_units)}) while its messages ${c.momShop(x, 'msg')} and spend ${c.momShop(x, 'ad')} — the jump is not digital-driven.`; },
        'Verify the order source (wholesale / project?) and keep it out of digital KPIs.'],
      ['BigMi', 'fix', c => { const x = c.s('BigMi'); return `${c.isMax(x, 'adCost') ? 'Largest' : 'High'} spend ${c.money(x.adCost)} (${c.pct(x.adCost / c.t.ad, 0)} of total) for ${fmtAdj(x)} of adjusted target (−${c.money(x.gap)}), sell-in ${c.trend(x)}. ROAS ${c.num(x.roas)}, Cost/Message ${c.money(x.cpm)}, ${c.int(n0(x.purchase_msg))} inbox orders.`; },
        'Cut budget; rebuild audiences & creatives until Cost/Message < ₫20K.'],
      ['CPS', 'fix', c => { const x = c.s('CPS'); return `Ran ${c.money(x.adCost)} with no budget plan for ${fmtAdj(x)} of adjusted target. Cost/Message ${c.money(x.cpm)} (${(x.cpm / c.t.cpm).toFixed(1)}× avg), CIR ${c.pct(x.cir, 2)}, ${c.int(n0(x.purchase_msg))} inbox orders.`; },
        'Cap spend; agree KPIs and the KA model before running again.'],
      ['Mi360', 'scale', c => { const x = c.s('Mi360'); return `On adjusted target though only ${c.pct(x.achM, 0)} of plan (Jul–Aug front-loaded); sell-in ${c.trend(x)}. ${c.isMin(x, 'cpm') ? 'Lowest' : 'Low'} Cost/Message ${c.money(x.cpm)}, ROAS ${c.num(x.roas)}, but used only ${c.pct(x.budgetUse, 0)} of budget; messages ${c.momShop(x, 'msg')}.`; },
        'Raise budget to win back message volume, keep Cost/Message ≤ ₫16K.'],
      ['Hotek', 'scale', c => { const x = c.s('Hotek'); return `On target (${c.pct(x.achM, 0)} of plan), sell-in ${c.trend(x)}. ${c.int(n0(x.purchase_msg))} inbox orders${c.isMax(x, 'purchase_msg') ? ' — highest of all stores —' : ''} at ${c.money(x.cpm)}/message; used ${c.pct(x.budgetUse, 0)} of budget.`; },
        'Keep and add budget; copy its inbox script to other stores.'],
      ['Cường Phát', 'keep', c => { const x = c.s('Cường Phát'); return `Met adjusted target only thanks to Jul–Aug: ${c.pct(x.achM, 0)} of plan, sell-in ${c.trend(x)}. Cost/Message ${c.money(x.cpm)} is fine, but 2-way rate only ${c.pct(x.r2, 0)}.`; },
        'Conversion is the bottleneck: faster inbox replies and follow-ups before Q4.'],
      ['Danke', 'keep', c => { const x = c.s('Danke'); return `On target (${c.pct(x.achM, 0)} of plan) but sell-in ${c.trend(x)}. Cost/Message ${c.money(x.cpm)} (${c.momShop(x, 'cpm')}), ${c.int(n0(x.purchase_msg))} inbox orders, 5-way/2-way ${c.pct(x.r5, 0)}.`; },
        'Keep spend and use its chat flow as the benchmark; watch sell-in.'],
      ['Homecare', 'keep', c => { const x = c.s('Homecare'); return `On target (${c.pct(x.achM, 0)} of plan) on a small ${c.money(x.adCost)} budget, but sell-in ${c.trend(x)}; Cost/Message ${c.money(x.cpm)}.`; },
        'Keep current spend; check stock-in plan for Q4.'],
      ['H&T Smart Home', 'optimize', c => { const x = c.s('H&T'); return `${fmtAdj(x)} of adjusted target (−${c.money(x.gap)}), sell-in ${c.trend(x)}. Cost/Message ${c.money(x.cpm)}; 5-way/2-way ${c.pct(x.r5, 0)}.`; },
        'Tighten targeting and the follow-up script to push 2-way → 5-way.'],
      ['Domotek', 'optimize', c => { const x = c.s('Domotek'); return `${fmtAdj(x)} of adjusted target — short by ${c.money(x.gap)}. Spend ${c.momShop(x, 'ad')}, messages ${c.momShop(x, 'msg')}, but sell-in ${c.momShop(x, 'revenue')}.`; },
        'More leads are not converting: check lead quality and the closing process.'],
      ['Giang Chi SmartHome', 'fix', c => { const x = c.s('Giang Chi'); return `CIR ${c.pct(x.cir, 2)}${c.isMax(x, 'cir') ? ' — highest' : ''}, ${fmtAdj(x)} of adjusted target, Cost/Message ${c.money(x.cpm)}, ${c.int(n0(x.purchase_msg))} inbox orders.`; },
        'Reduce budget or change the hero offer.'],
    ],
    slide: [
      ['target', '6/11 stores on target, only 4/11 on plan',
        'Mi360 (98% of plan) and Cường Phát (72%) front-loaded stock-in in Jul–Aug, so Sep still closes Q3. Below: BigMi, CPS, Giang Chi, H&T, Domotek (−₫50M).',
        'Push only these 5; Domotek is one order away.'],
      ['budget', '44% of ad spend went to stores below target',
        'BigMi spent most (₫34.3M) for 35% of target, ROAS 66. CPS spent ₫21.6M off-plan at ₫48.3K/msg, 0 inbox orders.',
        'Shift to Mi360: ₫12.2K/msg, only 21% of budget used.'],
      ['funnel', 'Messages −13%, inbox purchases +63%',
        '94 → 153 orders while Cost/Message +4% (₫19.9K). Hotek + Danke bring 41% of inbox orders at ₫12.9–15.0K/msg.',
        'Roll out their chat script to the other stores.'],
      ['verify', 'Đại Hồng Phát = 50% of revenue, not digital',
        '₫16.92B, 1,780 units vs 233 target while its messages −7.5%. Excluding it: ROAS 103, CIR 0.97%.',
        'Verify the source; report it outside digital KPIs.'],
    ],
    quality: ['The internal dashboard shows ROAS <b>115.82</b> · CIR <b>0.86%</b> · Cost/Message <b>₫20,813</b> — these are <b>Q3 cumulative (Jul–Sep)</b>, while Amount Spent ₫196.6M is September only. The cards mix two periods → label the period or use one filter.'],
  },
};

const TAG_LABEL = {
  scale: 'SCALE', fix: 'FIX', optimize: 'OPTIMIZE', verify: 'VERIFY', keep: 'MAINTAIN',
  target: 'TARGET', budget: 'BUDGET', funnel: 'FUNNEL',
};

/** Rule-based takeaways for months that have no hand-written note. */
function autoTakeaways(shops, t) {
  return [...shops].sort((a, b) => b.adCost - a.adCost).map(s => {
    let tag = 'optimize', act = 'Improve message → order conversion.';
    if (s.achM > 2) { tag = 'verify'; act = 'Verify revenue data before closing.'; }
    else if (s.ach >= 1 && s.cpm != null && s.cpm <= t.cpm) { tag = 'scale'; act = 'Add budget, hold Cost/Message.'; }
    else if (s.ach >= 1) { tag = 'keep'; act = 'Maintain, optimise Cost/Message.'; }
    else if ((s.cir != null && s.cir > 2 * t.cir) || s.ach < 0.6) { tag = 'fix'; act = 'Cut/adjust budget, review targeting & offer.'; }
    const txt = `Adjusted target: ${fmtAdj(s)} (plan ${fmtPct(s.achM, 0)}) · spend ${fmtMoney(s.adCost)} · ROAS ${fmtNum(s.roas, 1)} · Cost/Message ${fmtMoney(s.cpm)} · ${fmtInt(s.purchase_msg)} inbox orders.`;
    return [s.name, tag, txt, act];
  });
}

/** Live numbers + formatters handed to the analyst-note templates. */
function takeawayContext(month, shops, t) {
  const pm = prevMonth(month);
  const p = pm ? aggregate(rowsOf(pm)) : {};
  const prevRow = x => RAW_ROWS.find(r => r.shop === x.shop && r.month === pm) || {};
  const ext = (key, dir) => shops.filter(x => x[key] != null && isFinite(x[key])).sort((a, b) => dir * (a[key] - b[key]))[0];
  const mom = (cur, prev) => { const d = pctChange(cur, prev); return d == null || !isFinite(d) ? 'n/a' : `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(0)}%`; };
  const momentum = t.momentum || [];
  const qm = quarterMonths(month);
  return {
    t, p, ps: pm ? monthShort(pm) : '', prior: qm.slice(0, -1).map(monthShort).join('–') || 'last month',
    s: name => { const x = shops.find(y => y.name.startsWith(name)); if (!x) throw new Error(`store "${name}" not in data`); return x; },
    money: v => fmtMoney(v), pct: (v, d = 1) => fmtPct(v, d), int: fmtInt, num: (v, d = 1) => fmtNum(v, d), mom,
    momShop: (x, key) => { const prev = prevRow(x); const cur = key === 'ad' ? x.adCost : key === 'msg' ? x.msgs : key === 'cpm' ? x.cpm : x[key];
      const pv = key === 'cpm' ? div(n0(prev.ad), n0(prev.msg)) : prev[key]; return mom(cur, pv); },
    trend: x => { const r = momentum.find(m => m.s.shop === x.shop); return r && r.chg != null ? `${r.chg >= 0 ? '+' : '−'}${Math.abs(r.chg * 100).toFixed(0)}% vs ${qm.length > 1 ? 'prior months' : 'last month'}` : 'new'; },
    isMax: (x, key) => ext(key, -1) === x, isMin: (x, key) => ext(key, 1) === x,
    slowing: momentum.filter(r => r.signal === 'slowing').map(r => r.s),
    names: list => list.map(x => x.name).join(', ') || '—',
  };
}

function renderTakeaways(month, shops, t) {
  const note = MONTH_NOTES[month];
  let cards, overall;
  try {
    const c = note ? takeawayContext(month, shops, t) : null;
    const val = v => (typeof v === 'function' ? v(c) : v);
    cards = note ? note.shops.map(([name, tag, txt, act]) => [name, tag, val(txt), act]) : autoTakeaways(shops, t);
    overall = note ? `${val(note.overall)}<span class="act">${note.action}</span>` : null;
  } catch (e) { // a note refers to a store missing from the data → fall back to rules rather than break the page
    console.warn('Analyst notes skipped:', e.message);
    cards = autoTakeaways(shops, t); overall = null;
  }
  overall = overall || `<b>Overall:</b> ${fmtMoney(t.ad)} ad spend → ${fmtMoney(t.rev)} revenue (${t.hits}/${t.nT} stores on adjusted target), ROAS ${fmtNum(t.roas, 1)}, CIR ${fmtPct(t.cir, 2)}.`;
  document.getElementById('takeaway-sub').textContent = note ? 'Analyst notes · all figures pulled live from the data' : 'Rule-based (no analyst notes for this month yet)';
  document.getElementById('takeaways').innerHTML = `<div class="overall">${overall}</div><div class="tk-grid">${cards.map(([name, tag, txt, act]) => `
    <div class="tk"><div class="tk-top"><b>${name}</b><span class="tag ${tag}">${TAG_LABEL[tag]}</span></div>
    <p>${txt}</p><div class="act">→ ${act}</div></div>`).join('')}</div>`;
}

/** Automatic data checks — anything that would make the numbers above misleading. */
function qualityChecks(month, shops) {
  const out = [];
  const prev = prevMonth(month);
  shops.filter(s => s.achM > 2).forEach(s => out.push(`<b>${s.name}</b> at ${fmtPct(s.achM, 0)} of monthly plan (${fmtInt(s.units)} units vs target ${fmtInt(s.t_units)}) — unusual, please verify.`));
  if (prev) {
    const now = new Set(shops.map(s => s.shop));
    const missing = rowsOf(prev).filter(r => !now.has(r.shop)).map(r => shortName(r.shop));
    if (missing.length) out.push(`No data this month for <b>${missing.join(', ')}</b> (present in ${monthLabel(prev)}) — MoM totals cover different stores.`);
  }
  shops.filter(s => !s.budget && s.adCost > 0).forEach(s => out.push(`<b>${s.name}</b> spent ${fmtMoney(s.adCost)} on FB but its planned budget (Est. Ad Cost) is 0.`));
  shops.filter(s => n0(s.msg2) > s.msgs && s.msgs > 0).forEach(s => out.push(`<b>${s.name}</b>: 2-way (${fmtInt(s.msg2)}) exceeds total messages (${fmtInt(s.msgs)}).`));
  const byR2 = {};
  shops.filter(s => s.r2 != null).forEach(s => { const k = Math.round(s.r2 * 100); (byR2[k] = byR2[k] || []).push(s.name); });
  Object.entries(byR2).filter(([, v]) => v.length >= 4).forEach(([k, v]) => out.push(`${v.length} stores share the same 2-way rate ≈ <b>${k}%</b> (${v.join(', ')}) — possibly estimated, check the source.`));
  quarterMonths(month).forEach(qm => rowsOf(qm).filter(r => r.target && r.revenue == null).forEach(r =>
    out.push(`<b>${shortName(r.shop)}</b> has a ${monthLabel(qm)} target of ${fmtMoney(r.target)} but no revenue — its adjusted target this month may be overstated.`)));
  const noSrc = shops.filter(s => !s.has_source).map(s => s.name);
  if (noSrc.length) out.push(`<b>Source Table</b> missing for ${noSrc.length} stores: ${noSrc.join(', ')}.`);
  return out.concat((MONTH_NOTES[month] && MONTH_NOTES[month].quality) || []);
}

function renderQuality(month, shops) {
  const items = qualityChecks(month, shops);
  document.getElementById('quality').innerHTML = items.length ? items.map(i => `<li>${i}</li>`).join('') : '<li>No anomalies detected.</li>';
}
