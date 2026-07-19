# CLAUDE.md — Retirement Field Guide (operating manual)

Purpose: so we can edit **parts** of the guide without re-reading everything each time.
Update the **Summary** below whenever we learn something durable — keep it short, group related learnings, newest lessons fold into existing bullets.

---

## Summary (read this first)

- **Source of truth is the HTML, not the old Markdown.** The live guide is `intro.html`, `foundations1-3.html`, `chapter1-28.html`, `putting-it-together.html`, `appendix-*.html`, `glossary.html`, `index.html`. The `.md` files (`00_index.md`, `ch01-14.md`) are **stale legacy** — ignore/don't sync them.
- **Every page shares one skeleton:** identical `<head>` (fonts + `style.css`), identical `.topbar`/`.topnav`, then `main` → `.eyebrow` → `h1` → content blocks → `.references` → `.pager`. To edit a chapter you only touch the middle. See *Chapter anatomy*.
- **Four things live in exactly one place — edit there first, then reconcile inline quotes:**
  - **2026 numbers/limits/thresholds → Appendix B** (`appendix-numbers.html`). Each row is chapter-tagged.
  - **Ages / deadlines / clocks → Appendix A** (`appendix-ages.html`).
  - **Calculator control ↔ chapter mapping → Appendix F** (`appendix-calculator.html`, Part 4). "Model it" callouts must use the exact bold control names from App F.
  - Also: tax brackets → **App C**, per-account tax treatment → **App D**, IRS life tables → **App E**, **which investment goes in which account (asset location) → App G**, term definitions → **glossary.html**.
  - ⚠️ **App D vs App G** — easy to confuse. **D** = how each *account* is taxed (contribution / growth / withdrawal / inheritance). **G** = given those accounts, which *investment* belongs in each. Placement rules, tax-drag rankings, and the step-up/inheritance overlay go in **G**; account mechanics stay in **D**. Ch 16's IOVA section is the one chapter that duplicates G's logic on purpose — keep the two consistent.
  - ⚠️ Naming note: in the original request "numbers→A, ages→B" was said, but the **files are the reverse** (A = ages, B = numbers). The mapping above is the real one — trust it.
