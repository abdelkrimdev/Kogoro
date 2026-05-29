# Derived library database

The GUI needs to answer "what anime do I have?" and "what episodes are missing?" quickly. We chose a derived SQLite database over computing answers on every query.

The alternative was walking the organized directories on each request, parsing filenames, and looking up the match cache — which works but is slow for large libraries and can't store user-specific data (watch status, notes). The derived database is populated from on-disk state + match cache, rebuilt on startup or on-demand, and serves as a fast query layer.

The key design decision is that the database is **derived, not authoritative**. The source of truth is always what's on disk and what's in the match cache. If the library database is deleted, it can be rebuilt. This avoids sync drift — the database never contradicts the filesystem.

Anime entries are identified by (external ID, source Database), not a single primary key. This allows coexistence when the user switches primary databases (TVDB → AniDB) and supports auto-merge of new episodes into existing entries.
