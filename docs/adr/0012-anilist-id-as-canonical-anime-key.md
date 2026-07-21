# AniList ID as canonical anime key

Anime identity shifts from `(externalId, sourceDb)` to the AniList Media ID. This unifies scan and import into a single anime-creation path: both operations resolve to an AniList ID, then find-or-create the canonical anime record. Source references (TVDB, AniDB, MAL, Kitsu, AniList) are stored as mappings on the anime, not as the anime's primary identity.

## Considered Options

- **Keep `(externalId, sourceDb)` as PK, share merge logic** — Both paths create separate records, then run the same cross-source merge from enrichment. Rejected: still produces duplicates in the interim; `deleteAnimeFromOtherSourceDbs` in the scan path destroys tracker-imported data.
- **UUID-based with deferred merge** — Every new operation creates an anime with a UUID; a background process merges duplicates via enrichment. Rejected: duplicates exist until merge runs, confusing the user.
- **AniList ID as canonical** — One anime per AniList Media ID. Operations resolve to AniList first, then merge into the existing record. Chosen: eliminates duplicates by construction, makes scan and import converge on the same record.

## Consequences

- Anime table gains a `anilist_id UNIQUE` column; `(externalId, sourceDb)` constraint is removed. Source references move to `anime_source_mappings`.
- Both scan and import must resolve AniList IDs before creating or merging anime. Cross-referencing uses title search against AniList API with local cache (`anilist_cache`, `anime_source_mappings`).
- When AniList is unavailable and an anime's ID can't be resolved from cache, the anime is created with a temporary UUID and a "pending identification" badge. A background task retries enrichment periodically.
- `deleteAnimeFromOtherSourceDbs` is removed — scan no longer deletes tracker-created anime.
- `groupNewEntriesByRelations` (import-time clustering) is removed — entries resolving to the same AniList ID merge naturally without pre-clustering.
- Conflict resolution: when scan and import contribute to the same episode group, scan wins on structure (entryType, seasonNumber from the database) and import wins on metadata (watch status, tracker mappings preserved).
- Empty episode groups are cleaned up only when they have no tracker mappings and default watch status.
- Rebuild becomes two-phase: Phase 1 scans files and rebuilds file-backed entries by AniList ID; Phase 2 re-imports from all connected trackers to restore metadata-only entries.
