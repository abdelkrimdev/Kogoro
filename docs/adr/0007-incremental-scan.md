# ADR 0007: Incremental Scan via Per-File State Tracking

## Status

Accepted

## Context

Every scan re-walks the entire directory tree and reads every file's bytes to compute SHA-256, even when nothing changed. For large folders, this walk + hash I/O is the bottleneck. Users with many watched folders experience slow re-scans.

Additionally, the CLI used a fragile `isAlreadyOrganized()` heuristic that checked whether a file's path contained directory names from a hardcoded set (`ORGANIZED_DIRS`). This was incorrect for misnamed files in organized directories and created an unnecessary code path.

## Decision

Track per-file metadata (path, size, mtime) in a new `scan_state` table in `cache.db`. On re-scan, compare `stat()` results against stored state — skip files that haven't changed. The `ScanOrchestrator` handles this check, returning `status: "cached"` with `skipped: true` for unchanged files.

Delete the `isAlreadyOrganized()` heuristic entirely. The `MatchCache` scan state provides the optimization — previously scanned files get cache hits regardless of directory structure.

### Changes

- **`MatchCache`**: Added `scan_state` table with CRUD methods (`getScanState`, `setScanState`, `deleteScanState`, `clearScanState`, `getScanStateBatch`, `deleteScanStateBatch`)
- **`ScanOrchestrator`**: Added `cache` and `force` options. In `startScan`, compares stat results against stored state before scanning each file. After successful renames, updates scan state (deletes old path, stores new path)
- **CLI handlers**: Removed `isAlreadyOrganized()` and organized/unorganized file splitting. All files are now scanned; the cache provides the optimization
- **GUI**: Added "Force" checkbox toggle that passes `force: true` to `scanStart` RPC, bypassing incremental optimization
- **RPC**: Updated `scanStart` params to accept optional `force` boolean

## Trade-offs

- **Slight complexity increase** for massive performance gain on re-scans. Files that haven't changed skip hash computation entirely.
- **Deleted fragile heuristic** (`isAlreadyOrganized`) — the old code was incorrect for misnamed files and created a separate code path that was hard to test.
- **Shared scan state** between CLI and GUI via `cache.db` — both entry points benefit from the same cache.
- **Force option** available when full re-scan is needed (e.g., after database updates).
