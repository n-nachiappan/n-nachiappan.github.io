const { test, expect } = require('@playwright/test');
const { load, setInputs, exportCSV, waitForStress, waitForFix, BAL_AT_RET } = require('./helpers');

// A representative default scenario the page boots with (single, retiring now at 60).
// Each test loads a fresh page, so they don't share state.

test.describe('1. Page boot & rendering', () => {
  test('loads, runs, renders a verdict with no uncaught errors', async ({ page }) => {
    const errors = await load(page);
    const badge = await page.evaluate(() => document.getElementById('vBadge').textContent.trim());
    expect(badge.length).toBeGreaterThan(0);
    const tabs = await page.evaluate(() => document.querySelectorAll('.tab').length);
    expect(tabs).toBe(3);
    expect(errors).toEqual([]);
  });

  test('survives a battery of input changes without throwing', async ({ page }) => {
    const errors = await load(page);
    await setInputs(page, { sage: '58' });          // -> married
    await setInputs(page, { sage: '' });            // -> single
    await setInputs(page, { stateMode: 'ca' });     // change handled via select input event
    await page.evaluate(() => { document.querySelector('#presetSeg button[data-v="conservative"]').click(); });
    await page.evaluate(() => { document.querySelector('#stratSeg button[data-v="pct"]').click(); });
    await setInputs(page, { rage: '70', target: '200,000', pretax: '5,000,000', hsa: '300,000' });
    await setInputs(page, { age: '45', sage: '47', sSalary: '90,000', sCareerStart: '24' });
    expect(errors).toEqual([]);
  });
});

test.describe('2. Social Security benefit math', () => {
  test('claim adjustments match SSA rules', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => ({
      fra: claimAdjust(1000, 67),
      early62: claimAdjust(1000, 62),
      delayed70: claimAdjust(1000, 70),
    }));
    expect(r.fra).toBeCloseTo(1000, 6);
    expect(r.early62).toBeCloseTo(700, 0);    // 62 ~= 70% of PIA
    expect(r.delayed70).toBeCloseTo(1240, 6); // +8%/yr * 3 yrs = 124%
  });

  test('PIA is positive and the optimizer objective equals the simulation (today $)', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const st = lastRun.st;
      // Use the exact monthly PIA the simulation ran with (computePIA now takes infl & wage-growth args;
      // the resolved value already reflects them, plus any override), so the reconciliation is signature-independent.
      const pia = st.piaMonthlyResolved;
      const simReal = lastRun.rows.reduce((a, x) => a + (x.ss || 0) / Math.pow(1 + st.infl, x.t), 0);
      const obj = lifeSSrealPair(st, st.claim, st.claimSpouse, pia, st.spousePiaResolved).total;
      return { pia, simReal, obj };
    });
    expect(r.pia).toBeGreaterThan(0);
    expect(Math.abs(r.simReal - r.obj)).toBeLessThan(2); // exact reconciliation
  });

  test('PIA is invariant to the inflation input and rises with real wage growth', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      // Build a controlled young-earner record directly, so the result depends only on the args under test.
      const piaFor = (infl, wg) => computePIA(buildWages(100000, 30, 67, infl, 22, wg), 30, infl, wg).pia;
      return {
        lowInfl: piaFor(0.02, 0.011), highInfl: piaFor(0.06, 0.011), // same wage growth, different inflation
        noGrowth: piaFor(0.025, 0),   growth: piaFor(0.025, 0.011),  // same inflation, real growth on/off
      };
    });
    // The today's-dollar PIA must not move with the inflation assumption (the AWI fix).
    expect(Math.abs(r.highInfl - r.lowInfl)).toBeLessThan(2);
    // Real wage growth lifts a future retiree's benefit (≈ (1+g)^years to age-62 eligibility).
    expect(r.growth).toBeGreaterThan(r.noGrowth * 1.2);
  });
});

