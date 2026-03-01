# Deployment Guide (Cloudflare + GitHub Actions)

This guide helps you set up deployment for this project from scratch.

Goal:
- Auto-deploy worker changes to **dev** after merge
- Require approval before deploy to **prod**
- Do everything through **GitHub Actions / Cloudflare dashboard** (no local deploy needed)

---

## 1) What You Will Set Up

By the end, you will have:

1. Cloudflare Worker environments:
   - `dev` (from `worker/wrangler.toml`)
   - `prod` (default env)
2. Cloudflare KV namespaces:
   - one for prod
   - one for dev
3. GitHub Actions deployment pipeline:
   - `.github/workflows/deploy-worker.yaml`
4. GitHub Environments:
   - `dev` (auto)
   - `prod` (approval required)

---

## 2) Prerequisites

Before starting, make sure you have:

- A Cloudflare account
- Admin access to this GitHub repository
- A GitHub Personal Access Token (PAT) for the worker runtime (for GitHub API reads)

---

## 3) Create Cloudflare API Token (for GitHub Actions deploy)

1. Open Cloudflare dashboard.
2. Go to **My Profile -> API Tokens -> Create Token**.
3. Use template **Edit Cloudflare Workers** (or custom with equivalent permissions).
4. Restrict token to your account.
5. Copy the token value.

You will save this token in GitHub as `CLOUDFLARE_API_TOKEN`.

---

## 4) Get Cloudflare Account ID

1. In Cloudflare dashboard, open your account home.
2. Copy **Account ID** from the right sidebar.

You will save this value in GitHub as `CLOUDFLARE_ACCOUNT_ID`.

---

## 5) Create KV Namespaces in Cloudflare

Create two KV namespaces from Cloudflare dashboard:

1. Go to **Workers & Pages -> KV**.
2. Create namespace: `openagentskills-registry-prod`
3. Create namespace: `openagentskills-registry-dev`
4. Copy both namespace IDs.

Now update `worker/wrangler.toml`:

- Put prod namespace ID in:
  - `[[kv_namespaces]] -> id`
- Put dev namespace ID in:
  - `[[env.dev.kv_namespaces]] -> id`

Commit this change to the repo.

---

## 6) Add GitHub Repository Secrets

Go to **GitHub repo -> Settings -> Secrets and variables -> Actions** and add:

### Required for deployment
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Required for worker runtime logic
- `WORKER_GITHUB_TOKEN` (PAT used by worker to read GitHub content)

Notes:
- `WORKER_GITHUB_TOKEN` should have at least read access to repositories your skills point to.
- If your source repos are private, token needs access to those private repos too.

---

## 7) Add Worker Runtime Secret in Cloudflare

Your worker code expects a secret named `GITHUB_TOKEN` at runtime.

You have two options:

### Option A (recommended): set via GitHub Actions deploy workflow
Use `WORKER_GITHUB_TOKEN` GitHub secret and map it during deployment.

### Option B: set in Cloudflare dashboard manually
1. After first deploy, open Worker in Cloudflare dashboard.
2. Go to **Settings -> Variables and Secrets**.
3. Add secret:
   - Name: `GITHUB_TOKEN`
   - Value: your PAT
4. Add for both prod and dev environments.

If you choose Option B, re-deploy once after adding the secret.

---

## 8) Configure GitHub Environments (Approval Gate)

Go to **GitHub repo -> Settings -> Environments**:

1. Create environment: `dev`
   - No required reviewers
2. Create environment: `prod`
   - Add required reviewers (you/team)
   - This becomes the manual approval step before prod deploy

The workflow file already uses these environment names.

---

## 9) Confirm Deployment Workflow

This repo uses:
- `.github/workflows/deploy-worker.yaml`

How it works:
1. On push to `main` (worker-related files), run tests/typecheck.
2. Deploy to dev (`deploy --env dev`).
3. Wait for prod approval.
4. Deploy to prod (`deploy`).

No local deploy command is required.

---

## 10) First Deployment (Recommended Test Flow)

1. Create a small test change in `worker/src/` (for example, a comment).
2. Open PR and merge to `main`.
3. Open **Actions** tab and watch `Deploy Worker` workflow:
   - `Verify Worker` should pass
   - `Deploy to Dev Worker` should pass
   - `Deploy to Prod Worker` should wait for approval
4. Approve prod deployment in GitHub UI.
5. Confirm prod deploy passes.

---

## 11) Verify Worker Is Running

After deploy:

1. Open worker URL and check health endpoint:
   - `GET /`
2. Check registry API:
   - `GET /api/skills`
   - `GET /api/categories`

Expected:
- JSON response
- No missing-secret errors

---

## 12) Common Problems and Fixes

### Error: missing account ID
- Check `CLOUDFLARE_ACCOUNT_ID` GitHub secret value.

### Error: authentication failed during deploy
- Check `CLOUDFLARE_API_TOKEN` permissions and token validity.

### Worker errors when validating external skills
- `GITHUB_TOKEN` runtime secret is missing or invalid.
- Add/update the worker runtime secret and redeploy.

### Dev deploy works, prod is stuck
- This is expected if `prod` environment requires reviewers.
- Approve in GitHub Environments UI.

### KV read/write failures
- Namespace IDs in `worker/wrangler.toml` are wrong or empty.
- Re-check both prod and dev IDs.

---

## 13) Optional Hardening

After basic setup, you can add:

- Branch protection for `main` (required checks)
- Restrict who can approve `prod` environment
- Slack/Discord notifications on deploy failures
- Separate API tokens for dev/prod with least privilege

---

## 14) Quick Checklist

- [ ] KV namespaces created (prod + dev)
- [ ] `worker/wrangler.toml` IDs filled
- [ ] GitHub secrets added (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `WORKER_GITHUB_TOKEN`)
- [ ] Cloudflare worker runtime secret `GITHUB_TOKEN` configured
- [ ] GitHub environments created (`dev`, `prod`)
- [ ] Prod reviewers configured
- [ ] Test merge completed and both dev/prod deploy steps verified

