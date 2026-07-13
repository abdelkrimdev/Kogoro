# Franchise as top-level library entity

The library hierarchy was Anime → Episode Group → Episode. With the introduction of franchise grouping, the hierarchy becomes Franchise → Anime → Episode Group → Episode. The GUI surfaces Franchise as the top-level library entry — multiple anime in the same franchise appear as one entry, with Episode Groups listed directly underneath. Anime remains in the database for tracking external IDs and source databases, but is no longer a visible library entry in the GUI.

## Considered Options

- **Anime as top-level, franchise as filter** — Keep Anime as the library entry; add a franchise filter/group in the sidebar. Rejected: doesn't solve the core problem of duplicate entries for the same show.
- **Franchise as collapsible group** — Show franchise headers with anime nested underneath. Rejected: still shows multiple entries per franchise, cluttering the library view.
- **Franchise as single entry** — One library entry per franchise, Episode Groups listed directly. Chosen: cleanest UX, matches how users think about their library.

## Consequences

- The `anime` table gets a nullable `franchiseId` FK.
- A new `franchises` table stores franchise-level metadata (title, cover art, synopsis).
- The GUI library view queries franchises instead of anime.
- Episode Groups are the direct children of a Franchise in the UI, skipping the Anime level.
- Unfranchised anime (no relations found) still appear as top-level entries.