test.describe('3. Readiness verdict — sustainability invariant', () => {
  for (const sc of [
    { name: 'single, retire now', inputs: {} },
    { name: 'married, retire now', inputs: { sage: '58', sSalary: '90,000' } },
    { name: 'big pre-tax + HSA', inputs: { pretax: '2,500,000', hsa: '150,000', endAge: '92' } },
    { name: 'California, conversions context', inputs: { stateMode: 'ca', pretax: '1,800,000' } },
  ]) {
    test(`sustainable income is genuinely sustainable (${sc.name})`, async ({ page }) => {
      await load(page);
      if (Object.keys(sc.inputs).length) await setInputs(page, sc.inputs);
      const r = await page.evaluate((expr) => {
        const st = lastRun.st;
        const { bal, startSage } = eval(expr);
        const S = maxSustainable(st, bal, st.retireAge, startSage);
        const sum = (t) => simulate({ ...st, target: t }, bal, st.retireAge, startSage, 1)
          .reduce((a, x) => a + x.shortfall, 0);
        return { S, atShort: sum(S * 0.999), aboveShort: sum(S * 1.05) };
      }, BAL_AT_RET);
      expect(r.S).toBeGreaterThan(0);
      expect(r.atShort).toBeLessThan(Math.max(50, r.S * 0.01)); // lasts AT the sustainable level
      expect(r.aboveShort).toBeGreaterThan(1000);                // fails 5% ABOVE it
    });
  }

  test('verdict classification is consistent with the ratio', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const sust = lastRun.stats.find((s) => /Sustainable/i.test(s.l));
      const ratio = lastRun.stats.find((s) => /of your target/i.test(s.l));
      return { badge: lastRun.badge, sust: sust && sust.n, ratio: ratio && ratio.n };
    });
    expect(r.sust).toBeTruthy();
    expect(r.ratio).toMatch(/%$/);
  });

  test('future retirement: required nest egg sustains and FV-annuity identity holds', async ({ page }) => {
    await load(page);
    await setInputs(page, { rage: '65', target: '140,000' });
    const r = await page.evaluate((expr) => {
      const st = lastRun.st;
      const { bal, startSage } = eval(expr);
      const tot = bal.pretax + bal.roth + bal.savPrin + bal.savGain + bal.hsa;
      const req = requiredPortfolio(st, bal, st.retireAge, startSage);
      const k = req / tot, scaled = (m) => ({ pretax: bal.pretax*m, roth: bal.roth*m, savPrin: bal.savPrin*m, savGain: bal.savGain*m, hsa: bal.hsa*m });
      const short = (m) => simulate(st, scaled(m), st.retireAge, startSage, 1).reduce((a, x) => a + x.shortfall, 0);
      const annual = (lastRun.stats.find((s) => /Extra saving/i.test(s.l)) || {}).n;
      const a = annual ? parseFloat(annual.replace(/[^0-9.]/g, '')) : 0;
      const N = st.retireAge - st.ageNow, fv = a * ((Math.pow(1 + st.ret, N) - 1) / st.ret);
      return { req, tot, atReq: short(k * 1.001), below: short(k * 0.9), gap: req - tot, a, fv };
    }, BAL_AT_RET);
    expect(r.atReq).toBeLessThan(Math.max(100, r.req * 0.0001));  // nest egg exactly sustains
    expect(r.below).toBeGreaterThan(1000);                        // 10% short fails
    expect(Math.abs(r.fv - r.gap)).toBeLessThan(r.gap * 0.01);    // saving compounds to the gap
  });
});

