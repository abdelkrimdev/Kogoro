# Changelog

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
