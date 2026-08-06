import { eq, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { anime, franchises } from "./schema";

export interface Franchise {
  id: number;
  title: string;
  coverArtPath: string | null;
  synopsis: string | null;
  createdAt: string;
  updatedAt: string;
}

type LibrarySchema = {
  anime: typeof anime;
  franchises: typeof franchises;
};
type LibraryDb = BaseSQLiteDatabase<"sync", void, LibrarySchema>;

export interface FranchiseRepositoryDeps {
  db: LibraryDb;
}

export class FranchiseRepository {
  private db: LibraryDb;

  constructor(deps: FranchiseRepositoryDeps) {
    this.db = deps.db;
  }

  createFranchise(data: { title: string; coverArtPath?: string; synopsis?: string }): Franchise {
    const now = new Date().toISOString();
    const result = this.db
      .insert(franchises)
      .values({
        title: data.title,
        coverArtPath: data.coverArtPath ?? null,
        synopsis: data.synopsis ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    return this.rowToFranchise(result);
  }

  assignAnimeToFranchise(animeId: number, franchiseId: number): void {
    this.db.update(anime).set({ franchiseId }).where(eq(anime.id, animeId)).run();
  }

  getFranchiseById(id: number): Franchise | null {
    const row = this.db.select().from(franchises).where(eq(franchises.id, id)).get();
    return row ? this.rowToFranchise(row) : null;
  }

  getFranchises(): Franchise[] {
    const rows = this.db.select().from(franchises).orderBy(franchises.title).all();
    return rows.map(this.rowToFranchise);
  }

  findFranchiseByTitle(title: string): Franchise | null {
    const row = this.db.select().from(franchises).where(eq(franchises.title, title)).get();
    return row ? this.rowToFranchise(row) : null;
  }

  deleteFranchise(id: number): void {
    this.db.delete(franchises).where(eq(franchises.id, id)).run();
  }

  countAnimeByFranchiseId(franchiseId: number): number {
    const row = this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(anime)
      .where(eq(anime.franchiseId, franchiseId))
      .get();
    return row?.count ?? 0;
  }

  private rowToFranchise(row: {
    id: number;
    title: string;
    coverArtPath: string | null;
    synopsis: string | null;
    createdAt: string;
    updatedAt: string;
  }): Franchise {
    return {
      id: row.id,
      title: row.title,
      coverArtPath: row.coverArtPath,
      synopsis: row.synopsis,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