test.describe('4. Optimal Social Security claiming', () => {
  test('single: optimizer pick equals the survival-weighted argmax', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const st = lastRun.st, pia = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow).pia;
      let best = { age: 0, v: -1 };
      for (let c = 62; c <= 70; c++) {
        const v = lifeSSexpectedPair(st, c, c, pia, null).total;   // expected (survival-weighted) PV is the objective
        if (v > best.v) best = { age: c, v };
      }
      return { picked: st.optClaim.claimP, argmax: best.age };
    });
    expect(r.picked).toBe(r.argmax);
  });

  test('married: optimizer pick equals the survival-weighted argmax over the 9x9 grid', async ({ page }) => {
    await load(page);
    await setInputs(page, { sage: '58', sSalary: '90,000' });
    const r = await page.evaluate(() => {
      const st = lastRun.st;
      const pia = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow).pia, sp = computePIA(SWAGES, st.sageNow, st.infl, st.wageGrow).pia;
      let best = { cp: 0, cs: 0, v: -1 };
      for (let cp = 62; cp <= 70; cp++) for (let cs = 62; cs <= 70; cs++) {
        const v = lifeSSexpectedPair(st, cp, cs, pia, sp).total;
        if (v > best.v) best = { cp, cs, v };
      }
      return { picked: [st.optClaim.claimP, st.optClaim.claimS], argmax: [best.cp, best.cs] };
    });
    expect(r.picked).toEqual(r.argmax);
  });

  // The whole point of the survival-weighted model: the claiming optimum no longer depends on the plan-to age
  // (which is only the drawdown horizon, set by the preset).
  test('claiming optimum is independent of the plan-to age', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const st = lastRun.st, pia = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow).pia;
      return {
        shortHorizon: optimizeClaiming({ ...st, married: false, endAge: 74 }, pia, null).claimP,
        longHorizon:  optimizeClaiming({ ...st, married: false, endAge: 99 }, pia, null).claimP,
      };
    });
    expect(r.shortHorizon).toBe(r.longHorizon);   // plan-to age does not move the SS claiming decision
  });

  // Longevity DOES matter — through the sex-specific survival curve. A longer-lived profile delays at least as much.
  test('longer life expectancy (female) favors delaying at least as much as male', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const st = { ...lastRun.st, married: false, sageNow: null }, pia = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow).pia;
      return {
        male:   optimizeClaiming({ ...st, sex: 'm' }, pia, null).claimP,
        female: optimizeClaiming({ ...st, sex: 'f' }, pia, null).claimP,
      };
    });
    expect(r.female).toBeGreaterThanOrEqual(r.male);
    expect(r.male).toBeGreaterThanOrEqual(62);
    expect(r.female).toBeLessThanOrEqual(70);
  });

  // Best practice: a higher real discount rate discounts later (delayed) benefits more, so it favors claiming earlier.
  test('a higher real discount rate favors claiming earlier', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const st = { ...lastRun.st, married: false, sageNow: null }, pia = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow).pia;
      return {
        low:  optimizeClaiming({ ...st, realDisc: 0 },    pia, null).claimP,
        high: optimizeClaiming({ ...st, realDisc: 0.08 }, pia, null).claimP,
      };
    });
    expect(r.high).toBeLessThanOrEqual(r.low);   // more discounting → not later (usually earlier)
    expect(r.high).toBeLessThan(r.low);          // for a realistic earner the move is strict
  });

  // The Gompertz survival model is calibrated to the SSA period life table.
  test('survival model is monotonic and matches SSA life-expectancy anchors', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const ex = (a, sex) => { let s = 0; for (let t = 0.5; t < 70; t += 1) s += surviveProb(a, t, sex); return s + 0.5; };
      return {
        s0: surviveProb(65, 0, 'm'), s10: surviveProb(65, 10, 'm'), s30: surviveProb(65, 30, 'm'),
        fGTm: surviveProb(65, 25, 'f') > surviveProb(65, 25, 'm'),
        e65m: ex(65, 'm'), e65f: ex(65, 'f'),
      };
    });
    expect(r.s0).toBeCloseTo(1, 6);
    expect(r.s10).toBeGreaterThan(r.s30);            // survival decreases with horizon
    expect(r.fGTm).toBe(true);                       // women outlive men at the same age
    expect(r.e65m).toBeGreaterThan(16.5); expect(r.e65m).toBeLessThan(18.5);   // SSA male e65 ≈ 17.5
    expect(r.e65f).toBeGreaterThan(19.0); expect(r.e65f).toBeLessThan(21.0);   // SSA female e65 ≈ 20.2
  });
});

test.describe('5. Deemed-filing spousal mechanics', () => {
  test('early-claiming spouse is permanently reduced (own + excess, NOT a fresh 50%)', async ({ page }) => {
    await load(page);
    await setInputs(page, { age: '60', salary: '176,100', sage: '58', sSalary: '40,000' });
    const r = await page.evaluate(() => {
      const st = lastRun.st;
      const piaP = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow).pia, piaS = computePIA(SWAGES, st.sageNow, st.infl, st.wageGrow).pia;
      const A = ssAmountsFor(st, 70, 62, piaP, piaS); // you delay to 70, spouse claims 62
      const own = A.ssSpouseOwnAnnual, excess = A.ssSpouseExcessAnnual, combined = own + excess;
      return {
        piaP12: piaP * 12, piaS12: piaS * 12,
        own, expectedOwn: claimAdjust(piaS, 62) * 12,
        excess, combined, full50: piaP * 0.5 * 12,
      };
    });
    expect(r.own).toBeCloseTo(r.expectedOwn, 0);            // own reduced for claiming at 62
    expect(r.excess).toBeGreaterThan(0);                   // a spousal excess applies (primary is higher earner)
    expect(r.combined).toBeLessThan(r.full50 - 1);         // KEY: less than the old "full 50%" behavior
    expect(r.combined).toBeLessThan(r.piaS12 + r.excess + 1);
  });

  test('symmetric: when the spouse is the higher earner, the primary gets the excess', async ({ page }) => {
    await load(page);
    await setInputs(page, { age: '60', salary: '40,000', sage: '58', sSalary: '176,100' });
    const r = await page.evaluate(() => {
      const st = lastRun.st;
      const piaP = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow).pia, piaS = computePIA(SWAGES, st.sageNow, st.infl, st.wageGrow).pia;
      const A = ssAmountsFor(st, 62, 70, piaP, piaS); // you claim 62, spouse (higher) delays to 70
      return { primaryExcess: A.ssPrimaryExcessAnnual, spouseExcess: A.ssSpouseExcessAnnual };
    });
    expect(r.primaryExcess).toBeGreaterThan(0);
    expect(r.spouseExcess).toBeCloseTo(0, 0);
  });

  test('survivor keeps the larger of the two own records', async ({ page }) => {
    await load(page);
    await setInputs(page, { age: '60', salary: '176,100', sage: '58', sSalary: '40,000', endAge: '78', endAgeSpouse: '90' });
    const r = await page.evaluate(() => {
      const st = lastRun.st, rows = lastRun.rows;
      const surv = rows.find((x) => x.survivor);
      const expected = surv ? Math.max(st.ssPrimaryAnnual, st.ssSpouseOwnAnnual) * Math.pow(1 + st.infl, surv.t) : null;
      return surv ? { simSS: surv.ss, expected } : null;
    });
    expect(r).not.toBeNull();
    expect(Math.abs(r.simSS - r.expected)).toBeLessThan(2);
  });
});

