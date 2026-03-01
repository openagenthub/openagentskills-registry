# Open Agent Skills Registry -- Specification

> Source of truth for all agent skill metadata. PR-based, YAML in git, dynamic data in Cloudflare KV.

## Big Picture

**Open Agent Skills** is a community-driven directory for discovering and installing agent skills across AI assistants. The system consists of three repositories:

| Repo | Purpose | Status |
|------|---------|--------|
| **openagentskills-registry** (this) | Skill YAML pointers, validation worker, registry API | Primary focus |
| openagentskills-web | Discovery website at openagentskills.org | Consumes registry API |
| openagentskills-cli | `openskills` CLI tool (Go) | Future |

### How It Works

```
Contributor submits PR (skill.yaml)
        |
        v
+-------------------------------+
|  GitHub Action: validate-pr   |
|  - Detects changed files only |
|  - Calls Worker (persist=off) |
|  - Worker fetches SKILL.md    |
|  - Validates schema + content |
+-------------------------------+
        |
        v
Maintainer reviews & merges
        |
        v
+-------------------------------+
|  GitHub Action: sync-registry |
|  - Calls Worker (persist=on)  |
|  - Worker writes to KV        |
|  - Syncs categories           |
|  - Rebuilds manifest          |
|  - Triggers web repo rebuild  |
+-------------------------------+
        |
        v
Website + CLI consume GET /api/skills
```

### Key Design Decisions

1. **YAML files are static** -- skill.yaml files contain only source pointers, categories, and tags. No dynamic metadata (`_meta`) is stored in the repo.
2. **Dynamic data lives in Cloudflare KV** -- name, description, license, lastValidated, lastCommit, contentHash, status are stored in KV and served via the worker API.
3. **No auto-commits** -- GitHub Actions never commit back to the repo. The git history stays clean and contributor-friendly.
4. **Path = CLI identifier** -- `skills/anthropics/skills/pdf/skill.yaml` maps to CLI: `openskills install anthropics/skills/pdf`
5. **Internal skills split** -- `skills/openagentskills/{name}/skill.yaml` is the pointer, `openagentskills/{name}/SKILL.md` is the implementation.

---

## Directory Structure

```
openagentskills-registry/
|
+-- skills/                            # All skill.yaml pointers
|   +-- anthropics/skills/
|   |   +-- pdf/skill.yaml            # External skill
|   |   +-- docx/skill.yaml
|   +-- vercel-labs/agent-skills/
|   |   +-- web-design-guidelines/skill.yaml
|   +-- openagentskills/               # Internal skill pointers
|       +-- frontend-design/skill.yaml
|       +-- git-workflow/skill.yaml
|
+-- openagentskills/                   # Internal skill implementations
|   +-- frontend-design/SKILL.md
|   +-- git-workflow/SKILL.md
|
+-- schemas/
|   +-- skill.schema.json
|
+-- worker/                            # Cloudflare Worker
|   +-- src/
|   |   +-- index.ts                  # Hono app, all endpoints
|   |   +-- validate.ts               # YAML schema validation
|   |   +-- kv.ts                     # KV read/write utilities
|   |   +-- github.ts                 # GitHub API helpers
|   |   +-- frontmatter.ts            # SKILL.md frontmatter parser
|   |   +-- utils.ts                  # Hash, path parsing, delay
|   |   +-- types.ts                  # Shared type definitions
|   +-- wrangler.toml
|   +-- package.json
|
+-- scripts/
|   +-- validate-changed.ts           # PR validation (persist=false)
|   +-- sync-registry.ts              # Post-merge + daily sync (persist=true)
|   +-- call-worker.ts                # Manual CLI utility
|
+-- .github/workflows/
|   +-- validate-pr.yaml
|   +-- sync-registry.yaml
|   +-- daily-validation.yaml
|   +-- release.yaml
|
+-- categories.yaml
+-- package.json
+-- README.md
```

---

## Skill Path Convention

```
{org}/{repo}/{skill-name}/skill.yaml          (in skills/ directory)
+----------+-----------+
           |
     CLI: openskills install anthropics/skills/pdf
     URL: openagentskills.org/anthropics/skills/pdf
```

The `skills/` directory prefix is stripped for URLs and CLI paths.

| Type | Registry Path | Points To |
|------|---------------|-----------|
| External | `skills/anthropics/skills/pdf/skill.yaml` | `github.com/anthropics/skills` at path `skills/pdf` |
| Internal | `skills/openagentskills/frontend-design/skill.yaml` | `openagentskills/frontend-design/SKILL.md` |

---

## Skill YAML Schema

YAML files are minimal and static. Dynamic fields are stored in Cloudflare KV.

### External Skill

```yaml
# skills/anthropics/skills/pdf/skill.yaml

source:
  type: external
  url: https://github.com/anthropics/skills
  path: skills/pdf
  ref: main

categories:
  - documents

tags:
  - pdf
  - extraction
  - forms
```

### Internal Skill

