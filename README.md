# Open Agent Skills Registry

> The source of truth for AI agent skills metadata.

[![Daily Validation](https://github.com/openagenthub/openagentskills-registry/actions/workflows/daily-validation.yaml/badge.svg)](https://github.com/openagenthub/openagentskills-registry/actions/workflows/daily-validation.yaml)

## Overview

This repository contains the skill registry for [Open Agent Skills](https://openagentskills.org) - a community-driven directory for discovering and installing AI agent skills.

**Key Principles:**
- PR-based contributions (no authentication required)
- Minimal YAML (metadata pulled from SKILL.md frontmatter)
- Automated validation via Cloudflare Workers
- Conventional commits for clear history

## Directory Structure

```
openagentskills-registry/
├── skills/                        # Skill YAML pointers (see skills/README.md)
├── openagentskills/               # Internal skill implementations (see openagentskills/README.md)
├── schemas/                       # JSON Schema for validation
├── dist/                          # Generated index (auto-committed)
├── worker/                        # Cloudflare Worker for validation
└── scripts/                       # Build and validation scripts
```

| Directory | Contents | Documentation |
|-----------|----------|---------------|
| [`skills/`](skills/) | All `skill.yaml` registration files | [skills/README.md](skills/README.md) |
| [`openagentskills/`](openagentskills/) | Internal skill implementations (`SKILL.md`) | [openagentskills/README.md](openagentskills/README.md) |

## Quick Start

### Add an External Skill

```bash
mkdir -p skills/{org}/{repo}/{skill-name}
# Create skill.yaml (see skills/README.md for schema)
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

# Build the index
npm run build:index

# Run worker locally (requires wrangler)
cd worker && npm run dev
```

## Validation

Skills are validated:
- On PR: Only changed skills
- On merge: Update metadata for merged skills
- Daily at 6 AM UTC: All skills (detect broken links)

## API Endpoints

The Cloudflare Worker provides:

- `POST /api/validate` - Validate a single skill
- `POST /api/validate-batch` - Validate multiple skills

## Contributing

1. Fork this repository
2. Create a feature branch
3. Follow [Conventional Commits](https://conventionalcommits.org)
4. Submit a PR

## License

MIT - See [LICENSE](LICENSE) for details.
