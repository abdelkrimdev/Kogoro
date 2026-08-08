import { and, eq, isNull, sql } from "drizzle-orm";
import type { EventRepository } from "../events/event-repository";
import type { EntryType, TrackerSource } from "../types";
import type { LibraryDb } from "./schema";
import { episodeGroups, episodes, groupTrackerMappings } from "./schema";

export interface EpisodeGroup {
  id: number;
  animeId: number;
  entryType: EntryType;
  seasonNumber?: number;
  watchStatus: "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped";
  synopsis?: string;
  rating?: number;
  coverArtPath?: string;
  updatedAt: string;
}

export interface GroupTrackerMapping {
  groupId: number;
  source: TrackerSource;
  externalId: string;
}

export interface GroupRepositoryDeps {
  db: LibraryDb;
  events?: EventRepository;
}

export class GroupRepository {
  private db: LibraryDb;
  private events?: EventRepository;

  constructor(deps: GroupRepositoryDeps) {
    this.db = deps.db;
    this.events = deps.events;
  }

  upsertEpisodeGroup(
    groupData: Omit<EpisodeGroup, "id" | "updatedAt"> & {
      updatedAt?: string;
    },
  ): EpisodeGroup {
    const updatedAt = groupData.updatedAt ?? new Date().toISOString();
    const seasonCondition =
      groupData.seasonNumber == null
        ? isNull(episodeGroups.seasonNumber)
        : eq(episodeGroups.seasonNumber, groupData.seasonNumber);
    const existing = this.db
      .select({ id: episodeGroups.id })
      .from(episodeGroups)
      .where(
        and(
          eq(episodeGroups.animeId, groupData.animeId),
          eq(episodeGroups.entryType, groupData.entryType),
          seasonCondition,
        ),
      )
      .get();

    if (existing) {
      this.db
        .update(episodeGroups)
        .set({
          watchStatus: groupData.watchStatus,
          synopsis: groupData.synopsis ?? null,
          rating: groupData.rating ?? null,
          coverArtPath: groupData.coverArtPath ?? null,
          updatedAt,
        })
        .where(eq(episodeGroups.id, existing.id))
        .run();
      return this.getEpisodeGroup(existing.id) as EpisodeGroup;
    }

    const result = this.db
      .insert(episodeGroups)
      .values({
        animeId: groupData.animeId,
        entryType: groupData.entryType,
        seasonNumber: groupData.seasonNumber ?? null,
        watchStatus: groupData.watchStatus,
        synopsis: groupData.synopsis ?? null,
        rating: groupData.rating ?? null,
        coverArtPath: groupData.coverArtPath ?? null,
        updatedAt,
      })
      .returning()
      .get();

    return this.rowToEpisodeGroup(result);
  }

  getEpisodeGroup(id: number): EpisodeGroup | null {
    const row = this.db.select().from(episodeGroups).where(eq(episodeGroups.id, id)).get();
    return row ? this.rowToEpisodeGroup(row) : null;
  }

  getEpisodeGroupsByAnimeId(animeId: number): EpisodeGroup[] {
    const rows = this.db
      .select()
      .from(episodeGroups)
      .where(eq(episodeGroups.animeId, animeId))
      .orderBy(episodeGroups.seasonNumber)
      .all();
    return rows.map(this.rowToEpisodeGroup);
  }

  getAllEpisodeGroups(): EpisodeGroup[] {
    const rows = this.db.select().from(episodeGroups).all();
    return rows.map(this.rowToEpisodeGroup);
  }

  findEpisodeGroup(
    animeId: number,
    entryType: EntryType,
    seasonNumber: number | null,
  ): EpisodeGroup | null {
    const seasonCondition =
      seasonNumber === null
        ? isNull(episodeGroups.seasonNumber)
        : eq(episodeGroups.seasonNumber, seasonNumber);
    const row = this.db
      .select()
      .from(episodeGroups)
      .where(
        and(
          eq(episodeGroups.animeId, animeId),
          eq(episodeGroups.entryType, entryType),
          seasonCondition,
        ),
      )
      .get();
    return row ? this.rowToEpisodeGroup(row) : null;
  }

  deleteEpisodeGroup(groupId: number): void {
    this.db.delete(episodeGroups).where(eq(episodeGroups.id, groupId)).run();
  }

  deleteEpisodeGroupsByAnimeId(animeId: number): void {
    this.db.delete(episodeGroups).where(eq(episodeGroups.animeId, animeId)).run();
  }

