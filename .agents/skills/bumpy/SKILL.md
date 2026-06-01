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

## Release workflow

### 1. Prepare
Ensure all changes have bump files in `.bumpy/`. If missing, run `bunx bumpy add`.

### 2. Version
```bash
bunx bumpy version
```
This consumes all pending bump files, updates changelogs, bumps `package.json` versions, and creates a version branch (check `_config.json` for the branch name).

### 3. Version PR
Commit, push, and open the version PR against the base branch defined in `_config.json`.

### 4. Publish
Merging the version PR triggers CI to run `bunx @varlock/bumpy ci release`, which creates git tags and publishes packages.
