# One-time setup: test-gated deployment for your user site

Your page is live at **https://n-nachiappan.github.io/retirement_model.html** — a **GitHub user site**, which is
served from the root of the repository named exactly **`n-nachiappan.github.io`**. The goal: every push runs the
tests, and the site is **republished only if they pass**, while the shared URL stays exactly the same.

> **Key fact:** a GitHub Actions Pages deploy replaces the *entire* user site with what it publishes. This workflow
> therefore republishes your **whole repo** (minus the dev/test tooling), so your model files update **and any other
> pages/assets on your user site are preserved**. Before switching the Pages source (step 3), make sure everything
> currently on your site is committed in this repo.

## 1. Add these files to your existing `n-nachiappan.github.io` repo

Copy the contents of this folder into a clone of your user-site repo, **replacing** the old `retirement_model.html`
with this newer one (and adding `how_the_model_works.html`):

```
retirement_model.html          # replaces your current one (this is the up-to-date version)
how_the_model_works.html
tests/  scripts/  playwright.config.js  package.json  package-lock.json
.github/workflows/deploy.yml
.gitignore  README.md  DEPLOY_SETUP.md
```

Do **not** delete or overwrite anything else already in the repo (a homepage `index.html`, other pages, images,
CSS) — those keep getting served. `node_modules/` is git-ignored.

```bash
git add .
git commit -m "Up-to-date model + Playwright tests + test-gated deploy"
git push origin main      # use 'master' here if that's your repo's default branch
```

## 2. (If your repo doesn't exist yet) create it with the exact name

The repo **must** be named `n-nachiappan.github.io` for the root URL to work:

```bash
git init && git add . && git commit -m "Retirement Drawdown + CI"
git branch -M main
git remote add origin https://github.com/n-nachiappan/n-nachiappan.github.io.git
git push -u origin main
```

## 3. Switch Pages to the GitHub Actions source  ← the important one

GitHub repo → **Settings → Pages → Build and deployment → Source → "GitHub Actions"**.

- If it's currently "Deploy from a branch", change it. While that's selected, GitHub republishes on every push
  **regardless of tests** — exactly the regression risk you're removing.
- This affects how the whole user site deploys, which is why step 1's "commit everything first" matters.

## 4. Push and watch it gate

- **Actions** tab → the **Validate model** job runs first.
- **Deploy to GitHub Pages** has `needs: test`, so it only runs if the tests pass. If any test fails, deployment is
  **skipped** and the live page keeps serving the last good version.
- On success, https://n-nachiappan.github.io/retirement_model.html is updated in place.

## 5. (Recommended) Require the tests before merging to main

Settings → **Branches → Add ruleset** (or "Branch protection rule") for `main`:
- Require a pull request before merging.
- **Require status checks to pass** → select **Validate model**.

Now a regression can't reach `main` (and therefore can't be deployed) without passing the suite. The workflow
already runs on `pull_request`, so the check shows up automatically.

## Notes

- **Root URL (`/`).** This setup does **not** ship an `index.html`, so your user-site root is left untouched —
  whatever you serve there (a homepage, or nothing) is unaffected. If you'd like `https://n-nachiappan.github.io/`
  to redirect to the planner, add a file named `index.html` containing:
  ```html
  <!doctype html><meta http-equiv="refresh" content="0; url=retirement_model.html">
  ```
  and commit it — the workflow will publish it like any other repo file.
- **Default branch.** The workflow deploys on push to `main`. If your repo uses `master`, change `main` → `master`
  in `.github/workflows/deploy.yml` (the `on.push.branches` and the deploy job's `if:`).
- **Jekyll.** The workflow adds a `.nojekyll` marker so files are served verbatim (no Jekyll processing) — relevant
  only if you have files/folders beginning with an underscore.
- **Installs.** CI uses `npm ci` from the committed `package-lock.json`. If you change dependencies, run
  `npm install` locally and commit the updated lockfile.
