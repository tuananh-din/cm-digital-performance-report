// ---------- Insights: analyst notes per month (hand-written) + rule-based fallback + data-quality checks ----------

// Hand-written analyst notes. Add a new key ("2026.10") each month; months without notes use autoTakeaways().
//   overall / action : headline paragraph of the detailed takeaway section
//   shops            : [store, tag, finding, action] cards
//   slide            : [tag, headline, detail, action] — only the 3–4 real insights, shown on the 1-page slide
const MONTH_NOTES = {
  '2026.09': {
    overall: `<b>Sep 2026:</b> ₫196.6M ad spend (−10% vs Aug) → <b>₫33.92B revenue</b> (+34%), ROAS 172.5 (Aug 115.5), CIR 0.58%.
      <b>6/11 stores hit the adjusted target</b> (Q3 target − Jul+Aug revenue) vs only 4/11 on the monthly plan.
      Messages −13% and Cost/Message +4% (₫19.9K), yet inbox purchases +63% (94 → 153). Đại Hồng Phát alone is 50% of revenue.`,
    action: 'Action: move budget from BigMi & CPS to Mi360, Hotek, Danke · verify Đại Hồng Phát before closing the numbers.',
    shops: [
      ['Đại Hồng Phát', 'verify', '₫16.92B in Sep (484% of plan, 1,780 units vs 233) while messages −7.5% and spend −4.5% — the jump is not digital-driven.', 'Verify the order source (wholesale / project?) and keep it out of digital KPIs.'],
      ['Mi360', 'scale', 'On adjusted target (98% of monthly plan, front-loaded Jul–Aug). Lowest Cost/Message ₫12.2K, ROAS 463, but used only 21% of budget; messages −40%.', 'Raise budget to win back message volume, keep Cost/Message ≤ ₫16K.'],
      ['Hotek', 'scale', 'On target (134% of plan). 33 inbox orders — highest of all stores — at ₫15.0K/message; spent 19% over budget.', 'Keep and add budget; copy its inbox script to other stores.'],
      ['Danke', 'scale', 'On target (105% of plan). Cost/Message ₫12.9K (−54% MoM) with spend −45%; 30 inbox orders, 5-way/2-way 23% (best in MD).', 'Scale with control; use as the 2-way → 5-way chat benchmark.'],
      ['Cường Phát', 'keep', 'Only 72% of monthly plan but on adjusted target thanks to Jul–Aug. Cost/Message ₫16.0K is fine, 2-way rate only 70%.', 'Bottleneck is conversion: faster inbox replies and follow-ups.'],
      ['Homecare', 'keep', 'On target (103% of plan) on a small ₫8.5M budget; Cost/Message ₫17.6K (−16% MoM).', 'Keep current spend.'],
      ['Domotek', 'optimize', '88% of adjusted target — short by just ₫50M. Spend doubled, messages +157%, Cost/Message −22%, but revenue −28%.', 'More leads are not converting: check lead quality and the closing process.'],
      ['H&T Smart Home', 'optimize', '65% of adjusted target (−₫1.23B). Cost/Message ₫24.8K, among the highest in MD; 5-way/2-way 13.5%.', 'Tighten targeting and the follow-up script to push 2-way → 5-way.'],
      ['BigMi', 'fix', 'Largest spend ₫34.3M (17% of total) for 35% of adjusted target (−₫4.25B); ROAS 66, Cost/Message ₫24.8K, 12 inbox orders.', 'Cut budget; rebuild audiences & creatives until Cost/Message < ₫20K.'],
      ['CPS', 'fix', 'Ran ₫21.6M with no budget plan. Cost/Message ₫48.3K (2.4× avg), CIR 2.73%, 17% of adjusted target, 0 inbox orders.', 'Cap spend; agree KPIs and the KA model before running again.'],
      ['Giang Chi SmartHome', 'fix', 'Highest CIR 5.65%, 18% of adjusted target, Cost/Message ₫27.8K, 0 inbox orders.', 'Reduce budget or change the hero offer.'],
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

function renderTakeaways(month, shops, t) {
  const note = MONTH_NOTES[month];
  const cards = note ? note.shops : autoTakeaways(shops, t);
  const overall = note ? `${note.overall}<span class="act">${note.action}</span>`
    : `<b>Overall:</b> ${fmtMoney(t.ad)} ad spend → ${fmtMoney(t.rev)} revenue (${t.hits}/${t.nT} stores on adjusted target), ROAS ${fmtNum(t.roas, 1)}, CIR ${fmtPct(t.cir, 2)}.`;
  document.getElementById('takeaway-sub').textContent = note ? 'Analyst notes for this month' : 'Rule-based (no analyst notes for this month yet)';
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