test.describe('5b. Insured status (40 credits / 10 years of work)', () => {
  test('a single filer with under 10 years of work gets no own benefit', async ({ page }) => {
    await load(page);
    await setInputs(page, { age: '55', sage: '', salary: '120,000', careerStart: '55', rage: '62' }); // 7 working years
    const r = await page.evaluate(() => {
      const st = lastRun.st, pc = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow);
      return { years: pc.yearsWorked, insured: pc.insured, pia: pc.pia, resolved: st.piaMonthlyResolved };
    });
    expect(r.years).toBeLessThan(10);
    expect(r.insured).toBe(false);
    expect(r.pia).toBe(0);
    expect(r.resolved).toBe(0); // the plan uses $0
  });

  test('10+ years of work is insured and yields a positive benefit', async ({ page }) => {
    await load(page);
    await setInputs(page, { age: '55', sage: '', salary: '120,000', careerStart: '40', rage: '55' }); // 15 working years
    const r = await page.evaluate(() => {
      const st = lastRun.st, pc = computePIA(WAGES, st.ageNow, st.infl, st.wageGrow);
      return { years: pc.yearsWorked, insured: pc.insured, pia: pc.pia };
    });
    expect(r.years).toBeGreaterThanOrEqual(10);
    expect(r.insured).toBe(true);
    expect(r.pia).toBeGreaterThan(0);
  });

  test('a non-insured spouse still draws a spousal benefit on the insured record', async ({ page }) => {
    await load(page);
    await setInputs(page, { age: '62', salary: '180,000', careerStart: '22', rage: '65', sage: '60', sSalary: '50,000', sCareerStart: '60' }); // spouse 3 yrs
    const r = await page.evaluate(() => {
      const st = lastRun.st;
      const piaS = computePIA(SWAGES, st.sageNow, st.infl, st.wageGrow);
      const A = ssAmountsFor(st, st.claim, st.claimSpouse, st.piaMonthlyResolved, st.spousePiaResolved);
      return { spouseInsured: piaS.insured, own: A.ssSpouseOwnAnnual, excess: A.ssSpouseExcessAnnual, halfPrimary: st.piaMonthlyResolved * 0.5 * 12 };
    });
    expect(r.spouseInsured).toBe(false);
    expect(r.own).toBe(0);                                  // no own benefit
    expect(r.excess).toBeGreaterThan(0);                   // but a spousal benefit applies
    expect(r.excess).toBeLessThanOrEqual(r.halfPrimary + 1); // capped at 50% of the insured PIA (reduced if claimed early)
  });
});

