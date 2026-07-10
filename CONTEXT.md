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

**Anime**:
The series or franchise that episodes belong to (e.g. "Jujutsu Kaisen").
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
The central hub for managing the user's organized collection of **Anime**, their **Episode Groups**, and watchlist — rebuilt from on-disk files, the match cache, and connected **Trackers**. Authoritative at runtime.
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
The process of matching new scan results to existing **Library** entries by **Database** external ID, appending new **Episodes** to existing **Episode Groups** without creating duplicates.
_Avoid_: dedup, merge, reconciliation

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
A plugin type for connecting Kogoro to a **Tracker** (MAL, AniList, Kitsu). Implements `authenticate()`, `getUserList()`, `getEntry()`, `updateEntry()`, and `getAnimeDetails()`. Distinct from **DatabasePlugin** and **SubtitlePlugin**.
_Avoid_: tracker integration, list plugin

## Relationships

- A **MediaFile** matches exactly one **Episode**
- An **Episode** belongs to exactly one **Episode Group**
- An **Episode Group** belongs to exactly one **Anime**
- An **Episode Group** has exactly one **EntryType**
- An **Episode Group** has exactly one **Watch Status** (watching, completed, plan to watch, on hold, dropped)
- An **Episode** has an independent `watched` boolean
- An **Anime** has exactly one derived **Library State** (on disk, partially on disk, not on disk)
- A **Match** may have one or more **Overrides** (user corrections)
- A **Match** is resolved against one primary **Database**
- A **Library** entry is identified by (external ID, source **Database**)
- An **Anime** has exactly one canonical **romaji** title and zero or more **Alternative Titles**
- An **Episode Group** may be mapped to zero or more **Tracker** entries via `group_tracker_mappings`
- The **Scan Workflow** produces a **Rename Plan** that the user approves via the **Review Screen**
- **Auto-Merge** links new **Episodes** to existing **Episode Groups** without duplicates
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
> **Domain expert:** "**Auto-Merge** matches by (external ID, source **Database**). TVDB and AniDB entries coexist. New files scanned with AniDB get their own **Library** entry. Existing TVDB entries stay untouched."
>
> **Dev:** "I organize Season 1 and 2, then download Season 3. Does the scan create a duplicate?"
> **Domain expert:** "No — **Auto-Merge** detects the same **Database** external ID and appends the new **Episodes** to the existing **Episode Group**. The **Review Screen** shows 'Adding 12 episodes to existing: Oshi no Ko Season 3'."
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

## Flagged ambiguities

_None yet._
