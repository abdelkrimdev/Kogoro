# Changelog












## 0.3.0
<sub>2026-07-23</sub>

-  *(minor)* - Show enrichment completion status in footer (cover art, metadata)
-  *(minor)* - Remove drag-and-drop folder selection from Scan view
-  *(minor)* - Skip missing files during library rebuild for more resilient scanning
-  *(minor)* - Library view: filter by Library State and watch status, show group counts per anime
-  *(minor)* - Add Dashboard home screen with currently watching, library stats, and quick actions
-  *(minor)*
  Anime detail page shows Episode Groups as accordion sections with per-group watch status, progress bars, and enriched metadata
-  *(minor)* - Add tracker connection management to Settings page with connect/disconnect UI and onboarding wizard integration
-  *(minor)* - Tracker disconnect now removes all tracker mappings for the disconnected source
-  *(minor)* - Tracker import preview screen: review and confirm matches before importing from connected trackers
-  *(minor)* - Onboarding Wizard tracker step: connect trackers and import data inline during setup
-  *(minor)* - Show on-disk episode count in episode group accordion
-  *(minor)* - Simplify tracker auth UX: ship client IDs, use AniList implicit grant, unify dialog
-  *(minor)*
  Add source field to TrackerAnime in AniList, MAL, and Kitsu plugins

  The source field allows the system to track which tracker an entry came from, enabling source-specific matching logic and accurate metadata about entry provenance.
-  *(patch)*
  Fix cover art display by converting paths to data URLs, correct TVDB artwork response handling, and place cover art in correct parent directory
-  *(patch)* - Fix Svelte 5 state_referenced_locally warning in SyncConflictView
-  *(patch)*
  Fix MyAnimeList authorization getting stuck at Waiting for authorization by exchanging OAuth code for token in the GUI connect flow

## 0.2.9
<sub>2026-06-14</sub>

-  *(patch)* - Simplify webview build by using Electrobun native copy config and fixed Vite output filenames

## 0.2.8
<sub>2026-06-14</sub>

-  *(patch)* - Fix webview URL using PATHS.VIEWS_FOLDER with pathToFileURL

## 0.2.7
<sub>2026-06-14</sub>

-  *(patch)* - Fix webview serving by using Electrobun's native copy config instead of embedded HTTP server

## 0.2.6
<sub>2026-06-13</sub>

-  *(patch)* - Use embedded HTTP server for webview to fix Windows loading, and improve CLI error messages

## 0.2.5
<sub>2026-06-13</sub>

-  *(patch)* - Fix webview URL on Windows by using pathToFileURL instead of views:// protocol

## 0.2.4
<sub>2026-06-13</sub>

-  *(patch)* - Embed database migrations in compiled binaries so migrations run without source files on disk

## 0.2.3
<sub>2026-06-13</sub>

-  *(patch)* - Auto-create config directory on first run to prevent startup crash

## 0.2.2
<sub>2026-06-13</sub>

-  *(patch)* - Fix Windows runtime: conditional titleBarStyle, cross-platform path handling, and shell-safe spawn

## 0.2.1
<sub>2026-06-13</sub>

-  *(patch)* - Fix Windows build by replacing bash-only shell expansion with cross-platform build script

## 0.2.0
<sub>2026-06-13</sub>

-  *(minor)* - - Add dark mode toggle with persistence
  - Add collapsible sidebar
  - Replace native select dropdowns with searchable comboboxes
  - Improve UI consistency with Skeleton design system
-  *(minor)* - App routes to the right screen based on your library state on startup
-  *(minor)* - Show loading spinner on startup while checking configuration and library stats
-  *(minor)* - Scan progress bar and per-file status display ([#83](https://github.com/abdelkrimdev/Kogoro/issues/83), PRD [#76](https://github.com/abdelkrimdev/Kogoro/issues/76))
-  *(minor)* - Library automatically rebuilds after approving scan results
-  *(minor)* - Scan breakdown summary with color-coded badges (matched/ambiguous/failed) shown after scan phase completes, with View Results button to transition to review view.
-  *(minor)* - Rebuild library from existing data with confirmation dialog ([#88](https://github.com/abdelkrimdev/Kogoro/issues/88), PRD [#76](https://github.com/abdelkrimdev/Kogoro/issues/76))
-  *(minor)* - Add tracked folder management with remove button on scan screen
-  *(minor)* - Tracked folder list with status display ([#71](https://github.com/abdelkrimdev/Kogoro/issues/71), PRD [#68](https://github.com/abdelkrimdev/Kogoro/issues/68))
-  *(minor)* - Add drop zone on Scan screen for adding folders via drag-and-drop or click
-  *(minor)* - Select specific folders to scan with checkboxes and a toolbar
-  *(minor)* - Scan multiple folders sequentially with progress tracking and a summary of results
-  *(minor)* - - Redesign Review screen with side-by-side source and destination layout
  - Preview ambiguous matches inline without opening the resolve modal
  - Search now matches episode names and numbers
  - Entry types now display with human-readable labels
-  *(minor)* - Polish Resolve Modal: two-step confirmation flow, colored score presentation, improved empty state with search
-  *(minor)* - Re-scan skips unchanged files for faster incremental scans
-  *(minor)* - Add Force rescan toggle and organized-file summary in scan view
-  *(patch)* - Refresh library stats after scan execution completes so the idle status bar shows up-to-date anime/episode counts
-  *(patch)* - Fix Start Scan button not opening directory picker
-  *(patch)* - Fix Settings layout shifting up when toggling a plugin switch
-  *(patch)* - Better keyring integration with proactive availability checks and setup guidance
-  *(patch)* - Fix duplicate entries appearing when switching between databases
-  *(patch)* - Fix stale scan state not clearing after cache reset
-  *(patch)* - Resolutions now persist across sessions
-  *(patch)* - Fix scan results not filtering by source database consistently

## 0.1.1
<sub>2026-06-01</sub>

-  *(minor)* - Anime detail view with watch status tracking
-  *(minor)* - Swap pair indicators in review plan UI
-  *(minor)* - Library browser with grid/list view toggle
-  *(minor)* - Settings view
-  *(minor)* - Review screen with drag-and-drop swap support
-  *(minor)* - Enrichment commands for anime metadata
-  *(minor)* - Scan workflow orchestrator
-  *(patch)* - Correct debug text in AppBar headline and normalize CSS import formatting
