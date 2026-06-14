---
name: bumpy
description: Create bump files for versioning and changelogs using Bumpy. Use when implementing features, fixing bugs, or preparing releases.
---

# Bumpy

Create bump files for versioning and changelogs using Bumpy. Read `.bumpy/_config.json` to understand package structure and versioning rules.

## Process

### 1. Check for duplicates

Before creating a bump file, check if an existing one in `.bumpy/` covers the same feature. Remove or consolidate duplicates to avoid redundant changelog entries.

### 2. Create bump file

Every user-facing change needs a bump file in `.bumpy/`. Create one per PR/feature using the bumpy CLI:

```bash
bunx bumpy add --packages "package-name:minor" --message "Description" --name "my-change"
```

<bump-levels>
- `major`: breaking changes
- `minor`: new features
- `patch`: bug fixes
- `none`: no release (for docs, CI, refactors)
</bump-levels>

For non-release PRs:

```bash
bunx bumpy add --empty --name "description"
```

### 3. Write descriptions

Write descriptions from the user's perspective. Focus on what changed in the UI/UX, not how it was implemented.

<description-examples>

- **Good:** "Fix duplicate entries appearing when switching between databases"
- **Bad:** "Fix duplicate library entries when switching between databases (TVDB/AniDB). Match cache now tracks sourceDb, mergeFromMatches cleans up entries from other databases, and rebuild deduplicates by file path."

- **Good:** "Re-scan skips unchanged files for faster incremental scans"
- **Bad:** "Incremental scan via per-file state tracking: skip unchanged files on re-scan using stat-based cache, removing the fragile isAlreadyOrganized heuristic"

</description-examples>

## Release Workflow

Follow these steps when preparing a release.

### 1. Prepare

Ensure all changes have bump files in `.bumpy/`. If missing, run `bunx bumpy add`. Review descriptions for product-focused language.

See [RELEASE-TEMPLATE.md](RELEASE-TEMPLATE.md) for the exact format to use in changelogs and GitHub releases.

### 2. Version

Consume all pending bump files, update changelogs, bump `package.json` versions, and create a version branch (check `_config.json` for the branch name):

```bash
bunx bumpy version
```

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

Create a GitHub release using the template from [RELEASE-TEMPLATE.md](RELEASE-TEMPLATE.md):

```bash
gh release create <version> --title "Release <version>" --notes "..."
```

### 5. Clean up

```bash
git checkout main
git branch -D <version-branch>
git pull
```
