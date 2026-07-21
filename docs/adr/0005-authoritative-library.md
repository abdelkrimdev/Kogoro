# ADR 0005: Authoritative Library

## Status

Accepted

## Context

A prior decision treated the Library Database as **derived, not authoritative** — truth comes from the filesystem and match cache, and the database can be deleted and rebuilt without data loss. This was correct for a file-organizer tool where every library entry originated from an on-disk file.

The product is being re-imagined as an anime library and watchlist manager. Users now import anime from online trackers (MAL, AniList, Kitsu) that may have no corresponding files on disk, set watch statuses (watching, completed, plan to watch, on hold, dropped), and sync bidirectionally with those trackers. The derived model cannot support this:

- **Fileless entries** — "plan to watch" anime imported from a tracker have no `file_path` to key off of
- **User-authored data** — watch statuses and notes are not reconstructible from the filesystem
- **Tracker state** — push/pull reconciliation requires a stable local identity that persists across rebuilds
- **Enriched metadata** — synopsis, rating, and genre data fetched from trackers should persist locally

## Decision

The Library becomes the **authoritative system of record** at runtime. It is still rebuildable — not from files alone, but from three sources:

1. **On-disk files** + match cache (as before)
2. **Connected tracker data** (watch statuses, group structure, enriched metadata)
3. **The event log** is replayed over the rebuilt data to restore post-import local mutations

On rebuild: files are scanned to confirm which episodes exist on disk, tracker data is re-imported to restore group structure and metadata, and the event log is replayed to restore local mutations made since the last tracker sync. The rebuild produces the same authoritative state that existed before.

The key shift: the Library is no longer a disposable cache. It is the primary data store. Files and trackers are inputs, not the source of truth.

## Trade-offs

- **Complexity increase** — rebuild requires tracker connectivity and event log replay, not just a filesystem walk. A rebuild with no network access will produce degraded data (missing tracker metadata) rather than a complete library.
- **Schema migration burden** — since the database is no longer disposable, schema changes must be proper migrations (already established in ADR 0004 with Drizzle).
- **UX cost at scale** — a full rebuild with hundreds of tracker entries requires multiple API calls and is no longer instant. The "rebuild library" button must communicate this to the user.
- **Reverses a prior decision** — the derived model (library as disposable cache, filesystem as truth) was simpler and appropriate for the file-organizer phase. The authoritative model is required for the library-manager phase. Concerns about "sync drift" are now handled by the Sync Engine and bidirectional tracker reconciliation rather than by database disposability.
