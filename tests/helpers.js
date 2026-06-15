// Shared helpers. NOTE: this file is intentionally NOT named *.spec.js so Playwright doesn't run it as a test.
// The model's functions live in the page's global scope, so page.evaluate() can call them by bare name
// (run, lastRun, simulate, optimizeClaiming, ssAmountsFor, computePIA, WAGES, exportScenario, importScenario, ...).

async function load(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto('/retirement_model.html');
  // run() executes at the end of the script and sets lastRun; wait for that to be true.
  await page.waitForFunction(() => typeof run === 'function' && typeof lastRun !== 'undefined' && lastRun);
  return errors;
}

// Set one or more inputs by element id and fire the 'input' event (which triggers run() synchronously).
async function setInputs(page, obj) {
  await page.evaluate((obj) => {
    for (const [id, v] of Object.entries(obj)) {
      const el = document.getElementById(id);
      if (!el) throw new Error('no input #' + id);
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, obj);
}

// Capture the scenario CSV without triggering a browser download.
async function exportCSV(page) {
  return page.evaluate(() => {
    let captured = null;
    const orig = dlText;
    dlText = (_name, text) => { captured = text; };
    try { exportScenario(); } finally { dlText = orig; }
    return captured;
  });
}

// The starting balances run() feeds the simulation (current balances grown to the retirement age).
const BAL_AT_RET = `(() => {
  const st = lastRun.st;
  const N = Math.max(0, st.retireAge - st.ageNow), g = Math.pow(1 + st.ret, N);
  return { bal: { pretax: st.pretax0*g, roth: st.roth0*g, savPrin: st.savPrin0*g,
                  savGain: st.savGain0*g + st.savPrin0*(g-1), hsa: st.hsa0*g },
           startSage: st.married ? st.sageNow + N : null };
})()`;

// Wait until the (async, batched) volatility stress test has finished for the current run.
async function waitForStress(page) {
  await page.waitForFunction(() => lastRun && lastRun.stress, null, { timeout: 15_000 });
  return page.evaluate(() => lastRun.stress);
}

// Wait until the "how to pass the stress test" recommendation panel has rendered (it runs after the stress test,
// in async chunks). Resolves with its innerText. Only appears when stress success is below the green band.
async function waitForFix(page) {
  // The full lever breakdown is collapsed (display:none), so read textContent — which includes hidden text —
  // and key off a phrase that only appears in the final render, not the "reverse-engineering…" placeholder.
  await page.waitForFunction(() => {
    const f = document.getElementById('vFix');
    return f && f.style.display !== 'none' && /smallest single move/.test(f.textContent);
  }, null, { timeout: 25_000 });
  return page.evaluate(() => document.getElementById('vFix').textContent);
}

module.exports = { load, setInputs, exportCSV, waitForStress, waitForFix, BAL_AT_RET };
