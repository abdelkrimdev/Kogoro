# Kogoro

Tool for organizing and renaming anime collections, managing the user's anime library and watchlist, and syncing with online trackers (MAL, AniList, Kitsu). Matches media files against online databases, renames them, fetches artwork and metadata, and enriches the library with synopsis, rating, and genre data. Has a CLI and a desktop GUI.

## Language

### Core domain

**MediaFile**:
A video file on disk that contains an anime episode, movie, OVA, or special.
_Avoid_: EpisodeFile, AnimeFile, video file

**Episode**:
A numbered entry within an anime series, covering regular episodes, movies, OVAs, and specials.
_Avoid_: chapter, entry, part

**Franchise**:
A group of related **Anime** connected by sequel, prequel, side story, summary, or parent relations (e.g. "One Piece" franchise contains seasons, movies, and OVAs). Top-level entry in the **Library**. Derived automatically from AniList relation data.
_Avoid_: franchise group, anime franchise, series group

**Anime**:
A single series or entry within a **Franchise** (e.g. "One Piece Season 1"). Canonically identified by its **AniList ID**. Multiple **Source References** (from **Databases** and **Trackers**) are stored as mappings on the same record, eliminating duplicates by construction — scan and import converge on the same **Anime** when they refer to the same show.
_Avoid_: show, series, title, franchise

**Episode Group**:
A subdivision of an **Anime** — a season, movie, OVA, or special arc — that has its own watch status, tracker mappings, and enriched metadata. Identified by (anime, entry type, season number).
_Avoid_: season group, arc, sub-entry

**EntryType**:
The category of an **Episode Group**: TV, Movie, OVA, or Special. Controls directory placement, naming, and grouping.
_Avoid_: kind, format, category

**Match**:
The resolution of a **MediaFile** to an **Episode**, produced by parsing the filename and searching **Databases**.
_Avoid_: pairing, identification, result

**Database**:
An external online source of **Anime** and **Episode** data used for matching and enrichment (e.g. AniDB, TVDB).
_Avoid_: provider, source, API

**Tracker**:
An online anime list service (MAL, AniList, Kitsu) for importing, syncing, and enriching the user's library with watch status, synopsis, rating, and genre data.
_Avoid_: list service, tracker service

**Override**:
A user-supplied correction to a **Match**, persisted for future scans.
_Avoid_: fixup, correction, edit

### Library

**Library**:
The central hub for managing the user's organized collection of **Franchises**, **Anime**, **Episode Groups**, and watchlist — rebuilt from on-disk files, the match cache, and connected **Trackers**. Authoritative at runtime. **Franchise** is the top-level entry visible to the user.
_Avoid_: collection, catalog, inventory

**Library Database**:
An SQLite database that stores the user's library: anime, episode groups, episodes, watch status, tracker mappings, and enriched metadata. Rebuildable from on-disk files, match cache, and tracker data.
_Avoid_: library DB, library.db

**Library State**:
Derived per-anime status indicating file availability: **on disk** (all groups have at least one file), **partially on disk** (some groups have files), or **not on disk** (no files exist). Cached and recomputed on scan, file deletion, and rebuild.
_Avoid_: disk status, file presence

**Watch Status**:
A per-**Episode Group** status indicating the user's viewing progress: watching, completed, plan to watch, on hold, or dropped. Each **Episode** also has an independent `watched` boolean.
_Avoid_: viewing state, progress state

**Alternative Titles**:
A collection of title variants for an **Anime** (e.g. English, Japanese, synonyms). Used for matching **Tracker** entries against **Library** entries, and for display. Populated by both **Tracker** imports and **Database** matches.
_Avoid_: alt titles, alternative names, synonyms

**Auto-Merge**:
The process of resolving scan or import results to an **AniList ID**, then finding or creating the canonical **Anime** record and appending new **Episode Groups** and **Episodes** without creating duplicates. Used identically by both the scan and import pipelines.
_Avoid_: dedup, merge, reconciliation

**Source Reference**:
A mapping from an **Anime** to an external identifier from a **Database** or **Tracker** (e.g. TVDB ID 12345, MAL ID 67890). Stored in the `anime_source_mappings` table. An **Anime** may have multiple **Source References** — one per source.
_Avoid_: external ID mapping, source link, cross-reference

**Pending Identification**:
A temporary state for an **Anime** whose **AniList ID** could not be resolved (e.g. AniList API unavailable). The **Anime** is created with a synthetic UUID and shown with a "pending identification" badge. A background process retries **Enrichment** periodically until resolved.
_Avoid_: unidentified anime, temp ID, unresolved

### Sync

**Sync**:
Bidirectional reconciliation between Kogoro's local library and a connected **Tracker**. Pulls remote changes first (akin to `git pull`), compares against local state and pending **Event Log** entries, then pushes local changes.
_Avoid_: import, export, refresh

