# ADR 0008: Drizzle ORM Migration and Storage/Domain Separation

## Status

Accepted

## Context

`LibraryDb` and `MatchCache` mix business logic (merge, rebuild, export) with raw SQL queries, manual row mapping, and schema management. This makes the code hard to test, maintain, and reason about. Every query is a raw string passed to `bun:sqlite` with manual `$param` binding and hand-written `rowTo*` mappers.

Additionally, `MatchCache` conflates two unrelated concerns: match caching (hash → anime/episode data) and scan state tracking (path → size/mtime/hash). The CLI and GUI also use different default filenames for the same cache database (`cache.db` vs `match-cache.db`), breaking the shared state assumption from ADR 0007.

## Decision

### 1. Repository + Domain Service Split

Each database class is split into a **repository** (pure data access) and a **domain service** (business rules). No interfaces are added — the codebase has a single SQLite backend and concrete classes are already injected via constructors.

### 2. Three Repositories, Two Services

| Module | Database | Tables | Role |
|--------|----------|--------|------|
| `MatchRepository` | `cache.db` | `matches` | CRUD for match entries |
| `ScanStateRepository` | `cache.db` | `scan_state` | CRUD for file stat tracking |
| `LibraryRepository` | `library.db` | `anime`, `episodes`, `watch_status` | CRUD for library data |
| `LibraryService` | — | — | Business logic: merge, rebuild, export |
| `CacheService` | — | — | Cross-repository cache hygiene: purgeStale |

`MatchRepository` and `ScanStateRepository` share the same `cache.db` file via separate Drizzle schemas. `LibraryRepository` lives alone in `library.db`.

### 3. Drizzle ORM with `drizzle-orm/bun-sqlite`

Drizzle provides first-class Bun SQLite support via `drizzle-orm/bun-sqlite`. No adapter needed. The synchronous API matches `bun:sqlite`'s nature. Schema definitions use `sqliteTable`, queries use Drizzle's fluent API.

### 4. Drizzle Kit for Migrations

`drizzle-kit generate` + `drizzle-kit migrate` for version-controlled schema evolution. Existing databases are bootstrapped via `drizzle-kit introspect` to generate a baseline migration. Future changes produce proper migration diffs.

### 5. File Organization

Each domain module owns its vertical slice:

```
library/
  schema.ts              # Drizzle table definitions
  library-repository.ts  # Pure data access
  library-service.ts     # Business logic
  library-repository.test.ts
  library-service.test.ts
match/
  schema.ts  # Drizzle table definitions
  match-repository.ts
  scan-state-repository.ts
  cache-service.ts
  matcher.ts             # Unchanged
  ...
```

### 6. Factory Functions at the App Layer

The CLI and GUI composition roots create repositories and services, then pass them to handler factories. Same pattern as today's `createScanHandlers({ database, cache, config })`, just with narrower types.

### 7. Domain Interfaces Preserved

Drizzle's inferred types (`$inferSelect`, `$inferInsert`) are internal to repositories. Consumers receive the existing domain interfaces (`LibraryAnime`, `LibraryEpisode`, `CachedMatch`, etc.) with camelCase fields and `EntryType` unions. The repository maps between Drizzle rows and domain types.

### 8. `hashFile` Utility Moved to `io/`

`MatchCache.hashFile` is a file I/O operation with no database dependency. Moved to `packages/core/src/io/file-hash.ts`.

### 9. Transaction Strategy

- **`LibraryRepository.rebuild(data)`**: Wraps delete-all + re-insert + watch status migration + orphan cleanup in a single transaction. `LibraryService.rebuildFromMatches(matches)` transforms `MatchEntry[]` and calls this method.
- **`LibraryRepository.mergeAnime({ anime, episodes })`**: Wraps upsert + insert episodes + update count in a single transaction. `LibraryService.mergeFromMatches(matches)` iterates groups and calls this per anime.
- `LibraryService` is decoupled from `MatchRepository` — matches are passed in, not read from cache.

### 10. Centralized Path Resolution

A `resolveDbPaths(configDir)` function returns `{ libraryDbPath, cacheDbPath }`. Both apps call it once and pass paths to repository constructors. Eliminates the CLI/GUI path divergence.

### 11. Test Strategy

Fixture helpers in `fixtures.ts` (`createLibraryRepository(dir)`, `createMatchRepository(dir)`) create repositories with in-memory SQLite for fast, isolated tests. Same ergonomics as today's `createLibraryDb(dir)`.

### 12. Clean Break Public API

Old class names (`LibraryDb`, `MatchCache`) are removed. New names (`LibraryRepository`, `LibraryService`, `MatchRepository`, `ScanStateRepository`, `CacheService`) are exported from `@kogoro/core`. No deprecated aliases — the apps are internal.

### 13. Rollout

Big bang refactor in a single pass. The codebase is small (~50 test files, two apps, one core package) with no external consumers. Old classes are deleted, new ones created, all consumers updated at once.

## Trade-offs

- **Big bang risk** — a large diff is harder to review, but the codebase is small enough that this is manageable. Incremental approaches would require adapter layers that create their own tech debt.
- **No interfaces** — concrete classes can't be swapped for alternative storage. This is acceptable for a single-backend SQLite app. Interfaces can be added later if needed.
- **Drizzle is a new dependency** — adds a third-party library to the core package. Drizzle is lightweight, well-maintained, and the migration from raw SQL is straightforward. The alternative (keeping raw SQL) perpetuates the maintenance burden.
- **Separate domain interfaces** — consumers don't benefit from Drizzle's type inference. This is intentional: the public API uses domain language (camelCase, `EntryType` unions), not database column names.
