# Open Agent Skills Registry

> The source of truth for AI agent skills metadata.

## Overview

This repository contains the skill registry for [Open Agent Skills](https://openagentskills.org) -- a community-driven directory for discovering and installing AI agent skills.

**Key Principles:**
- PR-based contributions (no authentication required)
- Minimal YAML -- skill.yaml files are static pointers, metadata lives in Cloudflare KV
- Automated validation via Cloudflare Workers
- No auto-commits -- the repo stays clean, dynamic data stays in KV
- Conventional commits for clear history

## Architecture

```
Contributor submits PR (skill.yaml)
        |
        v
GitHub Action: validate-pr
  - Validates YAML schema
  - Worker fetches SKILL.md, extracts name/description
  - persist=false (no KV writes)
        |
        v
Maintainer reviews & merges
        |
        v
GitHub Action: sync-registry
  - Worker validates changed skills
  - persist=true (writes to Cloudflare KV)
  - Syncs categories, rebuilds manifest
  - Triggers website rebuild
        |
        v
Website + CLI call GET /api/skills
```

## Directory Structure

```
openagentskills-registry/
├── skills/                        # Skill YAML pointers (see skills/README.md)
├── openagentskills/               # Internal skill implementations (see openagentskills/README.md)
├── schemas/                       # JSON Schema for validation
├── worker/                        # Cloudflare Worker (validation + registry API)
├── scripts/                       # CI/CD scripts
└── .github/workflows/             # GitHub Actions
```

| Directory | Contents | Documentation |
|-----------|----------|---------------|
| [`skills/`](skills/) | All `skill.yaml` registration files | [skills/README.md](skills/README.md) |
| [`openagentskills/`](openagentskills/) | Internal skill implementations (`SKILL.md`) | [openagentskills/README.md](openagentskills/README.md) |

## Quick Start

### Add an External Skill

```bash
mkdir -p skills/{org}/{repo}/{skill-name}
# Create skill.yaml with source.url, source.path, categories, tags
git commit -m "feat(skills): add {org}/{repo}/{skill-name}"
```

### Add an Internal Skill

```bash
mkdir -p skills/openagentskills/{skill-name}
mkdir -p openagentskills/{skill-name}
# Create skill.yaml pointer + SKILL.md implementation
git commit -m "feat(skills): add openagentskills/{skill-name}"
```

See [skills/README.md](skills/README.md) and [openagentskills/README.md](openagentskills/README.md) for detailed instructions.

## Categories

| Category | Description |
|----------|-------------|
| `development` | Code generation, APIs, git workflows, testing, debugging |
| `databases` | SQL, NoSQL, queries, migrations, optimization |
| `cloud-services` | AWS, GCP, Azure, deployment, infrastructure |
| `productivity` | Task management, automation, workflows, time-saving |
| `marketing` | SEO, social media, content strategy, analytics, campaigns |
| `creativity` | Design, images, writing, video, audio, content creation |
| `data-analytics` | Charts, reports, insights, visualization, data processing |
| `integrations` | Third-party APIs, webhooks, connectors, services |
| `communication` | Email, chat, documentation, collaboration |
| `documents` | PDFs, Word docs, Excel, presentations, file conversion |

See [categories.yaml](categories.yaml) for full definitions.

## Local Development

```bash
# Install dependencies
npm install

# Install worker dependencies
cd worker && npm install && cd ..

# Run worker locally
cd worker && npm run dev

# Run tests
npm test

# Lint
npm run lint
```

## Validation

Skills are validated at three stages:
- **On PR**: Only changed skills (persist=false, validation check only)
- **On merge**: Changed skills synced to KV (persist=true)
- **Daily at 6 AM UTC**: All skills re-validated, broken ones flagged

## API Endpoints

The Cloudflare Worker serves both validation and registry APIs:

| Endpoint | Purpose | Used By |
|----------|---------|---------|
| `GET /api/skills` | Full registry manifest | Website, CLI |
| `GET /api/skills/:path` | Single skill entry | Website, CLI |
| `GET /api/categories` | Category definitions | Website, CLI |
| `POST /api/validate` | Validate a single skill | PR workflow |
| `POST /api/validate-batch` | Validate multiple skills | Daily cron, post-merge |
| `POST /api/categories` | Sync categories to KV | Post-merge workflow |
| `POST /api/rebuild-manifest` | Rebuild manifest from KV | Post-merge workflow |

## Contributing

1. Fork this repository
2. Create a feature branch
3. Follow [Conventional Commits](https://conventionalcommits.org)
4. Submit a PR

## License

MIT -- See [LICENSE](LICENSE) for details.
