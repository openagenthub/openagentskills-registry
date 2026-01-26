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
├── skills/                    # All skill YAML pointers
│   ├── anthropics/skills/     # External: Anthropic's skills
│   ├── vercel-labs/agent-skills/
│   ├── supabase/agent-skills/
│   ├── expo/skills/
│   └── openagentskills/       # Internal skill pointers
├── openagentskills/           # Our actual skill content (SKILL.md)
├── schemas/                   # JSON Schema for validation
├── dist/                      # Generated index (auto-committed)
├── worker/                    # Cloudflare Worker for validation
└── scripts/                   # Build and validation scripts
```

## Adding a Skill

### External Skill (from another repo)

1. Create `skills/{org}/{repo}/{skill-name}/skill.yaml`:

```yaml
source:
  type: external
  path: path/to/skill  # Path to SKILL.md directory in source repo
  ref: main            # Git ref (optional, defaults to main)

categories:
  - development-tools  # 1-3 categories

tags:
  - react
  - performance       # 1-5 tags
```

### Internal Skill (in this repo)

1. Create skill content at `openagentskills/{skill-name}/SKILL.md`
2. Create `skills/openagentskills/{skill-name}/skill.yaml`:

```yaml
source:
  type: local

categories:
  - development-tools

tags:
  - git
  - workflow
```

### Submit a PR

```bash
git checkout -b feat/add-my-skill
git add .
git commit -m "feat(skills): add org/repo/skill-name"
git push origin feat/add-my-skill
```

## Categories

| Category | Description |
|----------|-------------|
| `document-processing` | PDFs, Word docs, spreadsheets |
| `creative-design` | Images, SVGs, UI components |
| `development-tools` | Code, git, testing, deployment |
| `data-analysis` | Data processing, visualization |
| `integrations` | MCP servers, APIs, services |
| `productivity` | Task management, automation |
| `communication` | Email, documentation, writing |
| `database` | SQL, NoSQL, query optimization |
| `deployment` | CI/CD, cloud, infrastructure |
| `testing` | Unit tests, integration, automation |

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