  updateEpisodeGroupStatus(
    groupId: number,
    status: EpisodeGroup["watchStatus"],
  ): EpisodeGroup | null {
    const oldGroup = this.getEpisodeGroup(groupId);
    this.db
      .update(episodeGroups)
      .set({ watchStatus: status })
      .where(eq(episodeGroups.id, groupId))
      .run();
    const result = this.getEpisodeGroup(groupId);
    if (result && oldGroup && oldGroup.watchStatus !== status && this.events) {
      this.events.append({
        entityType: "group",
        entityId: groupId,
        eventType: "status_change",
        oldValue: oldGroup.watchStatus,
        newValue: status,
      });
    }
    return result;
  }

  updateEpisodeGroupStatusBatch(
    updates: Array<{ groupId: number; watchStatus: EpisodeGroup["watchStatus"] }>,
  ): void {
    if (updates.length === 0) return;

    for (const update of updates) {
      this.db
        .update(episodeGroups)
        .set({ watchStatus: update.watchStatus })
        .where(eq(episodeGroups.id, update.groupId))
        .run();
    }
  }

  updateEpisodeGroupMetadata(
    groupId: number,
    metadata: { synopsis?: string; rating?: number; coverArtPath?: string },
  ): EpisodeGroup | null {
    const oldGroup = this.getEpisodeGroup(groupId);
    const updates: { synopsis?: string; rating?: number; coverArtPath?: string } = {};
    if (metadata.synopsis !== undefined) updates.synopsis = metadata.synopsis;
    if (metadata.rating !== undefined) updates.rating = metadata.rating;
    if (metadata.coverArtPath !== undefined) updates.coverArtPath = metadata.coverArtPath;
    if (Object.keys(updates).length === 0) return this.getEpisodeGroup(groupId);
    this.db.update(episodeGroups).set(updates).where(eq(episodeGroups.id, groupId)).run();
    const result = this.getEpisodeGroup(groupId);
    if (result && oldGroup && this.events) {
      if (metadata.synopsis !== undefined && metadata.synopsis !== oldGroup.synopsis) {
        this.events.append({
          entityType: "group",
          entityId: groupId,
          eventType: "notes_update",
          oldValue: oldGroup.synopsis ?? null,
          newValue: metadata.synopsis,
        });
      }
      if (metadata.rating !== undefined && metadata.rating !== oldGroup.rating) {
        this.events.append({
          entityType: "group",
          entityId: groupId,
          eventType: "notes_update",
          oldValue: oldGroup.rating != null ? String(oldGroup.rating) : null,
          newValue: String(metadata.rating),
        });
      }
    }
    return result;
  }

  updateEpisodeGroupAnimeId(groupId: number, animeId: number): void {
    this.db.update(episodeGroups).set({ animeId }).where(eq(episodeGroups.id, groupId)).run();
  }

  updateEpisodeGroupSeasonNumber(groupId: number, seasonNumber: number): EpisodeGroup | null {
    this.db.update(episodeGroups).set({ seasonNumber }).where(eq(episodeGroups.id, groupId)).run();
    return this.getEpisodeGroup(groupId);
  }

  getFilesOnDiskByGroupId(groupId: number): number {
    const row = this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(episodes)
      .where(eq(episodes.groupId, groupId))
      .get();
    return row?.count ?? 0;
  }

  upsertEpisodeGroupBatch(
    items: Array<
      Omit<EpisodeGroup, "id" | "updatedAt"> & {
        updatedAt?: string;
      }
    >,
  ): EpisodeGroup[] {
    if (items.length === 0) return [];
    const now = new Date().toISOString();

    const rows = this.db
      .insert(episodeGroups)
      .values(
        items.map((item) => ({
          animeId: item.animeId,
          entryType: item.entryType,
          seasonNumber: item.seasonNumber ?? null,
          watchStatus: item.watchStatus,
          synopsis: item.synopsis ?? null,
          rating: item.rating ?? null,
          coverArtPath: item.coverArtPath ?? null,
          updatedAt: item.updatedAt ?? now,
        })),
      )
      .onConflictDoUpdate({
        target: [episodeGroups.animeId, episodeGroups.entryType, episodeGroups.seasonNumber],
        set: {
          watchStatus: sql.raw("excluded.watch_status"),
          synopsis: sql.raw("excluded.synopsis"),
          rating: sql.raw("excluded.rating"),
          coverArtPath: sql.raw("excluded.cover_art_path"),
          updatedAt: sql.raw("excluded.updated_at"),
        },
      })
      .returning()
      .all();

    return rows.map(this.rowToEpisodeGroup);
  }

