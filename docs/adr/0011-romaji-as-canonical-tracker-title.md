# ADR 0011: Romaji as Canonical Tracker Title

## Status

Accepted

## Context

Tracker plugins (AniList, MAL, Kitsu) return anime titles in different languages:

| Tracker | Current main title | Available alternatives |
|---------|-------------------|----------------------|
| AniList | `title.romaji` | `title.english`, `title.native`, `synonyms` |
| MAL | `title` (always romaji) | `alternative_titles.en`, `alternative_titles.ja` |
| Kitsu | `canonicalTitle` (varies by user setting) | `titles.en`, `titles.en_jp`, `titles.ja_jp`, `abbreviatedTitles` |

This creates inconsistency when the same anime is imported from different trackers. A user with both AniList and Kitsu connected might see "Boku no Hero Academia" from one and "My Hero Academia" from the other.

Meanwhile, the library's `anime.title` field has its own inconsistency:
- TVDB populates it with **English** titles (e.g., "My Hero Academia")
- AniDB populates it with **romaji** titles (e.g., "Boku no Hero Academia") despite the field being named `titleEn`
- Tracker imports populate it with **romaji** titles (AniList/MAL) or **canonical** titles (Kitsu)

The `anime.titleJapanese` column exists in the schema but is **never populated** by any code path.

## Decision

**Normalize all tracker plugins to return romaji as the canonical main title.**

English and other title variants are stored in a new `alternativeTitles` JSON column on the `anime` table.

### Tracker plugin behavior

All three tracker plugins will:

1. Return **romaji** as `title`:
   - AniList: `title.romaji`
   - MAL: `title` (already romaji)
   - Kitsu: `titles.en_jp` (English of Japanese title, i.e., romaji)

2. Return **all available variants** in `alternativeTitles`:
   - AniList: `title.english`, `title.native`, and `synonyms`
   - MAL: `alternative_titles.en` and `alternative_titles.ja`
   - Kitsu: `titles.en`, `titles.ja_jp`, and `abbreviatedTitles`

### Library schema changes

- **Add** `alternativeTitles` column (JSON array of strings) to the `anime` table
- **Remove** `titleJapanese` column from the `anime` table

### Title population

Both tracker imports and database matches populate `alternativeTitles`:

- **Tracker imports**: Store all available title variants from the tracker API
- **Database matches (TVDB/AniDB)**: Store English title and any Japanese variants returned by the database plugin

### Sync engine updates

The sync engine updates `alternativeTitles` when pulling anime details from trackers, ensuring title data stays fresh.

### Matching logic

The `titlesMatch` function in `tracker-utils.ts` is updated to:

1. Compare `anime.title` against the target title
2. Iterate through `anime.alternativeTitles` for fallback matching
3. Remove the `titleJapanese` check entirely

## Rationale

**Why romaji over English?**

- Romaji is available from all three tracker APIs (AniList, MAL, Kitsu)
- English is not always available (MAL may lack `alternative_titles.en` for some anime)
- Romaji is the common denominator that works regardless of which tracker is the source
- By using romaji as the canonical title, matching works whether the library was populated by TVDB (English) or AniDB (romaji)

**Why not English?**

- English is not consistently available across all trackers
- Kitsu's `canonicalTitle` can vary based on user language settings
- MAL's `alternative_titles.en` is not always present
- Using English would require fallback logic for anime without English titles

**Why persist alternative titles?**

- Ensures matching works even after tracker disconnection
- Provides richer title data for display and search
- Enables matching across different primary databases (TVDB vs AniDB)

## Trade-offs

- **Romaji display** — Users see romaji titles in the UI instead of English. This is acceptable because romaji is the standard in anime communities and matches the naming conventions used by the trackers themselves.
- **Schema migration** — Removing `titleJapanese` and adding `alternativeTitles` requires a migration. Since `titleJapanese` was never populated, no data is lost.
- **Plugin interface change** — All three tracker plugins must be updated to normalize titles. This is a one-time change that establishes consistent behavior.
- **Matching complexity** — The `titlesMatch` function now iterates through alternative titles instead of checking a single field. This is a minor performance cost but provides more robust matching.
