# Changelog

## 0.1.1
<sub>2026-06-01</sub>

First public release of Kogoro — an anime media organizer powered by AI database matching.

### Features
- Filename parsing with season/episode extraction
- Fuzzy search scoring and matching against AniDB and TVDB databases
- Batch scanning with two-pass resolution, progress tracking, and concurrency
- Renamer with template-based target paths and directory hierarchy by entry type
- Override persistence via `kogoro.toml` for user corrections
- SQLite match cache keyed by file hash
- Subtitle plugin interface with OpenSubtitles adapter
- Metadata writer for Kodi `.nfo` sidecar generation
- Artwork fetcher for series poster as `cover.jpg`
- Episode numbering conversion (absolute ↔ season-relative) via AniDB metadata
- AniDB season metadata parsing from prequel chain
- TVDB translations and alternate titles
- Configurable secondary database fallback
- External plugin instantiation
- Debug HTTP logging via `--debug` flag
- Rate-limited AniDB through HttpClient with retry and partial rollback
- Plugin enable/disable with config-driven disabled set
- Named rename presets selectable in wizard and via CLI
- NFO metadata enrichment with database-queried details
- Batch API call deduplication in Matcher
- Interactive scan resolutions persisted as overrides
- OS keyring credential storage via `Bun.secrets`
- Config and credential system with global config, first-run wizard, and keyring
- Template engine with formatting and CLI command
- CLI commands: `scan`, `match`, `rename`, `parse`, `config`, `database`, `artwork`, `subtitle`, `metadata`
- Standalone binary build support

### Bug fixes
- Handle anidb as built-in primary database in scan
- Ensure `getPassword` returns null instead of undefined when secret is missing
- Correct import statements in CSS and HTML files
- Fix debug text in AppBar headline

### Refactoring
- Migrate GUI from imperative DOM to Svelte components
- Build webview with Vite instead of Electrobun views
- Migrate to Skeleton UI components and Lucide icons
- Restructure single-package repo into monorepo
- Extract shared DirectoryWalker module
- Consolidate MatchResult builders into matcher.ts
- Introduce PluginFactory to consolidate plugin construction
- Make Scanner and Matcher injectable
- Decompose `Scanner.cacheAndPlan` into focused methods
- Extract AniDBTitleCache and shared XML helpers
- Replace `createMockDb` with `createArtworkDb` for test consistency
- Centralize test fixtures in `src/fixtures.ts`

### Testing
- 616 tests across 46 files
- Unit tests for parser, matcher, scanner, renamer, and all plugins
- CLI command integration tests
- Scan workflow end-to-end tests
