# Changelog

## 0.2.0
<sub>2026-07-23</sub>

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
-  *(patch)*
  Extract shared tracker status mapping to tracker-utils, remove duplicate createMockTracker from tests, and use proper type imports
-  *(patch)* - Wire import path to shared anime merge method
