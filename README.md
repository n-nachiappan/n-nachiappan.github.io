# The Retirement Drawdown

An interactive, single-file retirement drawdown planner. The published site is two static HTML files:

- **`retirement_model.html`** — the planner (all logic is inline; no build step).
- **`how_the_model_works.html`** — the methodology document.

This is published as a **GitHub user site** at the repo `n-nachiappan.github.io`, so it serves from the domain
root and the shared link stays **https://n-nachiappan.github.io/retirement_model.html**.

A [Playwright](https://playwright.dev) test suite validates the model in a real browser, and GitHub Actions
**deploys to GitHub Pages only when the tests pass**, so a regression can't reach the live page. The deploy
republishes the whole repo (minus the dev tooling), so any other files you keep on the user site are preserved.

## Run locally

```bash
npm install
npx playwright install chromium   # one-time: download the test browser
npm test                          # run the validation suite (headless)

npm run serve                     # serve the site at http://localhost:8080
npm run test:headed               # watch the tests run in a browser
npm run report                    # open the last HTML test report
```

The tests load the **actual** `retirement_model.html` through a local static server and drive it the way a user
would — so what's tested is exactly what's deployed. There is no second copy of the model logic to drift.

## What the tests cover (`tests/model.spec.js`, 37 cases)

| Area | Checks |
|------|--------|
| Boot & rendering | loads with no uncaught errors; survives a battery of input changes |
| SS benefit math | claim adjustments (62/67/70); optimizer objective == simulation, to the dollar; PIA is invariant to the inflation input and rises with real wage growth |
| Readiness verdict | the "sustainable income" actually lasts, and 5% above it fails (4 scenarios) |
| Future retirement | required nest egg sustains; the savings figure compounds to the gap |
| Optimal claiming | optimizer pick == brute-force argmax (single & the 9×9 married grid); life-expectancy boundaries |
| Deemed filing | early-claiming spouse is permanently reduced (own + excess, not a fresh 50%); symmetric; survivor benefit |
| Tax optimization | chosen combo == true argmin after the shortfall guard; banner total == actual plan footprint |
| IRMAA | working-salary MAGI seeds the first two Medicare years; 60-yr-old regression unchanged |
| Volatility stress | deterministic (seeded); higher vol lowers success; lognormal calibration; vol=0 disables |
| Estate / filing | estate-tax warning fires; filing status follows the spouse age |
| **Export CSV** | every section present; 81-row (married) / 9-row (single) claiming matrix; totals reconcile |
| **Import CSV** | export→mutate→import restores inputs; legacy files import; bad files fail cleanly |
| Methodology doc | loads; cross-links resolve both directions |

## CI / deployment

See `.github/workflows/deploy.yml`. Push to `main` → the `test` job runs the suite → the `deploy` job
(`needs: test`) publishes to GitHub Pages **only on success**. See `DEPLOY_SETUP.md` for the one-time setup.
