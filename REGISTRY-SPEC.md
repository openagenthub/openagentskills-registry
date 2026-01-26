# Open Agent Skills Registry - Specification

> Source of truth for all agent skill metadata. PR-based, no database, pure YAML.

## Big Picture

**Open Agent Skills** is a community-driven directory for discovering and installing agent skills across AI assistants. The system consists of three repositories:

| Repo | Purpose | Status |
|------|---------|--------|
| **openagentskills-registry** (this) | Skill metadata, validation, index generation | Primary focus |
| openagentskills-web | Discovery website at openagentskills.org | Consumes registry |
| openagentskills-cli | `openskills` CLI tool (Go) | Future |

**This document covers the registry repository.**

### How It Works

```
Contributor submits PR (skill.yaml)
        │
        ▼
┌─────────────────────────────────┐
│  GitHub Action: validate-pr     │
│  - Detects changed files only   │
│  - Calls Cloudflare Worker      │
│  - Worker fetches SKILL.md      │
│  - Extracts name, description   │
│  - Updates _meta in YAML        │
└─────────────────────────────────┘
        │
        ▼
Maintainer reviews & merges
        │
        ▼
┌─────────────────────────────────┐
│  GitHub Action: build-index     │
│  - Concurrency lock (queued)    │
│  - Rebuilds dist/index.json     │
│  - Triggers web repo rebuild    │
└─────────────────────────────────┘
        │
        ▼
Website auto-deploys with new data
```

---

## Directory Structure

```
openagentskills-registry/
│
├── anthropics/                            # GitHub org
│   └── skills/                            # GitHub repo
│       ├── pdf-parsing/
│       │   └── skill.yaml                 # External skill
│       ├── docx-editing/
│       │   └── skill.yaml
│       └── pptx-creation/
│           └── skill.yaml
│
├── vercel-labs/
│   └── agent-skills/
│       └── web-scraper/
│           └── skill.yaml
│
├── openagentskills/                       # Internal skills (skill.yaml + SKILL.md together)
│   ├── frontend-design/
│   │   ├── skill.yaml
│   │   └── SKILL.md
│   └── git-workflow/
│       ├── skill.yaml
│       └── SKILL.md
│
├── schemas/
│   └── skill.schema.json
│
├── dist/                                  # Auto-generated
│   ├── index.json
│   └── stats.json
│
├── worker/                                # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts
│   │   ├── validate.ts
│   │   ├── github.ts
│   │   └── frontmatter.ts
│   ├── wrangler.toml
│   └── package.json
│
├── scripts/
│   ├── build-index.ts
│   ├── update-metadata.ts
│   └── validate-all.ts
│
├── .github/
│   ├── workflows/
│   │   ├── validate-pr.yaml
│   │   ├── build-index.yaml
│   │   ├── daily-validation.yaml
│   │   └── release.yaml
│   ├── labeler.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│
├── .commitlintrc.json
├── .husky/
├── categories.yaml
├── package.json
└── README.md
```

### Key Design Decisions

1. **No `skills/` prefix** - Skill paths map directly to URL paths (e.g., `anthropics/skills/pdf-parsing`)
2. **Internal skills colocated** - `openagentskills/{skill}/skill.yaml` + `SKILL.md` in same directory
3. **Path = CLI identifier** - `anthropics/skills/pdf-parsing/skill.yaml` → `openskills install anthropics/skills/pdf-parsing`

---

## Skill Path Convention

```
{org}/{repo}/{skill-name}/skill.yaml
└───────────┬───────────┘
            │
      CLI: openskills install anthropics/skills/pdf-parsing
      URL: openagentskills.org/anthropics/skills/pdf-parsing
```

| Type | Registry Path | Points To |
|------|---------------|-----------|
| External | `anthropics/skills/pdf-parsing/skill.yaml` | `github.com/anthropics/skills/public/pdf` |
| Internal | `openagentskills/frontend-design/skill.yaml` | Same dir: `openagentskills/frontend-design/SKILL.md` |

---

## Skill YAML Schema

YAML is minimal. Dynamic fields come from SKILL.md frontmatter via Cloudflare Worker.

### External Skill