- **Files are title-based slugs — no chapter number in the filename** (`the-4-percent-rule.html`, `sequence-of-returns-risk.html`, `purpose-people-health.html`). This is deliberate: reordering/renumbering never renames a file. The `Chapter N` designation lives **only** in the `.eyebrow`, `<title>`, `index.html` `.ch-card` `.n`, and link text. Foundations use slugs too (`how-much-to-save.html` … `compounding-and-historical-returns.html`). Intro = `intro.html`; capstone = `putting-it-together.html`.
- **Links:** chapter→chapter `href="<slug>.html"` (e.g. `href="sequence-of-returns-risk.html"`); guide→calculator `href="../retirement_model.html"`; guide→methodology `href="../how_the_model_works.html"` (guide is a subfolder of the site root).
- **30 chapters + 4 foundations + intro + capstone + 7 appendices + glossary.** Editorial "read-if-nothing-else" four: Ch 9 (inflation), 10 (healthcare), 12 (IRMAA), 19 (sequencing) — the white-space topics.
- **Ch 1–27 are financial; the capstone closes that arc; then Part V · Beyond the Money (Ch 28–30) is the non-financial coda** — purpose/health, housing & long-term care, directives/consolidation/legacy. Pager order: `chapter27 → putting-it-together → chapter28 → chapter29 → chapter30 → appendix-ages`. These three deliberately **omit the `.modelit` "Model it" block** (they don't map to calculator controls); they keep the rest of the chapter skeleton and cite external references only.
- **Part structure (after the age-based reorg):** Foundations (F1–F4) · I Accumulation (1–6) · II Decumulation (7–22) · III Early access (23–25) · IV Inheritance (26–27) · Capstone · V Beyond the Money (28–30). The old "Part IV · Risk and the Long Run" was **dissolved**: compounding/returns became **Foundations F4** (`compounding-and-historical-returns.html`, keeps its Model-it block), sequence-of-returns risk became **Ch 8** (`sequence-of-returns-risk.html`), and longevity became **Ch 22** (`longevity-risk.html`) — so Part II now houses all four decumulation risks (sequence, inflation, healthcare, longevity).

---

## File map

| File | # | Title | Part |
|---|---|---|---|
| `intro.html` | 0 | Retirement Is Three Problems, Not One | Start here |
| `how-much-to-save.html` | F1 | How Much to Save — and the Discipline | Foundations |
| `paying-off-the-mortgage.html` | F2 | Should You Pay Off the Mortgage? | Foundations |
| `where-to-invest.html` | F3 | Where to Invest: Diversification, Cost, Time | Foundations |
| `compounding-and-historical-returns.html` | F4 | The Power of Compounding & Historical Returns | Foundations |
| `employer-plans-401k.html` | 1 | Employer Plans: 401(k) & Cousins | I · Accumulation |
| `iras.html` | 2 | IRAs: Traditional & Spousal | I |
| `roth-accounts.html` | 3 | Roth Accounts & the Backdoor | I |
| `hsa.html` | 4 | The HSA | I |
| `social-security-basics.html` | 5 | Social Security Basics (credits, PIA, FRA, spousal 50%) | I |
| `personal-savings.html` | 6 | Personal Savings: Taxable, Treasuries, Inflation Bonds | I |
| `the-4-percent-rule.html` | 7 | The 4% Rule & How to Execute It | II · Decumulation |
| `sequence-of-returns-risk.html` | 8 | Sequence-of-Returns Risk & How to Blunt It | II |
| `inflation.html` | 9 | Inflation | II |
| `healthcare-costs.html` | 10 | Healthcare Costs & Inflation | II |
| `tax-optimization.html` | 11 | Tax Optimization in Retirement | II |
| `irmaa.html` | 12 | IRMAA: The Medicare Surcharge Cliff | II |
| `roth-conversions.html` | 13 | Roth Conversions | II |
| `claiming-social-security.html` | 14 | When to Claim Social Security | II |
| `pensions.html` | 15 | Pensions | II |
| `annuities.html` | 16 | Annuities (SPIAs, QLACs) | II |
| `home-equity.html` | 17 | Home Equity as Retirement Income (HECM) | II |
| `working-in-retirement.html` | 18 | Working in Retirement | II |
| `withdrawal-sequencing.html` | 19 | Withdrawal Sequencing Across Account Types | II |
| `rmds-and-secure-2.html` | 20 | RMDs & SECURE 2.0 | II |
| `state-taxes.html` | 21 | State Taxes on Retirement Income | II |
| `longevity-risk.html` | 22 | Longevity Risk & the Retiree Inflation Gap | II |
| `rule-72t-sepp.html` | 23 | Rule of 72(t) / SEPP | III · Early access |
| `rule-of-55.html` | 24 | The Rule of 55 | III |
| `health-insurance-before-medicare.html` | 25 | Health Insurance Before Medicare (ACA bridge) | III |
| `estate-taxes.html` | 26 | Estate Taxes & Per-Account Treatment | IV · Inheritance |
| `passing-assets.html` | 27 | Passing Assets: Beneficiaries, TOD, Probate | IV |
| `putting-it-together.html` | ✦ | Capstone synthesis | Capstone |
| `purpose-people-health.html` | 28 | Purpose, People, and Health (retirement philosophy) | V · Beyond the Money |
| `where-youll-live.html` | 29 | Where You'll Live: Aging in Place, Downsizing, CCRCs | V |
| `handing-over-the-reins.html` | 30 | Handing Over the Reins: Directives, Simplification, Legacy | V |
| `appendix-ages.html` | A | Key Ages & Deadlines | Reference |
| `appendix-numbers.html` | B | Key Numbers (2026) | Reference |
| `appendix-tax-tables.html` | C | Federal Tax Tables (2026) | Reference |
| `appendix-tax-treatment.html` | D | Tax Treatment by Account Type | Reference |
| `appendix-life-tables.html` | E | Life Expectancy Tables (RMDs/SEPP) | Reference |
| `appendix-calculator.html` | F | Using the Calculator | Reference |
| `appendix-asset-location.html` | G | Asset Location: What Goes in Which Account | Reference |
| `glossary.html` | § | Glossary & keyword index | Reference |
| `index.html` | — | Table of contents (part sections + `.ch-card`s) | — |
| `style.css` | — | All styling (single stylesheet) | — |

Site-root files referenced from the guide: `../retirement_model.html` (the calculator), `../how_the_model_works.html` (methodology/FAQ).

---

## Chapter anatomy (block order + CSS class)

Every chapter body follows this exact order. Edit the block you need; leave the rest.

1. `<p class="eyebrow">Part II · Retirement Income — Decumulation · Chapter 7</p>` — part/phase/number.
2. `<h1>` — chapter title (matches the file map).
3. `<aside class="summary"><h2>Summary</h2><ul>…</ul></aside>` — 4-6 bullets. (Appendices use `<h2>The idea</h2>`.) Cross-refs to other chapters go in a `<p class="xref">` inside, or inline `<a href="chapterNN.html">`.
4. `<article>` — the **Details**. Paragraphs lead with `<p><strong>Bolded lead-in.</strong> …</p>`. Contains at least one **worked example** `<div class="example">` (label + `<h3>` + table with right-aligned `td.n` numbers + a `<p class="ex-total">` takeaway). Foundations chapters instead use `<div class="mythfact">` (myth/fact cards).
5. `<section class="actions"><h2>Key action items</h2><ul>…</ul></section>` — each `<li><strong>Imperative verb…</strong> one-line why/how.</li>`. **Keep these genuinely actionable** — a verb the reader can do, not a restatement of the summary.
6. `<aside class="modelit"><h2>Model it in the calculator</h2>…</aside>` — **must tie to the calculator.** Three-part pattern: intro `<p>` → `<p><b>Try this —</b> …</p>` (name exact controls) → `<p><b>Look for —</b> …</p>` (name exact output tiles) → `<p class="tool-link"><a href="../retirement_model.html" target="_blank" rel="noopener">Open the calculator &rarr;</a></p>`. Control/tile names must match Appendix F.
7. `<section class="references"><h2>References &amp; sources</h2><ol>…</ol></section>` — external links, all `target="_blank" rel="noopener"`.
8. `<nav class="pager">` — `.prev` and `.next` with `.dir` + `.ttl`; titles must match the neighbor chapters.

`<head>` conventions: `<title>Ch N. Title — Retirement</title>`; `<meta name="description">` = the same one-liner used in that chapter's `.ch-card .d` on `index.html` (keep them in sync).

---

## CSS vocabulary (semantic blocks in `style.css`)

- `.summary` (green tint) — summary aside; `.xref` = cross-ref line inside it.
- `.actions` (paper) — action list, renders ✓ bullets automatically.
- `.modelit` (brass tint) — calculator callout; `.tool-link` = the "Open the calculator" line.
- `.example` (white, green left-border) — worked example; `.ex-label`, `.ex-total`, `td.n`/`th.n` (right-align), `.step`/`.num` (stepped calcs), `tfoot` totals row.
- `.mythfact` → `.mf .myth` / `.mf .fact` — myth/fact cards (foundations).
- `.formula` (blue tint) — `.frow`, `.ftot`, `.fnote`; `.calc-chain` (`.arw`) = inline mono calc chain.
- `.mono` — tabular-numeral monospace; wrap any dollar figure/threshold in it.
- `.tablewrap` — **always wrap `<table>` in this** (horizontal scroll on mobile).
- `.ages` — Appendix A table (`.sub`, `.ms` milestone, `.dt`, `.do` = "→ do this", `.ref`, `tr.flag` = highlighted).
- `.terms`/`.gitem`/`.glossary-list`/`.jump`/`.galpha` — glossary.
- `.part`/`.chapter-list`/`.ch-card` (`.n`/`.t`/`.d`) — `index.html` table of contents.

---

## Common edit playbooks

**Change a 2026 number (limit/threshold):**
1. Edit the row in `appendix-numbers.html` (App B).
2. `grep` the old figure across `chapter*.html` + `foundations*.html` for inline quotes; update each.
3. Re-check any `.example` worked calc that *computes on* the number (totals, percentages).

**Change an age/deadline:** edit `appendix-ages.html` (App A) first, then grep chapters for inline mentions.

**Edit action items:** stay inside `<section class="actions">`; keep `<li><strong>Verb…</strong> why.</li>`; every item must be something the reader *does*.

**Edit "Model it":** keep the Try this / Look for structure; every bold control name must exist in Appendix F Part 1/3 (e.g. **Target annual income**, **Advanced › Withdrawal strategy › Plain rule**, **Plan withdrawal rate**, **Return volatility**, **Sustainable income / yr**, **success rate**). If you add/rename a calculator control, update App F too. The section is **not mandatory** — a chapter earns a Model-it block only if the calculator genuinely models the topic. Chapters that intentionally **omit** it: the non-financial coda (28–30) and **home-equity (Ch 17)** — the calculator doesn't model the house / reverse mortgages, so a forced block was removed in the Model-it audit. Don't re-add one there.

**Add a new chapter:**
1. Copy the nearest existing chapter as a template; update eyebrow, `h1`, `<title>`, meta description.
2. Fix `.pager` on the new file **and** on both neighbor files.
3. Add a `.ch-card` under the right `.part` in `index.html` (description = meta description).
4. If it introduces numbers/ages/controls, add rows to App B / App A / App F; add any new terms to `glossary.html`.

**Renumbering ripple:** chapter numbers appear in — the `.eyebrow`, `<title>`, `.pager` of neighbors, `index.html` `.ch-card` `.n`, prose "Chapter N" cross-refs, and the chapter-tag columns of App B / App F cross-ref tables. **Filenames are stable slugs and do NOT change when you renumber** — update the number-bearing spots, not the files.

---

## Conventions & guardrails

- **2026 plan-year** figures throughout; every page ends with the standard `.disclaimer` (educational, reconfirm current-year numbers, not personalized advice). Keep it when editing.
- Numbers are US-formatted with `.mono`; tables always inside `.tablewrap`.
- External links: `target="_blank" rel="noopener"`. Internal links: relative, no protocol.
- Tone: second person, plain-language, one worked example per chapter minimum.
- Don't edit the legacy `.md` files or `files.zip` — HTML is canonical.
