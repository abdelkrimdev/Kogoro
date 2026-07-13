# Merge cross-source anime into single records

When the enrichment process discovers that an AniDB anime and an AniList anime are the same show (via AniList external links or relation graph), they are merged into a single Anime record. The surviving anime keeps its Database external ID (AniDB/TVDB) as its primary identity. The AniList ID is stored in a separate `anime_tracker_mappings` table as a tracker cross-reference. Episode groups, episodes, watch statuses, and tracker mappings from both records are consolidated into the surviving anime.

## Considered Options

- **Keep separate, group under franchise** — Two anime records, both in the same Franchise. Rejected: confusing for users to see duplicate entries for the same show.
- **Primary + alias** — One anime is primary, the other becomes an alias contributing metadata. Rejected: adds complexity without clear benefit over merging.
- **Merge into one** — Consolidate into a single anime record. Chosen: cleanest UX, one entry per show.

## Consequences

- The anime's `(externalId, sourceDb)` identity comes from the Database source (AniDB/TVDB).
- Tracker IDs (AniList, MAL, Kitsu) live in `anime_tracker_mappings`, not on the anime table.
- Merge logic must handle episode group deduplication by `(animeId, entryType, seasonNumber)`.
- Watch status and notes are preserved during merge (survivor's status wins on conflict).
- The merge is irreversible in the current design — no "unmerge" operation exists.
