import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { EventRepository } from "../events/event-repository";
import { createEventsTable, events as eventsSchema } from "../events/schema";
import type { AnimeRepository } from "../library/anime-repository";
import type { EpisodeRepository } from "../library/episode-repository";
import type { FranchiseRepository } from "../library/franchise-repository";
import type { GroupRepository } from "../library/group-repository";
import {
  anime,
  animeSourceMappings,
  createLibraryRepos,
  episodeGroups,
  episodes,
  franchises,
  groupTrackerMappings,
} from "../library/schema";
import { ManifestRepository } from "../match/manifest-repository";
import { MatchRepository } from "../match/match-repository";
import { manifest, matches } from "../match/schema";
import { safeMigrate } from "./db-migrations";

export interface MatchCacheConnection {
  matchRepo: MatchRepository;
  manifestRepo: ManifestRepository;
}

export function createMatchCacheConnection(dbPath: string): MatchCacheConnection {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema: { matches, manifest } });
  safeMigrate(db);
  return {
    matchRepo: new MatchRepository(db),
    manifestRepo: new ManifestRepository(db),
  };
}

export interface LibraryConnection {
  animeRepo: AnimeRepository;
  episodeRepo: EpisodeRepository;
  groupRepo: GroupRepository;
  franchiseRepo: FranchiseRepository;
}

export function createLibraryConnection(dbPath: string): LibraryConnection {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, {
    schema: {
      anime,
      episodeGroups,
      episodes,
      groupTrackerMappings,
      franchises,
      animeSourceMappings,
    },
  });
  safeMigrate(db);
  return createLibraryRepos(db);
}

export function createEventsConnection(dbPath: string): EventRepository {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA foreign_keys = ON");
  createEventsTable(sqlite);
  const db = drizzle(sqlite, { schema: { events: eventsSchema } });
  return new EventRepository(db);
}