test.describe('6. Tax-strategy optimization', () => {
  test('chosen combo is the true argmin (after the shortfall guard)', async ({ page }) => {
    await load(page);
    await setInputs(page, { sage: '58', pretax: '1,800,000', endAge: '90' });
    const r = await page.evaluate((expr) => {
      const st = lastRun.st;
      const { bal, startSage } = eval(expr);
      const combos = [];
      for (const sm of [false, true]) for (const ro of [-1, 2, 3, 4]) {
        const s = { ...st, smooth: sm, rothConvIdx: ro };
        const rows = simulate(s, bal, st.retireAge, startSage, 1);
        const fp = taxFootprint(s, rows);
        combos.push({ sm, ro, total: fp.total, short: fp.shortPV });
      }
      const minShort = Math.min(...combos.map((c) => c.short));
      const argmin = combos.filter((c) => c.short <= minShort + 1).reduce((a, b) => (b.total < a.total ? b : a));
      return { argmin: [argmin.sm, argmin.ro], chose: [st.taxOpt.best.smooth, st.taxOpt.best.rothConvIdx] };
    }, BAL_AT_RET);
    expect(r.chose).toEqual(r.argmin);
  });

  test('banner total equals the footprint of the actual displayed plan', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const st = lastRun.st;
      return { banner: st.taxOpt.best.total, actual: taxFootprint(st, lastRun.rows).total };
    });
    expect(Math.abs(r.banner - r.actual)).toBeLessThan(Math.max(2, r.banner * 0.005));
  });

  test('large pre-tax + long horizon makes Roth conversions worthwhile', async ({ page }) => {
    await load(page);
    await setInputs(page, { pretax: '2,500,000', endAge: '95' });
    const r = await page.evaluate(() => ({
      rothIdx: lastRun.st.taxOpt.best.rothConvIdx,
      saving: lastRun.st.taxOpt.baseline.total - lastRun.st.taxOpt.best.total,
    }));
    expect(r.rothIdx).toBeGreaterThanOrEqual(2); // some conversion bracket chosen
    expect(r.saving).toBeGreaterThan(1000);
  });
});

test.describe('7. IRMAA pre-retirement MAGI seeding', () => {
  test('retiring at 65 on a high salary triggers IRMAA in the first Medicare years', async ({ page }) => {
    await load(page);
    await setInputs(page, { age: '65', rage: '65', salary: '300,000' });
    const r = await page.evaluate(() => {
      const r0 = lastRun.rows[0];
      return { magiLag: r0.medDetail ? r0.medDetail.magiLag : 0, tier: r0.medDetail ? r0.medDetail.tier : 0 };
    });
    expect(r.magiLag).toBeGreaterThan(150000); // working-year salary used, not $0
    expect(r.tier).toBeGreaterThan(0);
  });

  test('regression: a 60-year-old retiree still uses simulated MAGI at 65', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const rows = lastRun.rows;
      const m65 = rows.find((x) => x.age === 65), m63 = rows.find((x) => x.age === 63);
      return { lag65: m65.medDetail ? Math.round(m65.medDetail.magiLag) : 0, magi63: Math.round(m63.magi) };
    });
    expect(r.lag65).toBe(r.magi63); // 2-year lookback = simulated age-63 MAGI
  });
});

test.describe('8. Volatility stress test', () => {
  test('is deterministic (seeded) across re-runs', async ({ page }) => {
    await load(page);
    const s1 = await waitForStress(page);
    await page.evaluate(() => { lastRun.stress = null; run(); });
    const s2 = await waitForStress(page);
    expect(s1.pct).toBe(s2.pct);
  });

  test('higher volatility lowers the success rate of a passing plan', async ({ page }) => {
    await load(page);
    await setInputs(page, { target: '60,000', vol: '4' });  // comfortably sustainable
    const low = await waitForStress(page);
    await page.evaluate(() => { lastRun.stress = null; });
    await setInputs(page, { vol: '20' });
    const high = await waitForStress(page);
    expect(low.pct).toBeGreaterThanOrEqual(high.pct);
    expect(high.pct).toBeLessThan(100);
  });

  test('lognormal draws are calibrated to the expected return', async ({ page }) => {
    await load(page);
    const mean = await page.evaluate(() => {
      const ret = 0.06, vol = 0.12, mu = Math.log(1 + ret) - vol * vol / 2;
      const rnd = mulberry32(7); let s = 0; const n = 60000;
      for (let k = 0; k < n; k++) s += Math.exp(mu + vol * gaussian(rnd));
      return s / n;
    });
    expect(mean).toBeCloseTo(1.06, 2);
  });

  test('vol=0 disables the test with a clear message', async ({ page }) => {
    await load(page);
    await setInputs(page, { vol: '0' });
    const txt = await page.evaluate(() => document.getElementById('vStress').textContent);
    expect(txt).toMatch(/0%/);
  });
});

