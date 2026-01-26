---
name: git-workflow
description: Expert Git workflow assistance including branching strategies, commit conventions, rebasing, and conflict resolution. Use this skill when working with version control.
version: 1.0.0
license: MIT
compatibility: Git 2.x+
---

# Git Workflow

Use this skill when the user needs help with Git version control, including:
- Creating and managing branches
- Writing conventional commit messages
- Rebasing and merging strategies
- Resolving merge conflicts
- Setting up Git hooks

## Instructions

### Branching Strategy

1. Use feature branches for new work: `feature/{ticket-id}-{short-description}`
2. Use fix branches for bugs: `fix/{ticket-id}-{description}`
3. Keep main/master as the stable branch

### Commit Messages

Follow the Conventional Commits specification:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

### Rebasing

When updating a feature branch:

```bash
git fetch origin
git rebase origin/main
```

If conflicts occur:
1. Resolve each conflict
2. Stage resolved files: `git add .`
3. Continue rebase: `git rebase --continue`

### Merge Conflict Resolution

1. Understand both changes
2. Choose the correct resolution (keep one, combine both, or rewrite)
3. Test the resolution
4. Commit with a clear message explaining the resolution

## Examples

### Creating a feature branch
```bash
git checkout -b feature/PROJ-123-add-user-auth
```

### Good commit message
```
feat(auth): add JWT token refresh endpoint

Implements automatic token refresh when the access token expires.
Includes rate limiting to prevent abuse.

Closes #123
```