```yaml
# skills/openagentskills/frontend-design/skill.yaml

source:
  type: internal

categories:
  - development
  - creativity

tags:
  - frontend
  - ui
  - tailwind
```

### JSON Schema

See [schemas/skill.schema.json](schemas/skill.schema.json) for the full schema. Key rules:

- `source.type`: `"external"` or `"internal"`
- `source.url`: required for external (must be `https://github.com/{org}/{repo}`)
- `source.path`: required for external (path to SKILL.md directory in the source repo)
- `source.ref`: optional, defaults to `"main"`
- `categories`: 1-3 items from the canonical list in `categories.yaml`
- `tags`: 1-5 kebab-case strings, max 30 chars each
- No `_meta` or `additionalProperties` allowed

---

## Cloudflare KV Data Model

All dynamic metadata is stored in Cloudflare KV, not in git.

### KV Key Layout

| Key Pattern | Value Type | Description |
|-------------|-----------|-------------|
| `skill:{path}` | `SkillEntry` | One per skill (e.g. `skill:anthropics/skills/pdf`) |
| `registry:manifest` | `RegistryManifest` | Pre-built full list for GET /api/skills |
| `registry:categories` | `CategoryEntry[]` | Category definitions with counts |

### SkillEntry (stored per skill)

```json
{
  "id": "anthropics/skills/pdf",
  "path": "anthropics/skills/pdf",
  "name": "pdf",
  "description": "Extract text and tables from PDF files...",
  "categories": ["documents"],
  "tags": ["pdf", "extraction", "forms"],
  "source": {
    "type": "external",
    "url": "https://github.com/anthropics/skills",
    "org": "anthropics",
    "repo": "skills",
    "path": "skills/pdf",
    "ref": "main"
  },
  "license": "Apache-2.0",
  "repoUrl": "https://github.com/anthropics/skills",
  "lastCommit": "2026-01-20T10:30:00Z",
  "lastValidated": "2026-02-28T06:00:00Z",
  "contentHash": "sha256:abc123...",
  "status": "active"
}
```

### RegistryManifest (pre-built)

```json
{
  "version": "2.0.0",
  "generatedAt": "2026-02-28T10:30:00Z",
  "totalSkills": 9,
  "categories": [
    { "id": "development", "name": "Development", "description": "...", "icon": "code", "count": 7 }
  ],
  "skills": [ /* array of SkillEntry */ ]
}
```

---

## Worker API Endpoints

| Method | Endpoint | Purpose | Used By |
|--------|----------|---------|---------|
| GET | `/api/skills` | Full registry manifest from KV | Website, CLI |
| GET | `/api/skills/:path` | Single skill entry from KV | Website, CLI |
| GET | `/api/categories` | Category definitions from KV | Website, CLI |
| POST | `/api/validate` | Validate single skill; optionally persist to KV | PR workflow, post-merge |
| POST | `/api/validate-batch` | Validate multiple skills; optionally persist | Daily cron, post-merge |
| POST | `/api/categories` | Sync categories.yaml to KV | Post-merge workflow |
| POST | `/api/rebuild-manifest` | Rebuild manifest from all KV entries | Post-merge workflow |

### Persist Flag

POST endpoints accept `persist: boolean` in the request body:
- `persist: false` (default) -- validate only, return result (used in PR checks)
- `persist: true` -- validate AND write result to KV (used post-merge and daily)

---

## GitHub Actions

### Validation Scopes

| Trigger | Skills Validated | Persist | Purpose |
|---------|------------------|---------|---------|
| PR | Only changed files | No | Fast feedback |
| Merge to main | Changed files | Yes | Update KV |
| Daily cron | ALL skills | Yes | Detect broken links |

### Workflow Files

- **validate-pr.yaml** -- Runs on PR, validates changed skills (persist=false)
- **sync-registry.yaml** -- Runs on push to main, syncs changed skills to KV (persist=true)
- **daily-validation.yaml** -- Runs at 6 AM UTC, validates all skills, creates issue for broken ones
- **release.yaml** -- Release Please for versioning

---

## Relationship with Web Repo

The web repo (`openagentskills-web`) consumes this registry:

1. Calls `GET /api/skills` at build time for the full manifest
2. Listens for `repository_dispatch` events to trigger rebuilds
3. Loads GitHub stars dynamically (not stored here)
4. Can watch the `skills/` directory for changes via GitHub webhooks

---

## Setup Checklist

- [ ] Create repo at `openagenthub/openagentskills-registry`
- [ ] Deploy Cloudflare Worker (`cd worker && wrangler deploy`)
- [ ] Create KV namespace (`wrangler kv namespace create SKILLS_KV`)
- [ ] Set secrets: `GITHUB_TOKEN` (wrangler), `VALIDATION_WORKER_URL`, `CROSS_REPO_PAT` (GitHub)
- [ ] Set up commitlint + husky (`npm install && npm run prepare`)
- [ ] Run initial full sync (`WORKER_URL=... npm run sync-registry`)