  deleteAll(): void {
    this.db.delete(groupTrackerMappings).run();
    this.db.delete(episodeGroups).run();
  }

  // Group Tracker Mappings

  upsertGroupTrackerMapping(mapping: GroupTrackerMapping): void {
    this.db
      .insert(groupTrackerMappings)
      .values({
        groupId: mapping.groupId,
        source: mapping.source,
        externalId: mapping.externalId,
      })
      .onConflictDoUpdate({
        target: [groupTrackerMappings.source, groupTrackerMappings.externalId],
        set: { groupId: mapping.groupId },
      })
      .run();
  }

  getTrackerMappingsByGroupId(groupId: number): GroupTrackerMapping[] {
    const rows = this.db
      .select()
      .from(groupTrackerMappings)
      .where(eq(groupTrackerMappings.groupId, groupId))
      .all();
    return rows.map(this.rowToGroupTrackerMapping);
  }

  getAllTrackerMappings(): GroupTrackerMapping[] {
    const rows = this.db.select().from(groupTrackerMappings).all();
    return rows.map(this.rowToGroupTrackerMapping);
  }

  findGroupByTrackerExternalId(source: string, externalId: string): { groupId: number } | null {
    const row = this.db
      .select({ groupId: groupTrackerMappings.groupId })
      .from(groupTrackerMappings)
      .where(
        and(
          eq(groupTrackerMappings.source, source),
          eq(groupTrackerMappings.externalId, externalId),
        ),
      )
      .get();
    return row ? { groupId: row.groupId } : null;
  }

  deleteTrackerMappingsByGroupId(groupId: number): void {
    this.db.delete(groupTrackerMappings).where(eq(groupTrackerMappings.groupId, groupId)).run();
  }

  getTrackerMapping(groupId: number, source: string): GroupTrackerMapping | null {
    const row = this.db
      .select()
      .from(groupTrackerMappings)
      .where(
        and(eq(groupTrackerMappings.groupId, groupId), eq(groupTrackerMappings.source, source)),
      )
      .get();
    return row ? this.rowToGroupTrackerMapping(row) : null;
  }

  removeTrackerMappingsBySource(source: string): void {
    this.db.delete(groupTrackerMappings).where(eq(groupTrackerMappings.source, source)).run();
  }

  removeTrackerMapping(groupId: number, source: string): void {
    this.db
      .delete(groupTrackerMappings)
      .where(
        and(eq(groupTrackerMappings.groupId, groupId), eq(groupTrackerMappings.source, source)),
      )
      .run();
  }

  upsertGroupTrackerMappingBatch(items: GroupTrackerMapping[]): void {
    if (items.length === 0) return;

    this.db
      .insert(groupTrackerMappings)
      .values(
        items.map((item) => ({
          groupId: item.groupId,
          source: item.source,
          externalId: item.externalId,
        })),
      )
      .onConflictDoUpdate({
        target: [groupTrackerMappings.source, groupTrackerMappings.externalId],
        set: {
          groupId: sql.raw("excluded.group_id"),
        },
      })
      .run();
  }

  private rowToEpisodeGroup(row: {
    id: number;
    animeId: number;
    entryType: string;
    seasonNumber: number | null;
    watchStatus: string;
    synopsis: string | null;
    rating: number | null;
    coverArtPath: string | null;
    updatedAt: string;
  }): EpisodeGroup {
    return {
      id: row.id,
      animeId: row.animeId,
      entryType: row.entryType as EntryType,
      seasonNumber: row.seasonNumber ?? undefined,
      watchStatus: row.watchStatus as EpisodeGroup["watchStatus"],
      synopsis: row.synopsis ?? undefined,
      rating: row.rating ?? undefined,
      coverArtPath: row.coverArtPath ?? undefined,
      updatedAt: row.updatedAt,
    };
  }

  private rowToGroupTrackerMapping(row: {
    groupId: number;
    source: string;
    externalId: string;
  }): GroupTrackerMapping {
    return {
      groupId: row.groupId,
      source: row.source as GroupTrackerMapping["source"],
      externalId: row.externalId,
    };
  }
}