```yaml
# anthropics/skills/pdf-parsing/skill.yaml

source:
  type: external
  path: public/pdf                    # Path in source repo to SKILL.md dir
  ref: main                           # Optional, defaults to main

categories:                           # 1-3 categories
  - documents

tags:                                 # 1-5 tags
  - pdf
  - extraction
  - forms

# Auto-populated by Worker (DO NOT EDIT)
_meta:
  name: pdf
  description: Extract text and tables from PDF files...
  license: Apache-2.0
  compatibility: poppler-utils
  repoUrl: https://github.com/anthropics/skills
  lastCommit: "2025-01-20T10:30:00Z"
  lastValidated: "2025-01-25T06:00:00Z"
  contentHash: sha256:abc123...
  status: active
```

### Internal Skill

```yaml
# openagentskills/frontend-design/skill.yaml

source:
  type: internal
  # SKILL.md is in same directory: openagentskills/frontend-design/SKILL.md

categories:
  - development
  - creativity

tags:
  - frontend
  - ui
  - tailwind

# Auto-populated by Worker (DO NOT EDIT)
_meta:
  name: frontend-design
  description: Create beautiful, responsive frontend interfaces...
  license: MIT
  lastValidated: "2025-01-25T06:00:00Z"
  contentHash: sha256:def456...
  status: active
```

### Internal Skill Content

```markdown
<!-- openagentskills/frontend-design/SKILL.md -->
---
name: frontend-design
description: Create beautiful, responsive frontend interfaces with modern CSS.
version: 1.0.0
license: MIT
compatibility: Node.js 18+
---

# Frontend Design

Use this skill when the user asks to create UI components or style pages.

## Instructions

1. Analyze design requirements
2. Choose appropriate Tailwind utilities
3. Implement responsive breakpoints
4. Ensure accessibility

## Examples

[examples here]
```

---

## JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://openagentskills.org/schemas/skill.schema.json",
  "type": "object",
  "required": ["source", "categories", "tags"],
  "properties": {
    "source": {
      "type": "object",
      "required": ["type"],
      "oneOf": [
        {
          "properties": {
            "type": { "const": "external" },
            "path": { "type": "string" },
            "ref": { "type": "string", "default": "main" }
          },
          "required": ["type", "path"]
        },
        {
          "properties": {
            "type": { "const": "internal" }
          },
          "required": ["type"]
        }
      ]
    },
    "categories": {
      "type": "array",
      "items": {
        "enum": [
          "development",
          "databases",
          "cloud-services",
          "productivity",
          "marketing",
          "creativity",
          "data-analytics",
          "integrations",
          "communication",
          "documents"
        ]
      },
      "minItems": 1,
      "maxItems": 3
    },
    "tags": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
      "minItems": 1,
      "maxItems": 5
    },
    "_meta": {
      "type": "object",
      "description": "Auto-populated by Worker"
    }
  },
  "additionalProperties": false
}
```

---

## Categories

Categories are designed for AI agents/assistants across all domains, not just coding.

```yaml
# categories.yaml
categories:
  - id: development
    name: Development
    description: Code generation, APIs, git workflows, testing, and debugging
    icon: code

  - id: databases
    name: Databases
    description: SQL, NoSQL, queries, migrations, and optimization
    icon: database

  - id: cloud-services
    name: Cloud Services
    description: AWS, GCP, Azure, deployment, and infrastructure
    icon: cloud

  - id: productivity
    name: Productivity
    description: Task management, automation, workflows, and time-saving tools
    icon: zap

  - id: marketing
    name: Marketing
    description: SEO, social media, content strategy, analytics, and campaigns
    icon: megaphone

  - id: creativity
    name: Creativity
    description: Design, images, writing, video, audio, and content creation
    icon: palette

  - id: data-analytics
    name: Data & Analytics
    description: Charts, reports, insights, visualization, and data processing
    icon: bar-chart

  - id: integrations
    name: Integrations
    description: Third-party APIs, webhooks, connectors, and service connections
    icon: plug

  - id: communication
    name: Communication
    description: Email, chat, documentation, and collaboration tools
    icon: message-square

  - id: documents
    name: Documents
    description: PDFs, Word docs, Excel, presentations, and file conversion
    icon: file-text
