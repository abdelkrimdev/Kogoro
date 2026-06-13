# Changelog


## 0.2.0
<sub>2026-06-13</sub>

-  *(minor)* - - Add dark mode toggle with persistence
  - Add collapsible sidebar
  - Replace native select dropdowns with searchable comboboxes
  - Improve UI consistency with Skeleton design system
-  *(minor)* - Add getLibraryStats RPC and smart routing on startup
-  *(minor)* - Show loading spinner on startup while checking configuration and library stats
-  *(minor)* - Scan progress bar and per-file status display ([#83](https://github.com/abdelkrimdev/Kogoro/issues/83), PRD [#76](https://github.com/abdelkrimdev/Kogoro/issues/76))
-  *(minor)* - Library rebuild after scan approval ([#85](https://github.com/abdelkrimdev/Kogoro/issues/85), PRD [#76](https://github.com/abdelkrimdev/Kogoro/issues/76))
  After scan approval and execution, the library database is now rebuilt from matched scan results. Added getMatchResults() to ScanOrchestrator that extracts match data filtered by status and approval state. The approvePlan RPC handler calls libraryDb.rebuildFromMatches() with extracted match data and source DB from config.
-  *(minor)* - Scan breakdown summary with color-coded badges (matched/ambiguous/failed) shown after scan phase completes, with View Results button to transition to review view.
-  *(minor)* - Rebuild library from existing data with confirmation dialog ([#88](https://github.com/abdelkrimdev/Kogoro/issues/88), PRD [#76](https://github.com/abdelkrimdev/Kogoro/issues/76))
-  *(minor)* - Add tracked folder management with remove button on scan screen
-  *(minor)* - Tracked folder list with status display ([#71](https://github.com/abdelkrimdev/Kogoro/issues/71), PRD [#68](https://github.com/abdelkrimdev/Kogoro/issues/68))
-  *(minor)* - Add drop zone on Scan screen for adding folders via drag-and-drop or click
-  *(minor)* - Add folder selection checkboxes and toolbar to scan view ([#73](https://github.com/abdelkrimdev/Kogoro/issues/73), PRD [#68](https://github.com/abdelkrimdev/Kogoro/issues/68)). Each folder row now has a checkbox (disabled for missing folders). Toolbar includes Select All with indeterminate state, folder count, and Scan Selected button. New pure functions: toggleFolder, toggleAll, deriveScanToolbar in scan-state.ts.
-  *(minor)* - Add batch scan flow with progress and scan summary ([#74](https://github.com/abdelkrimdev/Kogoro/issues/74), [#75](https://github.com/abdelkrimdev/Kogoro/issues/75), PRD [#68](https://github.com/abdelkrimdev/Kogoro/issues/68)). Implement sequential folder scanning with global progress bar, per-folder inline spinners, status badge updates after scan completion, scan summary with per-folder result counts, plan merging for multi-folder review, and multiple message handler support.
-  *(minor)* - Implement batch scanning flow with progress ([#74](https://github.com/abdelkrimdev/Kogoro/issues/74), PRD [#68](https://github.com/abdelkrimdev/Kogoro/issues/68)). When Scan Selected is clicked, folders are scanned sequentially with a global progress bar and per-folder inline status. Added markWatchedFolderScanned RPC to persist lastScannedAt. Changed onMessage to support multiple listeners. New BatchScanProgress type and deriveBatchProgress function in scan-state.ts.
-  *(minor)* - - Redesign Review screen with side-by-side source/destination card layout
  - Add topCandidates to FileRow for previewing ambiguous matches inline
  - Extend search to match episode names and numbers
  - Fix entryType displayed raw instead of labeled in Review and Resolve modal
-  *(minor)* - Polish Resolve Modal: two-step confirmation flow, colored score presentation, improved empty state with search
-  *(minor)* - Incremental scan via per-file state tracking: skip unchanged files on re-scan using stat-based cache, removing the fragile isAlreadyOrganized heuristic
-  *(minor)* - Add Force rescan toggle and already-organized summary state in scan view
-  *(patch)* - Refresh library stats after scan execution completes so the idle status bar shows up-to-date anime/episode counts
-  *(patch)* - Fix Start Scan button not opening directory picker
-  *(patch)* - Fix Settings layout shifting up when toggling a plugin switch
-  *(patch)* - Improved OS keyring UX: proactive availability detection, translated error messages, platform-specific fix guidance
-  *(patch)* - Fix duplicate library entries when switching between databases (TVDB/AniDB). Match cache now tracks sourceDb, mergeFromMatches cleans up entries from other databases, and rebuild deduplicates by file path.
-  *(patch)* - Fix CacheService.clear to also remove scan_state entries, preventing orphaned rows
-  *(patch)* - Persist user resolutions from ScanOrchestrator.resolveMatch to cache service
-  *(patch)* - Fix sourceDb filtering inconsistency in Scanner cache lookup — fresh-scan path now respects sourceDb like incremental scan

## 0.1.1
<sub>2026-06-01</sub>

First public release of Kogoro GUI — desktop app built with Electrobun and Svelte.

### Features
- Anime detail view with watch status tracking
- Swap pair indicators in review plan UI
- Library browser with grid/list view toggle
- Settings view
- Review screen with drag-and-drop swap support
- Enrichment commands for anime metadata
- Scan workflow orchestrator

### Bug fixes
- Correct debug text in AppBar headline and normalize CSS import formatting

### Refactoring
- Migrate mainview from imperative DOM to Svelte components
- Build webview with Vite instead of Electrobun views
- Migrate to Skeleton UI components and Lucide icons
- Simplify `getAnimeDirectory`, fix no-slash edge case
- Deduplicate resolve candidates logic

### Internal
- Electrobun app scaffold with Vite build pipeline
- Cross-platform builds: macOS (arm64, x64), Linux (x64, arm64), Windows (x64)
