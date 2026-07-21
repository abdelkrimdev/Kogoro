# ADR 0006: Episode Groups as Explicit Domain Concept

## Status

Accepted

## Context

The current data model is a flat two-level hierarchy: `Anime → Episode`. Episodes have a `season` column (nullable integer) and each episode row carries `anime_id`, `episode_number`, `season`, `file_path`, `title`, and a 1:1 `watch_status` with `watched: boolean`.

Online trackers (MAL, AniList, Kitsu) model anime differently: each season, movie, and OVA is a separate entry with its own ID, synopsis, rating, and watch status. For example, "One Piece" on MAL has separate entries for Season 1 (ID 21), Season 2 (ID 467), Movie 10 (ID 21755), etc.

The flat model creates several problems:

- **Tracker mapping** — there is no place to store "MAL ID 467 maps to One Piece Season 2." The anime-level `(external_id, source_db)` unique constraint forces one ID per anime, but a single anime must map to multiple tracker entries.
- **Per-season watch status** — a user who has completed Season 1 but is still watching Season 2 needs two independent statuses, but the flat model only has episode-level `watched` and no group-level status.
- **Per-season metadata** — MAL provides separate synopses and ratings for each season. Storing these at the anime level blurs information.
- **EntryType lives at the wrong level** — today `EntryType` is on individual episodes. But a season 2 movie is a movie group, not a collection of individually-classified episodes.

## Decision

Introduce **Episode Group** as an explicit domain concept between Anime and Episode:

```
Anime → Episode Group → Episode
```

An Episode Group is identified by `(anime_id, entry_type, season_number)`. Examples:

| Anime | Episode Group | EntryType | Season | Contains |
|-------|---------------|-----------|--------|----------|
| One Piece | Season 1 | TV | 1 | Episodes 1–61 |
| One Piece | Season 2 | TV | 2 | Episodes 62–... |
| One Piece | Movie 10 | Movie | null | A single movie episode |
| Jujutsu Kaisen | Season 1 | TV | 1 | Episodes 1–24 |
| Jujutsu Kaisen | Movie 0 | Movie | null | A single movie episode |

### What moves to the group level

| Concept | Formerly | Now |
|---------|----------|-----|
| `EntryType` | On each episode | On the group |
| Watch status (watching/completed/etc.) | Did not exist | On the group |
| Tracker mappings (MAL/AniList/Kitsu IDs) | Anime-level, single ID | Group-level, multiple tracker IDs |
| Synopsis, rating | Did not exist | On the group |
| Cover art | Anime-level | Group-level |

### What stays at the episode level

| Concept | Location |
|---------|----------|
| `watched` boolean | Episode |
| `file_path` | Episode |
| `episode_number` (relative within group) | Episode |
| `title` | Episode |

### What moves to the anime level

| Concept | Location |
|---------|----------|
| Genres | Anime |
| `EntryType` | Removed from anime entirely — derived from groups |

### Schema implications

New tables:
- `episode_groups(anime_id, entry_type, season_number, watch_status, synopsis, rating, cover_art_path, ...)`
- `group_tracker_mappings(group_id, source, external_id)`

Modified tables:
- `episodes`: add `group_id` FK, drop `entry_type`, keep `season` for display convenience
- `anime`: drop `entry_type`, add `genres` (JSON), add `library_state` (on_disk/partial/not_on_disk)
- `watch_status` table: removed (replaced by group-level status + episode-level watched)

The new `events` database stores append-only event logs per group and per episode for sync replay.

### Scan workflow interaction

During auto-merge, new scanned episodes are placed into groups by matching season + entry type against existing groups. If no matching group exists, one is created.

## Trade-offs

- **Schema complexity** — three-level hierarchy instead of two-level flat; an extra join for queries that span episodes. The flat model was simpler but could not express tracker-mapped per-season data.
- **Migration is a clean break** — the old schema cannot be incrementally migrated to the new one. Old databases are abandoned; users rebuild from files + re-import trackers. This is acceptable because the product is pre-1.0 with no stable API contract.
- **Season-less anime** — some anime have no seasons (standalone movies, single-season series). These still get an Episode Group with `season_number = 1` or `null`. The concept of "one group per anime" remains valid.
- **Episode renumbering** — episodes are numbered relative to their group (Season 2, Episode 1), not absolute across the anime. This matches user expectations and tracker conventions but differs from the configurable absolute/relative numbering in today's scan workflow. The scan workflow's `episode-numbering` config option applies to filename parsing, not library storage.
