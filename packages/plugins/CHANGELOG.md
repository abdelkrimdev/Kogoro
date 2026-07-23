# Changelog

## 0.2.0
<sub>2026-07-23</sub>

-  *(minor)* - Add TrackerPlugin interface and plugin registry support for tracker plugin type
-  *(minor)* - Add Kitsu tracker plugin with OAuth2 authentication, library sync, entry updates, and enriched anime details
-  *(minor)* - AniList tracker plugin: built-in TrackerPlugin implementation with GraphQL API integration
-  *(minor)* - Add MyAnimeList tracker plugin with OAuth PKCE authentication, list fetching, and entry updates
-  *(minor)* - Add read and write support for private notes in the AniList tracker
-  *(minor)* - Add franchise enrichment service and AniList enrichment provider
-  *(minor)*
  Add source field to TrackerAnime in AniList, MAL, and Kitsu plugins

  The source field allows the system to track which tracker an entry came from, enabling source-specific matching logic and accurate metadata about entry provenance.
-  *(patch)* - Fix AniList import failing with token expired error immediately after login
-  *(patch)* - Fix Kitsu import failing with "Not authenticated" by calling ensureAuthenticated before API calls
-  *(patch)* - Fix MAL import failing with token expired error by exchanging authorization code on first use
