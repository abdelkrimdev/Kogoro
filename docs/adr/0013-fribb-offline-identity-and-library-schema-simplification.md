# Fribb offline identity and library schema simplification

Canonical anime identity switches from AniList Media ID to AniDB ID, resolved offline via [Fribb/anime-lists](https://github.com/Fribb/anime-lists) — a weekly-generated cross-reference dataset that merges manami-project (AniDB/AniList/MAL/Kitsu) with Anime-Lists (TVDB/TMDB/IMDB) on the common AniDB key. This makes scanning fully offline, eliminates the `anilist_cache` table, and drops redundant and derived columns. Supersedes ADR 0012.

## Considered Options

- **AniList API as canonical (ADR 0012)** — Runtime identity resolution via AniList GraphQL. Rejected: no TVDB → AniList bridge, requires network for every scan, produces `temp:` UUID hack for pending identification, stores AniList ID in two places (`anime.anilist_id` + `anime_source_mappings`).
- **manami-project/anime-offline-database** — Static JSON cross-reference dataset. Rejected: archived July 2026, no TVDB/TMDB IDs, 62 MB JSON parse per cold start.
- **Fribb/anime-lists** — Wraps manami + Anime-Lists XML into a unified dataset with TVDB/TMDB/IMDB IDs, pre-built O(1) lookup indices, and pre-computed franchise collections. Chosen: ~7 MB, weekly updates, full offline identity resolution from any source ID.

## Consequences

- `anime.anidb_id` (UNIQUE, nullable) replaces `anime.anilist_id` as canonical key. Nullable for tracker-only entries not yet in Fribb. Auto-increment integer PK retained for uniform FK references.
- `anilist_cache` table dropped. Franchise discovery is now offline via Fribb `collections/`. Identity cross-referencing is offline via Fribb `indices/`. Runtime AniList API calls only for per-entry metadata enrichment (synopsis, rating, cover art) — written directly to domain tables.
- `anime_source_mappings` narrowed: uniqueness on `(anime_id, source)` instead of `(source, external_id)`. One anime has one ID per source. Multiple anime can share the same external ID (e.g., One Piece TV seasons all connect to MAL ID 21). Simpler than ADR 0012's decoupled identity model.
- `genres`, `episode_count`, and `library_state` dropped from `anime`. Counts and state are derived at query time — no maintenance code, no stale data.
- `last_synced` replaced with `updated_at` on `anime`, `episode_groups`, and `franchises`. One timestamp per record.
- `episodes.season` and `episodes.anime_id` dropped. Season is already on `episode_groups`. Anime is reachable via `group_id` join. Unique constraint becomes `(group_id, episode_number)`.
- `synopsis` retained on `episode_groups` only: different seasons/movies within the same anime carry distinct synopses from tracker enrichment (e.g., One Piece S1 describes East Blue, S2 describes Alabasta).
- ADR 0010 (AniList relation BFS) is partially affected: franchise discovery shifts from runtime AniList graph walking to offline Fribb collections.
