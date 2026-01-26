## Adding a Skill to Open Agent Skills

### Checklist

- [ ] Skill YAML is at: `skills/{org}/{repo}/{skill-name}/skill.yaml`
- [ ] YAML has required fields: `source`, `categories` (1-3), `tags` (1-5)
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)

**For External Skills:**
- [ ] Source repo and path exist and are publicly accessible
- [ ] SKILL.md exists at the specified source path

**For Internal Skills (openagentskills):**
- [ ] YAML pointer at `skills/openagentskills/{skill-name}/skill.yaml`
- [ ] SKILL.md at `openagentskills/{skill-name}/SKILL.md`
- [ ] SKILL.md follows [agentskills.io specification](https://agentskills.io/specification)

### Skill Information

| Field | Value |
|-------|-------|
| Full Path | `{org}/{repo}/{skill-name}` |
| Type | external / internal |
| Categories | category-1, category-2 |
| CLI Install | `openskills install {path}` |

### Commit Message Format

For new skills:
```
feat(skills): add {org}/{repo}/{skill-name}

Brief description of what this skill does.
```

For updates:
```
fix(skills): update {skill-path} metadata

What changed and why.
```
