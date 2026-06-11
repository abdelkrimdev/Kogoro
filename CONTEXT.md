# Kogoro

Tool for organizing and renaming anime collections: matching media files against online databases, renaming them, and fetching associated artwork, subtitles, and metadata. Has a CLI and a desktop GUI.

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

**Match**:
The resolution of a **MediaFile** to an **Episode**, produced by parsing the filename and searching **Databases**.
_Avoid_: pairing, identification, result

**Database**:
An external online source of **Anime** and **Episode** data used for matching and enrichment (e.g. AniDB, TVDB).
_Avoid_: provider, source, API

**Override**:
A user-supplied correction to a **Match**, persisted for future scans.
_Avoid_: fixup, correction, edit

**EntryType**:
The category of an **Episode**: TV, Movie, OVA, or Special. Controls directory placement and naming.
_Avoid_: kind, format, category

### Library

**Library**:
The user's organized collection of **Anime** and their **Episodes**, tracked in a derived SQLite database and reflected on disk.
_Avoid_: collection, catalog, inventory

**Library Database**:
A derived SQLite database that aggregates data from on-disk files and the match cache. Rebuildable from source. Stores anime, episodes, and user-specific data (watch status).
_Avoid_: library DB, library.db

**Auto-Merge**:
The process of matching new scan results to existing **Library** entries by **Database** external ID, appending new **Episodes** without creating duplicates.
_Avoid_: dedup, merge, reconciliation

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

### Desktop GUI

**Main Process**:
The Bun runtime process in the Electrobun app that runs core logic, manages windows, and handles RPC.
_Avoid_: backend, server, bun process

**Webview**:
The Svelte-rendered UI process in the Electrobun app, sandboxed from the main process. Communicates via typed RPC.
_Avoid_: frontend, browser, renderer

**Onboarding Wizard**:
The first-launch setup flow in the GUI: select primary **Database**, enter API key (stored in OS keyring), pick template.
_Avoid_: setup flow, first-run experience

## Relationships

- A **MediaFile** matches exactly one **Episode**
- An **Episode** belongs to exactly one **Anime**
- A **Match** may have one or more **Overrides** (user corrections)
- An **Episode** has exactly one **EntryType**
- A **Match** is resolved against one primary **Database**
- A **Library** entry is identified by (external ID, source **Database**) and contains one or more **Episodes**
- The **Scan Workflow** produces a **Rename Plan** that the user approves via the **Review Screen**
- **Auto-Merge** links new **Episodes** to existing **Library** entries without duplicates

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
> **Domain expert:** "No — **Auto-Merge** detects the same **Database** external ID and appends the new **Episodes** to the existing **Library** entry. The **Review Screen** shows 'Adding 12 episodes to existing: Oshi no Ko'."

## Flagged ambiguities

_None yet._
