# Connected component grouping via AniList relations

Anime are grouped into Franchises by walking the AniList relation graph. Starting from a newly added anime, the enrichment service searches AniList by title, then performs a BFS walk of the relation graph using five relation types: SEQUEL, PREQUEL, SIDE_STORY, SUMMARY, and PARENT. All anime in the connected component belong to the same Franchise. There is no depth limit — the walk continues until all reachable nodes are visited. Results are cached per AniList media ID to avoid redundant API calls.

## Considered Options

- **Strict parent/child only** — Only use PARENT/CHILD relations. Rejected: many franchises lack proper parent metadata on AniList.
- **Transitive chain with depth limit** — Walk SEQUEL/PREQUEL chains with a configurable depth cap. Rejected: risks incomplete franchises for long-running series (One Piece, Naruto).
- **Connected component (all relation types)** — Treat the entire connected graph as one franchise. Rejected: risks over-grouping unrelated anime (e.g., all Gundam series).
- **Connected component (whitelisted relation types)** — Use SEQUEL, PREQUEL, SIDE_STORY, SUMMARY, PARENT. Excludes SPIN_OFF, ALTERNATIVE, CHILD. Chosen: balances completeness with precision. SPIN_OFF and ALTERNATIVE are excluded to avoid grouping unrelated spin-offs.

## Consequences

- The BFS walk may trigger multiple `getMediaDetailsBatch()` calls per anime (one per BFS layer).
- AniList cache table stores fetched data to prevent re-fetching on subsequent scans.
- Franchise membership is the implicit "enriched" status — anime without a franchise assignment are retried on next scan.
- Long-running franchises (10+ hops) will take more API calls on first enrichment, but subsequent scans use cached data.
- If AniList is down during enrichment, the anime stays unfranchised and is retried later.
