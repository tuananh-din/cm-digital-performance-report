// ---------- Auto-computed deeper insights for the selected month (works for any month) ----------

function insightCard(kicker, big, text, tone = '') {
  return `<div class="ins ${tone}"><div class="ins-k">${kicker}</div><div class="ins-big">${big}</div><p>${text}</p></div>`;
}

function renderAdvancedInsights(shops, t) {
  const cards = [];
  const names = list => list.map(s => s.name).join(', ') || '—';
  const spent = shops.filter(s => s.adCost > 0);

  // 1. Where does the money go: share of spend in stores below the adjusted target
  const missing = spent.filter(s => s.ach != null && s.ach < 1);
  const missSpend = missing.reduce((a, s) => a + s.adCost, 0);
  cards.push(insightCard('Budget allocation', fmtPct(div(missSpend, t.ad), 0),
    `of ad spend (${fmtMoney(missSpend)}) goes to <b>${missing.length} stores below adjusted target</b>: ${names(missing.sort((a, b) => b.adCost - a.adCost))}.`, 'bad'));

  // 2. Best-value shops: cheaper than average per message AND on target
  const value = spent.filter(s => s.cpm != null && s.cpm <= t.cpm && s.ach >= 1);
  const valueSpend = value.reduce((a, s) => a + s.adCost, 0);
  cards.push(insightCard('Best-value stores', `${value.length} stores`,
    `Cost/Message ≤ average (${fmtMoney(t.cpm)}) and on target: <b>${names(value)}</b> — they get only ${fmtPct(div(valueSpend, t.ad), 0)} of the budget.`, 'good'));

  // 3. Budget pacing vs plan
  const over = spent.filter(s => s.budgetUse > 1.1 && s.budgetUse !== Infinity);
  const under = spent.filter(s => s.budgetUse != null && s.budgetUse < 0.6);
  const noPlan = spent.filter(s => s.budgetUse === Infinity);
  cards.push(insightCard('Budget pacing', fmtPct(t.budgetUse, 0),
    `of the ${fmtMoney(t.budget)} plan used. Over 110%: <b>${names(over)}</b>. Under 60%: <b>${names(under)}</b>.${noPlan.length ? ` Spent without a plan: <b>${names(noPlan)}</b>.` : ''}`));

  // 4. Tier view
  const tierAdj = k => { const ss = shops.filter(s => s.tier === k && s.target); return { ach: div(ss.reduce((a, s) => a + s.rev, 0), ss.reduce((a, s) => a + Math.max(0, s.tAdj), 0)), hits: ss.filter(s => s.met).length, n: ss.length }; };
  const tiers = ['MD', 'PD', 'KA'].map(k => [k, aggregate(shops.filter(s => s.tier === k)), tierAdj(k)]).filter(([, a]) => a.shops);
  cards.push(`<div class="ins wide"><div class="ins-k">Performance by tier</div><table class="tier-t"><thead><tr><th>Tier</th><th>Stores</th><th>Revenue</th><th>On target</th><th>Ad spend</th><th>ROAS</th><th>Cost/Msg</th></tr></thead><tbody>${tiers.map(([k, a, q]) =>
    `<tr><td><span class="pill tier ${k.toLowerCase()}">${k}</span></td><td>${a.shops}</td><td>${fmtMoney(a.rev)}</td><td class="${q.ach >= 1 ? 'good-t' : 'bad-t'}">${q.hits}/${q.n}</td><td>${fmtMoney(a.ad)}</td><td>${fmtNum(a.roas, 1)}</td><td>${fmtMoney(a.cpm)}</td></tr>`).join('')}</tbody></table></div>`);

  // 5. Paid dependency
  const org = shops.reduce((a, s) => a + n0(s.contacts_org), 0);
  const topOrg = [...shops].filter(s => s.contacts).sort((a, b) => n0(b.contacts_org) / b.contacts - n0(a.contacts_org) / a.contacts)[0];
  cards.push(insightCard('Paid dependency', fmtPct(div(t.paid, t.contacts), 0),
    `of contacts come from paid (${fmtInt(t.paid)}/${fmtInt(t.contacts)}); organic only ${fmtInt(org)}. Best organic: <b>${topOrg ? topOrg.name : '—'}</b> (${topOrg ? fmtPct(n0(topOrg.contacts_org) / topOrg.contacts, 0) : '–'}).`));

  // 6. Comments that turn into messages
  const fromCmt = shops.reduce((a, s) => a + n0(s.msg_cmt), 0);
  const topCmt = [...shops].sort((a, b) => n0(b.msg_cmt) - n0(a.msg_cmt)).slice(0, 3);
  cards.push(insightCard('Comment → Message', fmtInt(fromCmt),
    `messages started from a comment (${fmtPct(div(fromCmt, t.msg), 0)} of all messages). Top: <b>${topCmt.map(s => `${s.name} ${fmtInt(s.msg_cmt)}`).join(', ')}</b> — keep comment-driving content.`));

  // 7. O2O + basket
  const o2o = shops.reduce((a, s) => a + n0(s.units_o2o), 0);
  const o2oShops = shops.filter(s => n0(s.units_o2o) > 0).sort((a, b) => n0(b.units_o2o) - n0(a.units_o2o));
  cards.push(insightCard('Online → Offline (O2O)', fmtInt(o2o),
    `O2O units (${fmtPct(div(o2o, t.units), 1)} of all units) from ${o2oShops.length} stores: <b>${o2oShops.map(s => `${s.name} ${fmtInt(s.units_o2o)}`).join(', ') || '—'}</b>.`));

  const aovs = shops.filter(s => s.aov).sort((a, b) => b.aov - a.aov);
  if (aovs.length) {
    const hi = aovs[0], lo = aovs[aovs.length - 1];
    cards.push(insightCard('Average order value', `${fmtMoney(lo.aov, 1)} – ${fmtMoney(hi.aov, 1)}`,
      `highest <b>${hi.name}</b>, lowest <b>${lo.name}</b>. Low-AOV stores need more orders for the same target → push message volume; high-AOV → push lead quality (5-way).`));
  }

  // 8. Deep-conversation to purchase
  cards.push(insightCard('5-way → purchase', fmtPct(div(t.buy, t.msg5), 1),
    `${fmtInt(t.buy)} orders from ${fmtInt(t.msg5)} 5-way conversations. Each inbox order costs ${fmtMoney(div(t.ad, t.buy))} in ads (inbox-attributed orders only).`));

  document.getElementById('adv-insights').innerHTML = cards.join('');
}
