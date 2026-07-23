# Changelog












## 0.3.0
<sub>2026-07-23</sub>

-  *(minor)* - Override commands promoted to top-level CLI command
-  *(patch)* - Fix library state not updating after episode deletion

## 0.2.9
<sub>2026-06-14</sub>

- *(patch)* Version bump from group with `@kogoro/gui` v0.2.9

## 0.2.8
<sub>2026-06-14</sub>

- *(patch)* Version bump from group with `@kogoro/gui` v0.2.8

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

-  *(minor)* - Scan now handles all files uniformly regardless of prior organization

## 0.1.1
<sub>2026-06-01</sub>

-  *(minor)* - Filename parsing with season/episode extraction
-  *(minor)* - Fuzzy search scoring and matching against AniDB and TVDB databases
-  *(minor)* - Batch scanning with two-pass resolution, progress tracking, and concurrency
-  *(minor)* - Renamer with template-based target paths and directory hierarchy by entry type
-  *(minor)* - Override persistence via `kogoro.toml` for user corrections
-  *(minor)* - SQLite match cache keyed by file hash
-  *(minor)* - Subtitle plugin interface with OpenSubtitles adapter
-  *(minor)* - Metadata writer for Kodi `.nfo` sidecar generation
-  *(minor)* - Artwork fetcher for series poster as `cover.jpg`
-  *(minor)* - Episode numbering conversion (absolute ↔ season-relative) via AniDB metadata
-  *(minor)* - AniDB season metadata parsing from prequel chain
-  *(minor)* - TVDB translations and alternate titles
-  *(minor)* - Configurable secondary database fallback
-  *(minor)* - External plugin instantiation
-  *(minor)* - Debug HTTP logging via `--debug` flag
-  *(minor)* - Rate-limited AniDB through HttpClient with retry and partial rollback
-  *(minor)* - Plugin enable/disable with config-driven disabled set
-  *(minor)* - Named rename presets selectable in wizard and via CLI
-  *(minor)* - NFO metadata enrichment with database-queried details
-  *(minor)* - Batch API call deduplication in Matcher
-  *(minor)* - Interactive scan resolutions persisted as overrides
-  *(minor)* - OS keyring credential storage via `Bun.secrets`
-  *(minor)* - Config and credential system with global config, first-run wizard, and keyring
-  *(minor)* - Template engine with formatting and CLI command
-  *(minor)* - CLI commands: `scan`, `match`, `rename`, `parse`, `config`, `database`, `artwork`, `subtitle`, `metadata`
-  *(minor)* - Standalone binary build support
-  *(patch)* - Handle anidb as built-in primary database in scan
-  *(patch)* - Ensure `getPassword` returns null instead of undefined when secret is missing
