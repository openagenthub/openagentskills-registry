# Internal Skills

This directory contains skill implementations hosted directly in the Open Agent Skills Registry.

## Structure

```
openagentskills/
└── {skill-name}/
    ├── SKILL.md              # Required: Skill content (agentskills.io spec)
    └── ...                   # Optional: Additional files (examples, templates, etc.)
```

## Important Rules

1. **Implementations only** - This directory contains `SKILL.md` files and related content
2. **No skill.yaml here** - YAML pointers go in `skills/openagentskills/`, not here
3. **Follow the spec** - All skills must follow the [agentskills.io specification](https://agentskills.io/specification)

## Creating an Internal Skill

### Step 1: Create the Implementation

```bash
mkdir -p openagentskills/{skill-name}
```

Create `openagentskills/{skill-name}/SKILL.md`:

```markdown
---
name: skill-name
description: Brief description of what this skill does and when to use it.
version: 1.0.0
license: MIT
compatibility: Optional compatibility notes
---

# Skill Title

Brief introduction explaining when to use this skill.

## Instructions

Detailed instructions for the AI agent...

## Examples

Code examples, templates, patterns...
```

### Step 2: Create the YAML Pointer

Create `skills/openagentskills/{skill-name}/skill.yaml`:

```yaml
source:
  type: internal

categories:
  - development      # 1-3 categories

tags:
  - keyword1
  - keyword2         # 1-5 tags
```

### Step 3: Submit PR

```bash
git checkout -b feat/add-skill-name
git add openagentskills/{skill-name}/ skills/openagentskills/{skill-name}/
git commit -m "feat(skills): add openagentskills/{skill-name}"
git push origin feat/add-skill-name
```

## SKILL.md Specification

Based on [agentskills.io specification](https://agentskills.io/specification).

### Frontmatter (Required)

```yaml
---
name: skill-name              # Kebab-case identifier
description: ...              # What it does + when to use it
version: 1.0.0                # Semantic version
license: MIT                  # SPDX license identifier
compatibility: ...            # Optional: Framework/tool requirements
---
```

### Content Structure

| Section | Required | Description |
|---------|----------|-------------|
| Title | Yes | `# Skill Name` |
| Introduction | Yes | When to use this skill |
| Instructions | Yes | Detailed guidance for the AI agent |
| Examples | Recommended | Code samples, templates, patterns |

### Writing Tips

1. **Be specific** - AI agents work best with clear, actionable instructions
2. **Use examples** - Show concrete code patterns, not abstract concepts
3. **Consider context** - Include when to use AND when not to use
4. **Stay focused** - One skill should do one thing well

## Additional Files

You can include additional files alongside `SKILL.md`:

```
openagentskills/my-skill/
├── SKILL.md
├── examples/
│   ├── basic.ts
│   └── advanced.ts
├── templates/
│   └── component.tsx
└── schemas/
    └── config.json
```

Reference these in your SKILL.md using relative paths.

## Local Development

```bash
# Build the index to include your new skill
npm run build:index

# Validate all skills
npm run validate:all

# Check the generated index
cat dist/index.json | jq '.skills[] | select(.id | contains("your-skill"))'
```

## See Also

- [skills/README.md](/skills/README.md) - YAML pointer documentation
- [categories.yaml](/categories.yaml) - Available categories
- [schemas/skill.schema.json](/schemas/skill.schema.json) - Validation schema
- [agentskills.io specification](https://agentskills.io/specification) - Full SKILL.md spec
