# Skills Directory

This directory contains all `skill.yaml` files that register skills in the Open Agent Skills Registry.

## Structure

```
skills/
├── {org}/                          # GitHub organization name
│   └── {repo}/                     # Repository name
│       └── {skill-name}/           # Skill identifier
│           └── skill.yaml          # Skill registration file
└── openagentskills/                # Internal skills (hosted in this repo)
    └── {skill-name}/
        └── skill.yaml
```

## Important Rules

1. **YAML files only** - Never put `SKILL.md` or other content files here
2. **Mirror the source** - Directory structure should match the source repository
3. **Internal skills** - YAML pointers for internal skills go in `skills/openagentskills/`, but the actual `SKILL.md` implementations go in the root `openagentskills/` directory

## URL Mapping

The `skills/` prefix is stripped from URLs:

| File Path | URL |
|-----------|-----|
| `skills/expo/skills/app-design/skill.yaml` | `openagentskills.org/expo/skills/app-design` |
| `skills/anthropics/skills/pdf/skill.yaml` | `openagentskills.org/anthropics/skills/pdf` |
| `skills/openagentskills/git-workflow/skill.yaml` | `openagentskills.org/openagentskills/git-workflow` |

## Adding an External Skill

External skills reference a `SKILL.md` file hosted in another GitHub repository.

1. Create the directory structure:
   ```bash
   mkdir -p skills/{org}/{repo}/{skill-name}
   ```

2. Create `skill.yaml`:
   ```yaml
   source:
     type: external
     path: path/to/skill    # Path to SKILL.md directory in source repo
     ref: main              # Git ref (branch, tag, or commit)

   categories:
     - development          # 1-3 categories from categories.yaml

   tags:
     - keyword1
     - keyword2             # 1-5 lowercase kebab-case tags
   ```

3. Submit a PR with commit message:
   ```
   feat(skills): add {org}/{repo}/{skill-name}
   ```

## Adding an Internal Skill

Internal skills are hosted in this repository. The YAML pointer goes here, but the implementation goes in `/openagentskills/`.

1. Create the YAML pointer:
   ```bash
   mkdir -p skills/openagentskills/{skill-name}
   ```

2. Create `skill.yaml`:
   ```yaml
   source:
     type: internal

   categories:
     - development

   tags:
     - keyword1
     - keyword2
   ```

3. Create the implementation in `/openagentskills/{skill-name}/SKILL.md` (see [openagentskills/README.md](/openagentskills/README.md))

## Schema Reference

See [schemas/skill.schema.json](/schemas/skill.schema.json) for the full schema.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `source.type` | `"external"` or `"internal"` | Where the skill is hosted |
| `categories` | array (1-3 items) | Category IDs from `categories.yaml` |
| `tags` | array (1-5 items) | Lowercase kebab-case keywords |

### External-only Fields

| Field | Type | Description |
|-------|------|-------------|
| `source.path` | string | Path to SKILL.md directory in source repo |
| `source.ref` | string | Git ref (default: `main`) |

## Validation

Skills are automatically validated:
- **On PR** - Changed skills only
- **On merge** - Metadata extraction for merged skills
- **Daily (6 AM UTC)** - All skills checked for broken links

Run local validation:
```bash
npm run validate:all
```

## Categories

See [categories.yaml](/categories.yaml) for the full list of available categories.
