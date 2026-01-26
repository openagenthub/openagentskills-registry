# openagentskills-registry

## Project Overview

A PR-based skill registry for AI agents. No database - pure YAML files validated via Cloudflare Worker.

**Key files:**
- `skills/{org}/{repo}/**/skill.yaml` - External skill YAML pointers
- `skills/openagentskills/**/skill.yaml` - Internal skill YAML pointers
- `openagentskills/**/SKILL.md` - Internal skill implementations
- `dist/index.json` - Generated manifest
- `worker/` - Cloudflare Worker for validation

## Tech Stack

| Purpose | Technology |
|---------|------------|
| Runtime | Node.js 20 |
| Package Manager | npm |
| Schema Validation | Ajv |
| YAML Parsing | yaml |
| Frontmatter | gray-matter |
| Worker Framework | Hono |
| Worker Runtime | Cloudflare Workers |
| Commit Linting | commitlint + husky |

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
├── worker/                        # Cloudflare Worker
├── scripts/                       # Build and validation scripts
├── schemas/                       # JSON Schema for validation
└── dist/                          # Generated output
```

## STRICT Directory Rules

### `skills/` Directory
- **ONLY** contains `skill.yaml` files
- **NEVER** put SKILL.md or any skill content here
- Structure mirrors the URL path (minus the `skills/` prefix)
- Example: `skills/expo/skills/app-design/skill.yaml` → URL: `/expo/skills/app-design`

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
ci(actions): add concurrency lock to build-index
```

## Testing Requirements

### Unit Tests

Required for:
- `worker/src/*.ts` - All worker functions
- `scripts/*.ts` - Build and validation scripts

Use **Vitest** for testing:

```typescript
// worker/src/__tests__/validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateSkillSchema } from '../validate';

describe('validateSkillSchema', () => {
  it('accepts valid external skill', () => {
    const yaml = `
source:
  type: external
  path: public/pdf
categories:
  - document-processing
tags:
  - pdf
`;
    expect(() => validateSkillSchema(yaml)).not.toThrow();
  });

  it('rejects skill with too many categories', () => {
    const yaml = `
source:
  type: external
  path: test
categories:
  - a
  - b
  - c
  - d
tags:
  - test
`;
    expect(() => validateSkillSchema(yaml)).toThrow(/maxItems/);
  });
});
```

### Integration Tests

Required for:
- Worker endpoint responses
- GitHub API mocking
- Index generation

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
| `ajv` | JSON Schema validation | https://ajv.js.org |
| `yaml` | YAML parsing | https://eemeli.org/yaml |
| `gray-matter` | Frontmatter parsing | https://github.com/jonschlinkert/gray-matter |
| `vitest` | Testing | https://vitest.dev |

## GitHub Actions

Use well-established actions:
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/labeler@v5`
- `dorny/paths-filter@v3`
- `stefanzweifel/git-auto-commit-action@v5`
- `googleapis/release-please-action@v4`

## Common Patterns

### Validating a Skill

```typescript
import Ajv from 'ajv';
import { parse } from 'yaml';
import schema from '../schemas/skill.schema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema);

export function validateSkillSchema(yamlContent: string) {
  const data = parse(yamlContent);
  if (!validate(data)) {
    throw new Error(ajv.errorsText(validate.errors));
  }
  return data;
}
```

### Fetching from GitHub

```typescript
export async function fetchFromGitHub(
  org: string,
  repo: string,
  path: string,
  ref: string,
  token: string
): Promise<string> {
  const url = `https://api.github.com/repos/${org}/${repo}/contents/${path}?ref=${ref}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3.raw',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'OpenAgentSkills'
    }
  });
  
  if (!res.ok) {
    throw new Error(`GitHub fetch failed: ${res.status}`);
  }
  
  return res.text();
}
```

## What NOT to Do

- ❌ Don't add `repoStars` to YAML (website handles this)
- ❌ Don't skip schema validation
- ❌ Don't use `any` types
- ❌ Don't commit without running tests
- ❌ Don't bypass concurrency controls
- ❌ Don't use non-conventional commit messages
- ❌ Don't use outdated/unpopular GitHub Actions
- ❌ **Don't put SKILL.md files in the `skills/` directory**
- ❌ **Don't put skill.yaml files in the root `openagentskills/` directory**

## Quick Reference

```bash
# Development
npm install           # Install deps
npm run dev           # Watch mode (scripts)
npm run worker:dev    # Worker dev server

# Testing
npm test              # Run tests
npm run lint          # Lint code
npm run typecheck     # Type checking

# Building
npm run build:index   # Generate dist/index.json
npm run build:worker  # Build worker

# Validation
npm run validate:changed -- <files>   # Validate specific files
npm run validate:all                  # Validate all skills
```
