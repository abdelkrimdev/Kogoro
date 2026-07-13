# AniList EnrichmentProvider interface

Enrichment (fetching anime relations and cross-source IDs from AniList) is implemented as a separate plugin interface — `EnrichmentProvider` — rather than extending the existing `TrackerPlugin` interface. The enrichment service lives in `packages/core` and depends on the provider interface. An `AniListEnrichmentProvider` in `packages/plugins` implements it using AniList's GraphQL API.

## Considered Options

- **Extend TrackerPlugin** — Add `getRelations()` and `searchByTitle()` to the existing TrackerPlugin interface. Rejected: conflates two different concerns (list management vs. enrichment). Forces MAL and Kitsu plugins to implement enrichment methods they may not support.
- **New optional methods on TrackerPlugin** — Add `getRelations?()` as optional. Rejected: optional methods are fragile; the enrichment service needs to know which trackers support enrichment.
- **Separate EnrichmentProvider interface** — Clean interface with `searchByTitle()` and `getMediaDetailsBatch()`. Chosen: clear separation of concerns, extensible to other enrichment sources in the future.

## Consequences

- A new `EnrichmentProvider` interface in `packages/core/src/types.ts`.
- `AniListEnrichmentProvider` in `packages/plugins` implements it.
- The enrichment service in `packages/core` depends only on the interface, not on AniList directly.
- MAL and Kitsu plugins are unaffected — they continue implementing only `TrackerPlugin`.
- Future enrichment sources (e.g., TVDB relations) can implement the same interface.
- `getMediaDetailsBatch()` supports batching multiple AniList IDs in one GraphQL request for BFS efficiency.
