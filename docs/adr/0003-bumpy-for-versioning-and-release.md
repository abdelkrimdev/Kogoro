# Bumpy for versioning and release

We need automated versioning, changelog generation, and GitHub Release publishing for our monorepo (CLI + GUI). We chose `@varlock/bumpy` over Changesets, Beachball, and Auto.

## Context

Kogoro ships two tightly-coupled apps — `@kogoro/cli` (Bun-compiled binary) and `@kogoro/gui` (Electrobun desktop app) — from a single monorepo. Both apps always share the same version number and are published together in a single GitHub Release. We needed a tool that handles monorepo versioning, generates changelogs, and integrates with GitHub Actions without requiring a separate bot or app installation.

## Decision

We use `@varlock/bumpy` with a PR-based release flow:

1. Developers create bump files (`.bumpy/*.md`) as part of their PRs, declaring which packages change and at what level.
2. `bumpy ci check` runs on every PR, posting a comment showing what would be released.
3. `bumpy ci release` runs on push to main. If bump files exist, it opens a "Version Packages" PR with version bumps and changelogs.
4. When the Version Packages PR merges, `bumpy ci release` creates a git tag and GitHub Release.
5. A separate tag-triggered workflow builds artifacts for all five platforms (macOS arm64/x64, Windows x64, Linux x64/arm64) and uploads them to the release.

Both packages are in a `fixed` group so they always bump together. Changelogs use the `"github"` formatter with PR links. Neither package is published to npm — Bumpy handles versioning and git tags, while the build workflow handles artifact distribution.

## Alternatives considered

- **Changesets** — the de facto standard, but heavier: requires a GitHub App installation, a separate action, and file-based workflow with interactive prompts. Its hardcoded aggressive dependency propagation (minor bump → major bump on all peers) is problematic for our tightly-coupled monorepo. Bumpy's `fixed` group gives us locked versions without fighting the tool.
- **Beachball** — designed for the Microsoft/rush.js ecosystem. Zero-config for rush projects but awkward outside it.
- **Auto** — PR-label-based automation. GitHub-first and clean, but removes version-level control (the tool decides the bump from labels rather than developers declaring intent in the diff). Less transparent in code review.
- **Conventional Commits + semantic-release** — infers bumps from commit messages. Breaks down in monorepos where a single PR touches multiple packages. Squash merges lose per-commit metadata. Poor changelog quality for end users.

## Consequences

- Bumpy is a dev dependency (`bun add -d @varlock/bumpy`), not a GitHub App — no org-level installation required.
- A fine-grained PAT (`BUMPY_GH_TOKEN`) is needed so the Version Packages PR triggers CI workflows.
- Bump files are explicit and reviewable in PR diffs, making release intent clear during code review.
- The `fixed` group ensures CLI and GUI versions are always synchronized.
- Skipped npm publish (`skipNpmPublish: true`) since artifacts are distributed via GitHub Releases, not the registry.