**Sync Engine**:
The core domain service that orchestrates **Sync**: detecting local and remote changes, presenting conflicts, and applying reconciled state. Lives in `packages/core`.
_Avoid_: sync service, reconciliation engine

**Event Log**:
An append-only record of local mutations (status changes, episode watched toggles, notes updates) stored in a separate `events.db` SQLite database. Used by the **Sync Engine** to replay and push changes to **Trackers**. Not used during rebuild.
_Avoid_: change log, mutation log, history

### Scan workflow

**Scan Workflow**:
The four-phase process in the GUI: Scan (parse + match), Plan (generate rename proposals), Review (user inspects and approves), Execute (perform renames).
_Avoid_: scan process, scan pipeline

**Rename Plan**:
The set of proposed file operations generated during the Plan phase, shown to the user for approval before any files are touched.
_Avoid_: operation list, pending renames

**Review Screen**:
The GUI view where users inspect the **Rename Plan**, resolve ambiguous matches via drag-and-drop swap, and approve or reject operations.
_Avoid_: confirmation screen, preview

**Swap**:
A drag-and-drop operation in the **Review Screen** that corrects episode transposition — when two files have been matched to each other's episodes.
_Avoid_: reorder, rearrange, drag-reassign

**ScanGroup**:
A transient grouping of files by **Anime** title during the **Review Screen**, containing pending **FileRow** operations. Not to be confused with **Episode Group**, which is a persistent library concept.
_Avoid_: anime group, file group

### Desktop GUI

**Main Process**:
The Bun runtime process in the Electrobun app that runs core logic, manages windows, and handles RPC.
_Avoid_: backend, server, bun process

**Webview**:
The Svelte-rendered UI process in the Electrobun app, sandboxed from the main process. Communicates via typed RPC.
_Avoid_: frontend, browser, renderer

**Dashboard**:
The home screen of the GUI, showing an overview of the user's library: currently watching section with progress, library stats, quick actions, and next unwatched episodes.
_Avoid_: home screen, landing page

**Onboarding Wizard**:
The first-launch setup flow in the GUI: select primary **Database**, enter API key (stored in OS keyring), pick template, and optionally connect a **Tracker**.
_Avoid_: setup flow, first-run experience

### Plugin system

**TrackerPlugin**:
A plugin type for connecting Kogoro to a **Tracker** (MAL, AniList, Kitsu). Implements `authenticate()`, `getUserList()`, `getEntry()`, `updateEntry()`, and `getAnimeDetails()`. Distinct from **DatabasePlugin**, **SubtitlePlugin**, and **EnrichmentProvider**.
_Avoid_: tracker integration, list plugin

**EnrichmentProvider**:
A plugin type for fetching anime metadata and relation data from external sources (e.g. AniList). Implements `searchByTitle()` and `getMediaDetailsBatch()`. Used during **Auto-Merge** to discover **Franchise** relationships and cross-reference **Anime** across **Databases** and **Trackers**. Distinct from **TrackerPlugin**.
_Avoid_: enrichment plugin, metadata provider

## Relationships

- A **Franchise** contains one or more **Anime**
- A **MediaFile** matches exactly one **Episode**
- An **Episode** belongs to exactly one **Episode Group**
- An **Episode Group** belongs to exactly one **Anime**
- An **Episode Group** has exactly one **EntryType**
- An **Episode Group** has exactly one **Watch Status** (watching, completed, plan to watch, on hold, dropped)
- An **Episode** has an independent `watched` boolean
- An **Anime** has exactly one derived **Library State** (on disk, partially on disk, not on disk)
- An **Anime** belongs to zero or one **Franchise**
- An **Anime** may be mapped to zero or more **Source References** — one per **Database** or **Tracker** — for cross-source deduplication
- A **Match** may have one or more **Overrides** (user corrections)
- A **Match** is resolved against one primary **Database**, then cross-referenced to an **AniList ID** via the **EnrichmentProvider** before being merged into the **Library**
- A **Library** entry is identified by its **AniList ID** (canonical), with zero or more **Source References** to **Databases** and **Trackers**
- An **Anime** has exactly one canonical **romaji** title and zero or more **Alternative Titles**
- An **Episode Group** may be mapped to zero or more **Tracker** entries via `group_tracker_mappings`
- The **Scan Workflow** produces a **Rename Plan** that the user approves via the **Review Screen**
- **Auto-Merge** links new scan or import results to existing **Library** entries by **AniList ID**, creating new **Episode Groups** and **Episodes** under the canonical **Anime** without duplicates
- **Auto-Merge** resolves structural conflicts by letting the **Database** win on **EntryType** and season numbers, while preserving **Tracker** metadata (watch status, mappings) from import
- **Auto-Merge** enriches new **Anime** via an **EnrichmentProvider** to discover **Franchise** relationships
- The **Sync Engine** reconciles local state with remote tracker data, using the **Event Log** for pending local changes
- The **Library** is rebuildable from on-disk files, the match cache, and connected tracker data