```

---

## Cloudflare Worker

The Worker validates skills and extracts metadata. It does NOT fetch GitHub stars (website handles that).

### Endpoints

| Endpoint | Purpose | Used By |
|----------|---------|---------|
| `POST /api/validate` | Validate single skill | PR workflow |
| `POST /api/validate-batch` | Validate multiple skills | Daily cron |

### Implementation

```typescript
// worker/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/*', cors());

interface ValidateRequest {
  skillPath: string;        // "anthropics/skills/pdf-parsing"
  yamlContent: string;
  internalSkillMd?: string; // For internal skills
}

app.post('/api/validate', async (c) => {
  const body = await c.req.json<ValidateRequest>();
  const result = await validateSkill(body, c.env);
  return c.json(result);
});

app.post('/api/validate-batch', async (c) => {
  const { skills } = await c.req.json<{ skills: ValidateRequest[] }>();
  
  const results = [];
  for (const skill of skills) {
    await new Promise(r => setTimeout(r, 100)); // Rate limit
    results.push(await validateSkill(skill, c.env));
  }
  
  return c.json({ results });
});

async function validateSkill(req: ValidateRequest, env: Env) {
  const { skillPath, yamlContent, internalSkillMd } = req;
  
  try {
    // 1. Validate YAML schema
    const skill = parseAndValidateYaml(yamlContent);
    
    // 2. Determine org/repo from path
    const [org, repo, ...rest] = skillPath.split('/');
    const skillName = rest.join('/');
    const isInternal = skillPath.startsWith('openagentskills/');
    
    // 3. Fetch SKILL.md
    let skillMdContent: string;
    let repoUrl: string;
    let lastCommit: string | null = null;
    
    if (isInternal) {
      skillMdContent = internalSkillMd || await fetchFromRegistry(skillName, env);
      repoUrl = 'https://github.com/openagenthub/openagentskills-registry';
    } else {
      skillMdContent = await fetchFromGitHub(org, repo, skill.source.path, skill.source.ref, env);
      lastCommit = await fetchLastCommit(org, repo, skill.source.path, skill.source.ref, env);
      repoUrl = `https://github.com/${org}/${repo}`;
    }
    
    // 4. Parse frontmatter
    const fm = parseFrontmatter(skillMdContent);
    
    // 5. Build enriched metadata
    const enrichedMeta = {
      name: fm.name,
      description: fm.description,
      license: fm.license || null,
      compatibility: fm.compatibility || null,
      repoUrl,
      lastCommit,
      lastValidated: new Date().toISOString(),
      contentHash: `sha256:${await hash(fm.name + fm.description)}`,
      status: 'active'
    };
    
    return { success: true, skillPath, enrichedMeta };
    
  } catch (error) {
    return { success: false, skillPath, error: error.message };
  }
}

export default app;
```

### Worker Wrangler Config

```toml
# worker/wrangler.toml
name = "openagentskills-validator"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
GITHUB_TOKEN = ""  # Set via wrangler secret
```

---

## GitHub Actions

### Validation Scopes

| Trigger | Skills Validated | Purpose |
|---------|------------------|---------|
| PR | Only changed files | Fast feedback |
| Merge | Only merged files | Update _meta |
| Daily cron | ALL skills | Detect broken links |

### PR Validation (Changed Files Only)

```yaml
# .github/workflows/validate-pr.yaml
name: Validate PR

on:
  pull_request:
    paths:
      - '**/skill.yaml'
      - 'openagentskills/**/SKILL.md'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Get changed files
        id: changed
        uses: dorny/paths-filter@v3
        with:
          list-files: json
          filters: |
            skills:
              - '**/skill.yaml'
            content:
              - 'openagentskills/**/SKILL.md'

      - name: Validate changed skills
        if: steps.changed.outputs.skills == 'true'
        env:
          WORKER_URL: ${{ secrets.VALIDATION_WORKER_URL }}
          CHANGED_FILES: ${{ steps.changed.outputs.skills_files }}
        run: npm run validate:changed

      - name: Lint commits
        uses: wagoid/commitlint-github-action@v6

      - name: Label PR
        uses: actions/labeler@v5
```

### Build Index (With Concurrency Lock)

```yaml
# .github/workflows/build-index.yaml
name: Build Index

on:
  push:
    branches: [main]
    paths:
      - '**/skill.yaml'
      - 'openagentskills/**/SKILL.md'
      - 'categories.yaml'

