# ADR 0007: Incremental Scan via Per-File State Tracking

## Status

Accepted

## Context

Every scan re-walks the entire directory tree and reads every file's bytes to compute SHA-256, even when nothing changed. For large folders, this walk + hash I/O is the bottleneck. Users with many watched folders experience slow re-scans.

## Decision

Track per-file metadata (path, size, mtime) in a `scan_state` table in `cache.db`. On re-scan, compare `stat()` results against stored state — skip files that haven't changed. The `ScanOrchestrator` handles this check, returning `status: "cached"` with `skipped: true` for unchanged files.

The `ScanStateRepository` owns the table, and `ScanStateService` encapsulates the comparison logic (`isFileUpToDate`). After successful renames, `ScanStateService.moveRename()` updates state to track the new path.

The GUI exposes a "Force" checkbox that bypasses incremental optimization. The CLI and GUI share scan state via `cache.db`, resolved through `resolveDbPaths()` (see ADR 0008).

## Trade-offs

- **Slight complexity increase** for massive performance gain on re-scans. Files that haven't changed skip hash computation entirely.
- **Force option** available when full re-scan is needed (e.g., after database updates).
