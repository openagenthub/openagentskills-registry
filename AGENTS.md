# openagentskills-registry

## Project Overview

A PR-based skill registry for AI agents. YAML files in git define what skills exist; dynamic metadata lives in Cloudflare KV.

**Key files:**
- `skills/{org}/{repo}/**/skill.yaml` - External skill YAML pointers
- `skills/openagentskills/**/skill.yaml` - Internal skill YAML pointers
- `openagentskills/**/SKILL.md` - Internal skill implementations
- `worker/` - Cloudflare Worker (validation + registry API + KV storage)

## Tech Stack

| Purpose | Technology |
|---------|------------|
| Runtime | Node.js 20 |
| Package Manager | npm |
| YAML Parsing | yaml |
| Worker Framework | Hono |
| Worker Runtime | Cloudflare Workers |
| Metadata Store | Cloudflare KV |
| Testing | Vitest |
| Commit Linting | commitlint + husky + GitHub Actions |

## Project Structure

```
openagentskills-registry/
├── skills/                        # ALL skill.yaml files (YAML only, no SKILL.md)
│   ├── anthropics/skills/         # External skills from Anthropic
│   ├── vercel-labs/agent-skills/  # External skills from Vercel Labs
│   ├── supabase/agent-skills/     # External skills from Supabase
│   ├── expo/skills/               # External skills from Expo
│   └── openagentskills/           # Internal skill YAML pointers
├── openagentskills/               # Internal skill implementations ONLY
│   └── {skill-name}/
│       ├── SKILL.md               # Required: Skill content
│       └── ...                    # Optional: Additional skill files
├── worker/                        # Cloudflare Worker (validation + API)
│   └── src/
│       ├── index.ts               # Hono app, all endpoints
│       ├── validate.ts            # YAML schema validation
│       ├── kv.ts                  # KV read/write utilities
│       ├── github.ts              # GitHub API helpers
│       ├── frontmatter.ts         # SKILL.md frontmatter parser
│       ├── utils.ts               # Hash, path parsing, delay
│       └── types.ts               # Shared type definitions
├── scripts/                       # CI/CD scripts
│   ├── validate-changed.ts        # PR validation (persist=false)
│   ├── sync-registry.ts           # Post-merge + daily sync (persist=true)
│   └── call-worker.ts             # Manual CLI utility
├── schemas/                       # JSON Schema for validation
└── .github/workflows/             # GitHub Actions
```

## STRICT Directory Rules

### `skills/` Directory
- **ONLY** contains `skill.yaml` files
- **NEVER** put SKILL.md or any skill content here
- Structure mirrors the URL path (minus the `skills/` prefix)
- Example: `skills/expo/skills/app-design/skill.yaml` -> URL: `/expo/skills/app-design`