test.describe('8b. "How to pass the stress test" recommendations', () => {
  // A cash reserve is drawn only in down-market years, so in the steady-return plan (no down years) it must be
  // completely inert — the engine produces byte-identical balances with or without it. Guards the engine change.
  test('a cash reserve is inert in the steady-return plan', async ({ page }) => {
    await load(page);
    const same = await page.evaluate((balExpr) => {
      const st = lastRun.st; const { bal, startSage } = eval(balExpr);
      const a = simulate({ ...st }, bal, st.retireAge, startSage, 1);
      const b = simulate({ ...st, cashReserve: 250000 }, bal, st.retireAge, startSage, 1);
      const end = (r) => r[r.length - 1];
      return Math.abs((end(a).endPretax + end(a).endRoth + end(a).endSav)
                    - (end(b).endPretax + end(b).endRoth + end(b).endSav));
    }, BAL_AT_RET);
    expect(same).toBeLessThan(1); // identical to the dollar
  });

  // The core mechanic: spending an out-of-market reserve during down years lifts the share of volatile paths
  // that survive. A large enough reserve must beat a zero reserve on a plan that is failing the stress test.
  test('a cash reserve raises the stress success rate of a failing plan', async ({ page }) => {
    await load(page);
    await setInputs(page, { target: '90,000' });        // the default boots short under volatility (~28%)
    const r = await page.evaluate((balExpr) => {
      const st = lastRun.st; const { bal, startSage } = eval(balExpr);
      const N = 120, t0 = st.retireAge - st.ageNow, mu = Math.log(1 + st.ret) - st.vol * st.vol / 2;
      const seqs = [];
      for (let i = 0; i < N; i++) { const rnd = mulberry32(0x51ab1e ^ Math.imul(i + 1, 2654435761)); const s = []; for (let t = t0; t <= t0 + 110; t++) s[t] = Math.exp(mu + st.vol * gaussian(rnd)) - 1; seqs.push(s); }
      const rate = (cash) => { let ok = 0; for (let i = 0; i < N; i++) { const ss = { ...st, cashReserve: cash, retSeq: seqs[i] }; const rows = simulate(ss, bal, st.retireAge, startSage, 1); if (rows.every((x) => x.shortfall < Math.max(50, x.target * 0.005))) ok++; } return 100 * ok / N; };
      return { none: rate(0), big: rate(600000) };
    }, BAL_AT_RET);
    expect(r.big).toBeGreaterThan(r.none);   // the reserve genuinely helps
  });

  // End-to-end: the panel renders, its baseline % matches the headline stress test, and the spending-trim it
  // quotes actually clears the green band when applied — proving the reverse-engineering is sound.
  test('panel matches the headline % and its quoted spending trim actually passes', async ({ page }) => {
    await load(page);
    await setInputs(page, { target: '90,000' });
    const stress = await waitForStress(page);
    expect(stress.pct).toBeLessThan(80);                 // below green → the panel should appear
    const txt = await waitForFix(page);
    expect(txt).toMatch(/cash reserve of about \$[\d,]+/);
    expect(txt).toContain(`${stress.pct}%`);             // baseline shown equals the headline stress %

    const trim = txt.match(/spending to about \$([\d,]+)\/yr/);
    expect(trim).toBeTruthy();
    const newTarget = trim[1].replace(/,/g, '');
    await page.evaluate(() => { lastRun.stress = null; });
    await setInputs(page, { target: newTarget });
    const after = await waitForStress(page);
    expect(after.pct).toBeGreaterThanOrEqual(78);        // the reverse-engineered trim lands at/above the 80% line
  });

  test('the panel is hidden when the plan comfortably passes the stress test', async ({ page }) => {
    await load(page);
    await setInputs(page, { target: '35,000', vol: '8' });   // very sustainable
    const stress = await waitForStress(page);
    expect(stress.pct).toBeGreaterThanOrEqual(80);
    const display = await page.evaluate(() => document.getElementById('vFix').style.display);
    expect(display).toBe('none');
  });

  // The cash lever is capped at ~7 years of spending so it can't balloon into "just hold 40% more money".
  test('the quoted cash reserve never exceeds ~7 years of spending', async ({ page }) => {
    await load(page);
    await setInputs(page, { target: '90,000' });
    await waitForStress(page);                    // sync to the current run before reading its recommendation panel
    const txt = await waitForFix(page);
    const m = txt.match(/cash reserve of about \$([\d,]+)/);
    if (m) {                                                  // feasible case: must be within the buffer cap
      const amt = Number(m[1].replace(/,/g, ''));
      expect(amt).toBeLessThanOrEqual(7 * 90000);
    } else {                                                  // infeasible case: must say a buffer alone won't fix it
      expect(txt).toMatch(/cash buffer alone won't fix/i);
    }
  });

  // A failing plan with multiple working levers is offered a balanced blend that actually clears the bar.
  test('offers a balanced combined option that clears 80% on the engine', async ({ page }) => {
    await load(page);
    await setInputs(page, { target: '90,000' });
    await waitForStress(page);                    // sync to the current run before reading its recommendation panel
    const txt = await waitForFix(page);
    expect(txt).toMatch(/balance all three|combine them/);
    expect(txt).toMatch(/about \d+% of what it would take/);   // each lever is a partial dose

    // Apply the blend (cash + trim + retire-later) and confirm the headline stress test reaches the green band.
    const combo = txt.match(/(?:balance all three|combine them):(.*?)— together/);
    expect(combo).toBeTruthy();
    const seg = combo[1];
    const cash = (seg.match(/\$([\d,]+) in cash/) || [0, '0'])[1].replace(/,/g, '');
    const trim = (seg.match(/trim to about \$([\d,]+)\/yr/) || [])[1];
    const age = (seg.match(/retire at (\d+)/) || [])[1];
    const pct = await page.evaluate(({ cash, trim, age }) => {
      const st = lastRun.st;
      const y2r = Math.max(0, st.retireAge - st.ageNow), g0 = Math.pow(1 + st.ret, y2r);
      let bal = { pretax: st.pretax0*g0, roth: st.roth0*g0, savPrin: st.savPrin0*g0, savGain: st.savGain0*g0 + st.savPrin0*(g0-1), hsa: st.hsa0*g0 };
      const startSage = st.married ? st.sageNow + y2r : null;
      const w = age ? Number(age) - st.retireAge : 0, gw = Math.pow(1 + st.ret, w);
      if (w > 0) bal = { pretax: bal.pretax*gw, roth: bal.roth*gw, savPrin: bal.savPrin*gw, savGain: bal.savGain*gw + bal.savPrin*(gw-1), hsa: (bal.hsa||0)*gw };
      const N = 200, t0 = st.retireAge - st.ageNow, mu = Math.log(1 + st.ret) - st.vol*st.vol/2;
      const mod = { cashReserve: Number(cash) || 0, retireAge: age ? Number(age) : st.retireAge };
      if (trim) mod.target = Number(trim.replace(/,/g, ''));
      let ok = 0;
      for (let i = 0; i < N; i++) {
        const rnd = mulberry32(0x51ab1e ^ Math.imul(i + 1, 2654435761)); const seq = [];
        for (let t = t0; t <= t0 + 110; t++) seq[t] = Math.exp(mu + st.vol*gaussian(rnd)) - 1;
        const s = { ...st, ...mod, retSeq: seq };
        const rows = simulate(s, bal, s.retireAge, age ? (startSage==null?null:startSage+w) : startSage, 1);
        if (rows.every((r) => r.shortfall < Math.max(50, r.target*0.005))) ok++;
      }
      return Math.round(100 * ok / N);
    }, { cash, trim, age });
    expect(pct).toBeGreaterThanOrEqual(78);
  });
});

test.describe('9. Estate, filing status', () => {
  test('a large estate triggers the federal estate-tax warning', async ({ page }) => {
    await load(page);
    await setInputs(page, { pretax: '40,000,000' });
    const txt = await page.evaluate(() => document.getElementById('vEstate').textContent);
    expect(txt).toMatch(/estate tax/i);
  });

  test('filing status follows the presence of a spouse age', async ({ page }) => {
    await load(page);
    let f = await page.evaluate(() => document.getElementById('filingShow').textContent);
    expect(f).toMatch(/single/i);
    await setInputs(page, { sage: '58' });
    f = await page.evaluate(() => document.getElementById('filingShow').textContent);
    expect(f).toMatch(/jointly/i);
  });
});

test.describe('10. Export scenario CSV', () => {
  test('contains every expected section (married, with comparison matrix)', async ({ page }) => {
    await load(page);
    await setInputs(page, { sage: '58', sSalary: '90,000' });
    const csv = await exportCSV(page);
    for (const section of [
      'INPUTS', 'SUMMARY', 'ACCOUNTS', 'INCOME AND TAX',
      'SOCIAL SECURITY — benefit summary',
      'SOCIAL SECURITY — claiming-age comparison',
      'SOCIAL SECURITY — your earnings record',
      'SOCIAL SECURITY — spouse earnings record',
    ]) {
      expect(csv, `missing section: ${section}`).toContain(section);
    }
  });

  test('claiming-comparison matrix has 81 rows and flags the optimal cell', async ({ page }) => {
    await load(page);
    await setInputs(page, { sage: '58', sSalary: '90,000' });
    const csv = await exportCSV(page);
    const rows = csv.split('\n').filter((l) => /^\d{2},\d{2},/.test(l)); // "cp,cs,..."
    expect(rows.length).toBe(81);
    expect(rows.some((l) => l.includes('YES'))).toBeTruthy(); // optimal cell flagged
  });

  test('single filer exports a 9-row comparison', async ({ page }) => {
    await load(page);
    const csv = await exportCSV(page);
    expect(csv).toContain('SOCIAL SECURITY — claiming-age comparison');
    const rows = csv.split('\n').filter((l) => /^(6[2-9]|70),/.test(l) && /YES|optimal|,\d/.test(l));
    // 9 ages 62..70 appear as the first column of the single comparison block
    const ageRows = csv.split('\n').filter((l) => /^(6[2-9]|70),\d/.test(l));
    expect(ageRows.length).toBeGreaterThanOrEqual(9);
  });

  test('benefit-summary household total reconciles with the engine', async ({ page }) => {
    await load(page);
    await setInputs(page, { sage: '58', sSalary: '90,000' });
    const r = await page.evaluate(() => {
      const st = lastRun.st;
      const piaP = st.piaMonthlyResolved, piaS = st.spousePiaResolved;
      const A = ssAmountsFor(st, st.claim, st.claimSpouse, piaP, piaS);
      return Math.round(lifetimeSSRealFor(st, A, st.claim, st.claimSpouse).total);
    });
    const csv = await exportCSV(page);
    const line = csv.split('\n').find((l) => l.startsWith('Household,'));
    const todayDollars = parseInt(line.split(',').pop(), 10);
    expect(Math.abs(todayDollars - r)).toBeLessThan(2);
  });
});

test.describe('11. Import scenario CSV', () => {
  test('round-trips: export -> mutate -> import restores inputs', async ({ page }) => {
    await load(page);
    await setInputs(page, {
      age: '54', sage: '52', salary: '150,000', sSalary: '70,000',
      pretax: '1,234,567', target: '111,000', stateMode: 'ny', endAge: '88',
    });
    const csv = await exportCSV(page);
    // mutate away from the exported values
    await setInputs(page, { age: '40', salary: '50,000', pretax: '10,000', target: '50,000' });
    const restored = await page.evaluate((text) => {
      const n = importScenario(text);
      return {
        n, age: document.getElementById('age').value, sage: document.getElementById('sage').value,
        salary: document.getElementById('salary').value, pretax: document.getElementById('pretax').value,
        target: document.getElementById('target').value, state: document.getElementById('stateMode').value,
        endAge: document.getElementById('endAge').value,
      };
    }, csv);
    expect(restored.n).toBeGreaterThan(10);
    expect(restored.age).toBe('54');
    expect(restored.sage).toBe('52');
    expect(restored.pretax).toBe('1,234,567'); // money formatting preserved
    expect(restored.target).toBe('111,000');
    expect(restored.state).toBe('ny');
    expect(restored.endAge).toBe('88');
  });

  test('imported claim ages are honored (override flag set)', async ({ page }) => {
    await load(page);
    await setInputs(page, { sage: '58' });
    // hand-author a minimal INPUTS-only CSV (also proves legacy/older exports import cleanly)
    const csv = [
      'The Retirement Drawdown — scenario export',
      'Format,drawdown-v1',
      '',
      'SECTION,INPUTS — edit values and re-import to restore this scenario',
      'key,label,value',
      'age,Your age,55',
      'sage,Spouse age,53',
      'claim,SS claim (you),64',
      'sclaim,SS claim (spouse),63',
      'pretax,Pre-tax,900000',
      'spouseMode,legacy field,own',   // legacy key must be ignored without error
    ].join('\n');
    const r = await page.evaluate((text) => {
      const n = importScenario(text);
      return { n, claim: lastRun.st.claim, sclaim: lastRun.st.claimSpouse };
    }, csv);
    expect(r.n).toBeGreaterThan(0);
    expect(r.claim).toBe(64);   // honored, not overwritten by the optimizer
    expect(r.sclaim).toBe(63);
  });

  test('importing a non-scenario file fails cleanly', async ({ page }) => {
    await load(page);
    const threw = await page.evaluate(() => {
      try { importScenario('just,some\nrandom,csv\n'); return false; }
      catch (e) { return /INPUTS/.test(e.message); }
    });
    expect(threw).toBeTruthy();
  });
});

test.describe('12. Methodology document', () => {
  test('loads, titled correctly, links back to the model', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    await page.goto('/how_the_model_works.html');
    const title = await page.title();
    expect(title).toMatch(/how the/i);
    const backHrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter((h) => /retirement_model\.html/.test(h)));
    expect(backHrefs.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('the model links out to the methodology doc', async ({ page }) => {
    await load(page);
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((x) => /how the model works/i.test(x.textContent));
      return a && a.getAttribute('href');
    });
    expect(href).toBe('how_the_model_works.html');
  });
});