concurrency:
  group: index-build
  cancel-in-progress: false  # Queue, don't cancel

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Get changed skills
        id: changed
        uses: dorny/paths-filter@v3
        with:
          list-files: json
          filters: |
            skills:
              - '**/skill.yaml'

      - name: Update metadata for changed skills
        if: steps.changed.outputs.skills == 'true'
        env:
          WORKER_URL: ${{ secrets.VALIDATION_WORKER_URL }}
          CHANGED_FILES: ${{ steps.changed.outputs.skills_files }}
        run: npm run update-metadata

      - name: Rebuild index
        run: npm run build:index

      - name: Commit changes
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: rebuild registry index'
          file_pattern: 'dist/* **/skill.yaml'

      - name: Trigger web rebuild
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.CROSS_REPO_PAT }}
          repository: openagenthub/openagentskills-web
          event-type: registry-updated
```

### Daily Validation (All Skills)

```yaml
# .github/workflows/daily-validation.yaml
name: Daily Validation

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

concurrency:
  group: daily-validation
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Validate all skills
        id: validate
        env:
          WORKER_URL: ${{ secrets.VALIDATION_WORKER_URL }}
        run: npm run validate:all 2>&1 | tee validation.log

      - name: Update statuses
        run: npm run update:statuses

      - name: Commit updates
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: daily validation update'
          file_pattern: '**/skill.yaml'

      - name: Create issue for broken skills
        if: contains(steps.validate.outputs.*, 'broken')
        uses: peter-evans/create-issue-from-file@v5
        with:
          title: '🔗 Broken Skills Detected'
          content-filepath: validation.log
          labels: broken-link, maintenance
```

### Release Management

```yaml
# .github/workflows/release.yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node
```

---

## Generated Index

```json
{
  "version": "1.0.0",
  "generatedAt": "2025-01-25T10:30:00Z",
  "totalSkills": 42,
  "categories": [
    { "id": "document-processing", "name": "Document Processing", "count": 8 }
  ],
  "skills": [
    {
      "id": "anthropics/skills/pdf-parsing",
      "path": "anthropics/skills/pdf-parsing",
      "name": "pdf",
      "description": "Extract text and tables from PDF files...",
      "categories": ["document-processing"],
      "tags": ["pdf", "extraction"],
      "source": {
        "type": "external",
        "org": "anthropics",
        "repo": "skills",
        "path": "public/pdf",
        "ref": "main"
      },
      "license": "Apache-2.0",
      "repoUrl": "https://github.com/anthropics/skills",
      "lastCommit": "2025-01-20T10:30:00Z",
      "lastValidated": "2025-01-25T06:00:00Z",
      "status": "active"
    }
  ]
}
```

**Note**: No `repoStars`. Website loads stars dynamically with caching.

---

## PR Template

```markdown
## Adding a Skill

### Checklist

- [ ] YAML at: `{org}/{repo}/{skill-name}/skill.yaml`
- [ ] Has: `source`, `categories` (1-3), `tags` (1-5)
- [ ] Commits follow [Conventional Commits](https://conventionalcommits.org)

**External Skills:**
- [ ] SKILL.md exists at source path

**Internal Skills:**
- [ ] skill.yaml + SKILL.md at `openagentskills/{skill-name}/`

### Info

| Field | Value |
|-------|-------|
| Path | `anthropics/skills/pdf-parsing` |
| Type | external / internal |
| CLI | `openskills install anthropics/skills/pdf-parsing` |

### Commit Format

```
feat(skills): add anthropics/skills/pdf-parsing
```
```

---

## Relationship with Web Repo

The web repo (`openagentskills-web`) consumes this registry:

1. Fetches `dist/index.json` at build time
2. Generates search embeddings from skill data
3. Loads GitHub stars dynamically (not stored here)
4. Receives `repository_dispatch` event on registry updates
5. Auto-deploys to Cloudflare Pages

See `openagentskills-web-spec.md` for web-specific details.

---

## Setup Checklist

- [ ] Create repo at `openagenthub/openagentskills-registry`
- [ ] Deploy Cloudflare Worker
- [ ] Add secrets: `VALIDATION_WORKER_URL`, `CROSS_REPO_PAT`
- [ ] Set up commitlint + husky
- [ ] Create initial categories.yaml
- [ ] Add first skill (openagentskills/example)