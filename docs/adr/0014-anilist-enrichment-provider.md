# AniList EnrichmentProvider interface

Enrichment (fetching anime relations and cross-source IDs) is implemented as a separate `EnrichmentProvider` plugin interface rather than extending `TrackerPlugin`. The enrichment service in `packages/core` depends only on the interface; `AniListEnrichmentProvider` in `packages/plugins` implements it. MAL and Kitsu plugins remain unaffected — they continue implementing only `TrackerPlugin`.
