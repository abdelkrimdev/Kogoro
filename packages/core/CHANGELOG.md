# Changelog

## 0.2.0
<sub>2026-08-08</sub>

-  *(minor)* - Add TrackerPlugin interface and plugin registry support for tracker plugin type
-  *(minor)* - EpisodeGroup repository, group-level watch status, and Library State computation
-  *(minor)* - Group-aware rebuild and auto-merge with library state computation
-  *(minor)* - Add append-only event log database for sync replay
-  *(minor)* - Events database: append-only event log for sync replay and bidirectional tracker synchronization
-  *(minor)*
  Tracker import service: import anime from connected trackers (AniList, Kitsu) into the library with watch status mapping and alternative title matching
-  *(minor)* - Tracker import preview screen: review and confirm matches before importing from connected trackers
-  *(minor)* - Sync Engine: pull-before-push reconciliation with tracker integration
-  *(minor)* - Add per-episode notes column to the library
-  *(minor)* - Sort files by season and episode, and groups alphabetically in review plan
-  *(minor)* - Add franchise enrichment service and AniList enrichment provider
-  *(minor)* - Replace title-parsing with relation-graph matching and season numbering
-  *(minor)* - Wire IdentityResolver into merge pipeline with eager source mapping cache
-  *(patch)*
  Extract shared tracker status mapping to tracker-utils, remove duplicate createMockTracker from tests, and use proper type imports
-  *(patch)* - Wire import path to shared anime merge method
-  *(patch)*
  Simplify library schema: drop anilist_cache table, remove franchises.anilist_id, change anime_source_mappings to composite PK
-  *(patch)* - Add schema verification test for library migrations
-  *(patch)* - Split monolithic LibraryRepository into 4 domain-aligned repositories (Anime, Episode, Group, Franchise)
