# Tracker import matching and grouping

Tracker import uses AniList's structured relation graph instead of regex-based title parsing for three tasks: grouping imported entries, matching tracker entries to library anime, and deriving season numbers.

## Import-time relation grouping

During `confirmImport`, newly imported entries are grouped into clusters using a union-find algorithm over AniList relations (SEQUEL, PREQUEL, SIDE_STORY, SUMMARY, PARENT). This is distinct from the enrichment-time BFS walk (ADR 0015): import-time grouping operates on the batch being imported, while enrichment-time grouping walks the full library.

## Relation-graph matching

Matching tracker entries to library anime uses the AniList relation graph. For each tracker entry, the system traverses SEQUEL/PREQUEL links from the enrichment cache to build a set of all AniList IDs in the same franchise. The entry matches a library anime if the anime's AniList ID appears in this set. When no enrichment data is available, matching falls back to exact title comparison.

## Season numbering from SEQUEL chain

Season numbers are derived from the SEQUEL chain rather than regex parsing of titles. The system finds the PREQUEL chain root, then walks SEQUEL links forward assigning 1, 2, 3… This replaces the old regex which matched `season`, `part`, and `cour` keywords in title strings.