## Example dialogue

> **Dev:** "When a **MediaFile** has no episode number in the filename, does Kogoro assume it's a Movie?"
> **Domain expert:** "It searches across all **EntryTypes** — not just Movies. A TV Special with no number would still be found."
>
> **Dev:** "And if the primary **Database** returns something the user disagrees with?"
> **Domain expert:** "The user creates an **Override** — changing the **Episode**, the **Anime**, or the **EntryType**. That persists in `kogoro.toml` so future scans respect it."
>
> **Dev:** "What if two **MediaFiles** resolve to the same **Episode**?"
> **Domain expert:** "Kogoro appends a disambiguator to the filename — extracted metadata tags from the original filename — so both files coexist."
>
> **Dev:** "I scan with TVDB, then switch to AniDB. What happens to my existing library?"
> **Domain expert:** "Both scans resolve to the same **AniList ID**. The **Anime** record already exists, so the AniDB scan adds a second **Source Reference** and upserts **Episodes**. If TVDB and AniDB disagree on season numbers, the new scan's structure wins — episodes shift to the correct **Episode Group**. Empty groups without tracker data are cleaned up automatically."
>
> **Dev:** "I organize Season 1 and 2, then download Season 3. Does the scan create a duplicate?"
> **Domain expert:** "No — **Auto-Merge** detects the same **AniList ID** and appends the new **Episodes** to the existing **Episode Group**. The **Review Screen** shows 'Adding 12 episodes to existing: Oshi no Ko Season 3'."
>
> **Dev:** "I imported One Piece from MAL as plan to watch with no files. Then I download and scan Season 1. What happens?"
> **Domain expert:** "The **Library State** transitions from not on disk to partially on disk. The Season 1 **Episode Group** keeps its MAL tracker mapping and imported metadata. The watch status stays as plan to watch — having files doesn't change it. The detail page shows '24 episodes, 24 on disk, 0 watched'."
>
> **Dev:** "MAL says I'm watching One Piece but anilist says I completed it. Which one does Kogoro use?"
> **Domain expert:** "Kogoro is the hub. When you first connect both trackers, Kogoro shows a preview and asks you to resolve conflicts. After that, Kogoro's local state is the reconciled truth and gets pushed to both trackers."
>
> **Dev:** "Can I mark One Piece Season 1 as completed while Season 2 is still watching?"
> **Domain expert:** "Yes. Each **Episode Group** has its own watch status. You can have Season 1 completed, Season 2 watching, and Movie 10 plan to watch — all under the same One Piece **Anime**."
>
> **Dev:** "What happens if I disconnect a tracker?"
> **Domain expert:** "Kogoro owns all data once imported. The tracker mapping rows are cleaned up and pending events for that tracker are dropped, but everything else — anime, groups, episodes, watch statuses, enriched metadata — stays in your library."
>
> **Dev:** "I scan One Piece Season 1 with AniDB. How does Kogoro know it's part of the One Piece franchise?"
> **Domain expert:** "The scan resolves the match to **AniList ID** 21 via title search, creating the canonical **Anime** record. Then **Auto-Merge** calls the **EnrichmentProvider** to walk the AniList relation graph — sequels, movies, OVAs. It finds the connected component and creates a **Franchise** containing all related **Anime**. The scan result appears as 'One Piece' in the library, not as a separate entry."
>
> **Dev:** "I scan One Piece with AniDB, then later import it from AniList. Are those two separate entries?"
> **Domain expert:** "No. Both resolve to AniList ID 21. The **Anime** record was created by the scan with a **Source Reference** to AniDB. When the AniList import runs, it finds the same AniList ID and merges into the existing record — adding the AniList tracker mapping. One entry in the library, two source references, no merge operation needed."
>
> **Dev:** "What if AniList is down during a scan?"
> **Domain expert:** "Enrichment fails silently. The anime is created with a **Pending Identification** badge — a synthetic UUID stands in for the AniList ID. A background process retries enrichment periodically. When AniList comes back, the UUID is replaced with the real AniList ID and the anime merges into any existing canon."
>
> **Dev:** "I import One Piece from MAL (plan to watch, no files). Then I scan my One Piece Season 1 files with TVDB. Do I get two One Piece entries?"
> **Domain expert:** "No. The TVDB scan cross-references to AniList ID 21 via title search. The existing MAL import resolved to the same AniList ID. The scan merges into the existing **Anime** record — adding the TVDB **Source Reference** and creating file-backed **Episodes** under the Season 1 **Episode Group**. The group keeps its MAL tracker mapping and plan-to-watch status from the import. One entry in the library, two source references."

## Flagged ambiguities

_None yet._
