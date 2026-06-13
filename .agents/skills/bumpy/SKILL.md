---
name: bumpy
description: Create bump files for versioning and changelogs using Bumpy. Use when implementing features, fixing bugs, or preparing releases.
---

# Bumpy

Bumpy manages versioning and changelogs. Read `.bumpy/_config.json` to understand package structure and versioning rules.

## Creating bump files

Every user-facing change needs a bump file in `.bumpy/`. Create one per PR/feature.

```bash
bunx bumpy add --packages "package-name:minor" --message "Description" --name "my-change"
```

Bump levels: `major` (breaking), `minor` (feature), `patch` (fix), `none` (no release).

For non-release PRs (docs, CI, refactors): `bunx bumpy add --empty --name "description"`

### Changelog style

Write descriptions from the user's perspective. Focus on what changed in the UI/UX, not how it was implemented.

- **Good:** "Fix duplicate entries appearing when switching between databases"
- **Bad:** "Fix duplicate library entries when switching between databases (TVDB/AniDB). Match cache now tracks sourceDb, mergeFromMatches cleans up entries from other databases, and rebuild deduplicates by file path."

- **Good:** "Re-scan skips unchanged files for faster incremental scans"
- **Bad:** "Incremental scan via per-file state tracking: skip unchanged files on re-scan using stat-based cache, removing the fragile isAlreadyOrganized heuristic"

### Deduplication

Before creating a bump file, check if an existing one covers the same feature. Remove or consolidate duplicates to avoid redundant changelog entries.

## Release workflow

### 1. Prepare
Ensure all changes have bump files in `.bumpy/`. If missing, run `bunx bumpy add`. Review descriptions for product-focused language.

### 2. Version
```bash
bunx bumpy version
```
This consumes all pending bump files, updates changelogs, bumps `package.json` versions, and creates a version branch (check `_config.json` for the branch name).

### 3. Version PR
Commit, push, and open the version PR against the base branch defined in `_config.json`.

### 4. Publish
Merging the version PR triggers CI to run `bunx @varlock/bumpy ci release`, which creates git tags and publishes packages.

If CI doesn't push tags to remote, create and push them manually:
```bash
git fetch origin main
git tag -a <version> -m "Release <version>" origin/main
git push origin <version>
```

Then create a GitHub release:
```bash
gh release create <version> --title "Release <version>" --notes "..."
```

### 5. Clean up
```bash
git checkout main
git branch -D <version-branch>
git pull
```
