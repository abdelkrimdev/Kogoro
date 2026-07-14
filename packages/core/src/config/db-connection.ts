import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { EventRepository } from "../events/event-repository";
import { createEventsTable, events as eventsSchema } from "../events/schema";
import { LibraryRepository } from "../library/library-repository";
import {
  anilistCache,
  anime,
  animeTrackerMappings,
  episodeGroups,
  episodes,
  franchises,
  groupTrackerMappings,
} from "../library/schema";
import { MatchRepository } from "../match/match-repository";
import { ScanStateRepository } from "../match/scan-state-repository";
import { matches, scanState } from "../match/schema";
import { safeMigrate } from "./db-migrations";

export interface MatchCacheConnection {
  matchRepo: MatchRepository;
  scanStateRepo: ScanStateRepository;
}

export function createMatchCacheConnection(dbPath: string): MatchCacheConnection {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema: { matches, scanState } });
  safeMigrate(db);
  return {
    matchRepo: new MatchRepository(db),
    scanStateRepo: new ScanStateRepository(db),
  };
}

export function createLibraryConnection(dbPath: string): LibraryRepository {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, {
    schema: {
      anime,
      episodeGroups,
      episodes,
      groupTrackerMappings,
      franchises,
      animeTrackerMappings,
      anilistCache,
    },
  });
  safeMigrate(db);
  return new LibraryRepository(db);
}

export function createEventsConnection(dbPath: string): EventRepository {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA foreign_keys = ON");
  createEventsTable(sqlite);
  const db = drizzle(sqlite, { schema: { events: eventsSchema } });
  return new EventRepository(db);
}
