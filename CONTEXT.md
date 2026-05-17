# Kogoro

Tool for organizing and renaming anime collections: matching media files against online databases, renaming them, and fetching associated artwork, subtitles, and metadata.

## Language

**MediaFile**:
A video file on disk that contains an anime episode, movie, OVA, or special.
_Avoid_: EpisodeFile, AnimeFile, video file

**Episode**:
A numbered entry within an anime series, covering regular episodes, movies, OVAs, and specials.
_Avoid_: chapter, entry, part

**Anime**:
The series or franchise that episodes belong to (e.g. "Jujutsu Kaisen").
_Avoid_: show, series, title, franchise

**Match**:
The resolution of a **MediaFile** to an **Episode**, produced by parsing the filename and searching **Databases**.
_Avoid_: pairing, identification, result

**Database**:
An external online source of **Anime** and **Episode** data used for matching and enrichment (e.g. AniDB, TVDB).
_Avoid_: provider, source, API

**Override**:
A user-supplied correction to a **Match**, persisted for future scans.
_Avoid_: fixup, correction, edit

**EntryType**:
The category of an **Episode**: TV, Movie, OVA, or Special. Controls directory placement and naming.
_Avoid_: kind, format, category

## Relationships

- A **MediaFile** matches exactly one **Episode**
- An **Episode** belongs to exactly one **Anime**
- A **Match** may have one or more **Overrides** (user corrections)
- An **Episode** has exactly one **EntryType**
- A **Match** is resolved against one primary **Database**, optionally enriched by secondary **Databases**

## Example dialogue

> **Dev:** "When a **MediaFile** has no episode number in the filename, does Kogoro assume it's a Movie?"
> **Domain expert:** "It searches across all **EntryTypes** — not just Movies. A TV Special with no number would still be found."
>
> **Dev:** "And if the primary **Database** returns something the user disagrees with?"
> **Domain expert:** "The user creates an **Override** — changing the **Episode**, the **Anime**, or the **EntryType**. That persists in `kogoro.toml` so future scans respect it."
>
> **Dev:** "What if two **MediaFiles** resolve to the same **Episode**?"
> **Domain expert:** "Kogoro appends a disambiguator to the filename — extracted metadata tags from the original filename — so both files coexist."

## Flagged ambiguities

_None yet._