### `openagentskills/` Directory (at root)
- **ONLY** contains internal skill implementations
- **NEVER** put skill.yaml files here (those go in `skills/openagentskills/`)
- Each skill follows [agentskills.io specification](https://agentskills.io/specification)
- Structure: `openagentskills/{skill-name}/SKILL.md`

### URL Path Convention
The `skills/` prefix is stripped from URLs:
- File: `skills/anthropics/skills/pdf/skill.yaml`
- URL: `openagentskills.org/anthropics/skills/pdf`
- CLI: `openskills install anthropics/skills/pdf`

## Architecture: Static vs Dynamic Data

**Static (in git, contributor-owned):**
- `skill.yaml` files with `source`, `categories`, `tags`
- `SKILL.md` files for internal skills
- `categories.yaml`

**Dynamic (in Cloudflare KV, worker-managed):**
- `name`, `description`, `license`, `compatibility` (from SKILL.md frontmatter)
- `lastValidated`, `lastCommit`, `contentHash`, `status`
- Pre-built manifest for GET /api/skills

**Why:** Avoids noisy auto-commits, keeps git history clean, prevents merge conflicts on metadata fields, and makes the registry API always serve fresh data.

## Coding Standards

### TypeScript

- Strict mode enabled
- Use explicit types, avoid `any`
- Prefer `interface` over `type` for objects
- Use `const` assertions where appropriate

### File Naming

- `kebab-case` for files and directories
- `skill.yaml` (not `skill.yml`)
- `SKILL.md` (uppercase)

### YAML

- 2-space indentation
- No trailing spaces
- Quoted strings for dates and special characters

## Commit Messages

Follow [Conventional Commits](https://conventionalcommits.org):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `chore` - Maintenance
- `refactor` - Code refactoring
- `test` - Tests
- `ci` - CI/CD changes

**Scopes:**
- `skills` - Skill additions/changes
- `worker` - Worker code
- `schema` - Schema changes
- `actions` - GitHub Actions
- `deps` - Dependencies

**Examples:**
```
feat(skills): add anthropics/skills/pdf-parsing
fix(worker): handle missing SKILL.md gracefully
chore(deps): update ajv to 8.17.1
ci(actions): update sync-registry workflow
```

**Enforcement:**
- Local: Husky `commit-msg` hook runs commitlint on every commit.
- CI: `.github/workflows/commitlint.yaml` validates commit messages for all PRs and pushes.

## Testing Requirements

### Unit Tests

Required for:
- `worker/src/*.ts` - All worker functions
- `scripts/*.ts` - CI/CD scripts

Use **Vitest** for testing:

```typescript
import { describe, it, expect } from 'vitest';
import { validateSkillSchema } from '../validate';

describe('validateSkillSchema', () => {
  it('accepts valid external skill', () => {
    const yaml = `
source:
  type: external
  url: https://github.com/anthropics/skills
  path: skills/pdf
categories:
  - documents
tags:
  - pdf
`;
    expect(() => validateSkillSchema(yaml)).not.toThrow();
  });
});
```

### Test Commands

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Minimum coverage: 80%**

## Key Libraries

| Library | Purpose | Docs |
|---------|---------|------|
| `hono` | Worker framework | https://hono.dev |
| `yaml` | YAML parsing | https://eemeli.org/yaml |
| `vitest` | Testing | https://vitest.dev |

## GitHub Actions

Use well-established actions:
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/labeler@v5`
- `dorny/paths-filter@v3`
- `peter-evans/repository-dispatch@v3`
- `cloudflare/wrangler-action@v3`
- `googleapis/release-please-action@v4`

### Release Policy

- Do not trigger releases on every merge to `main`.
- Use `.github/workflows/release.yaml` via `workflow_dispatch` to create or update a Release PR.
- Release PRs batch merged changes until maintainers approve and merge them.
- After merging the Release PR, run the same release workflow again to publish the Git tag and GitHub Release.

### Worker Deployment Policy

- Worker deployments are CI/CD only through GitHub Actions.
- Do not deploy worker changes manually from local machines.
- `dev` deploys automatically on merge to `main` when worker files change.
- `prod` deploy requires approval via GitHub Environment protection rules.

## What NOT to Do

- Do NOT add `_meta` or dynamic metadata to skill.yaml files
- Do NOT add `repoStars` to YAML (website handles this)
- Do NOT skip schema validation
- Do NOT use `any` types
- Do NOT commit without running tests
- Do NOT bypass concurrency controls
- Do NOT use non-conventional commit messages
- Do NOT put SKILL.md files in the `skills/` directory
- Do NOT put skill.yaml files in the root `openagentskills/` directory
- Do NOT auto-commit back to the repo from GitHub Actions

## Quick Reference

```bash
# Development
npm install           # Install deps
cd worker && npm install && cd ..  # Worker deps
cd worker && npm run dev  # Worker dev server

# Testing
npm test              # Run tests
npm run lint          # Lint code
npm run typecheck     # Type checking

# Validation (manual)
WORKER_URL=... npx tsx scripts/call-worker.ts skills/path/to/skill.yaml

# Sync (manual, persist=true)
WORKER_URL=... npm run sync-registry

# Sync changed only
WORKER_URL=... npm run sync-registry -- --changed-only '["skills/path/to/skill.yaml"]'

# Release (manual, batched)
gh workflow run release.yaml -f target_branch=main
```
