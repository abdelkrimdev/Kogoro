---
"@kogoro/core": patch
---

Fix duplicate library entries when switching between databases (TVDB/AniDB). Match cache now tracks sourceDb, mergeFromMatches cleans up entries from other databases, and rebuild deduplicates by file path.
