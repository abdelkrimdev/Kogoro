import type {
  EntryType,
  TrackerAnime,
  TrackerAnimeDetails,
  TrackerEntry,
  TrackerEntryChanges,
  TrackerPlugin,
  TrackerWatchStatus,
} from "@kogoro/core";
import { HttpClient } from "@kogoro/core";

const KITSU_STATUS_MAP: Record<string, TrackerWatchStatus> = {
  current: "watching",
  completed: "completed",
  on_hold: "on-hold",
  dropped: "dropped",
  planned: "plan-to-watch",
};

const KITSU_SUBTYPE_MAP: Record<string, EntryType> = {
  tv: "tv",
  movie: "movie",
  ova: "ova",
  special: "special",
  ona: "tv",
  music: "special",
};

const KITSU_STATUS_REVERSE_MAP: Record<string, string> = {
  watching: "current",
  completed: "completed",
  "on-hold": "on_hold",
  dropped: "dropped",
  "plan-to-watch": "planned",
};

interface KitsuPluginOptions {
  baseUrl?: string;
  oauthUrl?: string;
  httpClient?: HttpClient;
  username?: string;
  password?: string;
}

interface KitsuJsonApiData {
  id: string | number;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    { data?: { type: string; id: string | number } | { type: string; id: string | number }[] }
  >;
}

interface KitsuJsonApiResponse {
  data: KitsuJsonApiData | KitsuJsonApiData[];
  included?: KitsuJsonApiData[];
}

function extractAnimeId(entry: KitsuJsonApiData): string {
  const rels = entry.relationships;
  if (!rels) return "";
  const animeRel = rels["anime"];
  if (!animeRel?.data) return "";
  return String(Array.isArray(animeRel.data) ? animeRel.data[0]?.id : animeRel.data.id);
}

function str(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined;
}

function num(val: unknown): number | undefined {
  return typeof val === "number" ? val : undefined;
}

function numOr(val: unknown, fallback: number): number {
  return typeof val === "number" ? val : fallback;
}

function parseYear(val: unknown): number | undefined {
  if (typeof val !== "string") return undefined;
  const yearStr = val.slice(0, 4);
  if (!yearStr) return undefined;
  return Number.parseInt(yearStr, 10);
}

function singleOrFirst<T>(value: T | T[]): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function posterUrl(attrs: Record<string, unknown> | undefined): string | undefined {
  const poster = attrs?.["posterImage"] as Record<string, unknown> | undefined;
  return typeof poster?.["original"] === "string" ? poster["original"] : undefined;
}

export class KitsuPlugin implements TrackerPlugin {
  private baseUrl: string;
  private oauthUrl: string;
  private httpClient: HttpClient;
  private username: string;
  private password: string;
  private accessToken: string | null = null;

  constructor(options: KitsuPluginOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://kitsu.io/api/edge";
    this.oauthUrl = options.oauthUrl ?? "https://kitsu.io/api/oauth";
    this.httpClient = options.httpClient ?? new HttpClient({ minDelay: 500 });
    this.username = options.username ?? "";
    this.password = options.password ?? "";
  }

  private async authenticatedGet(path: string): Promise<KitsuJsonApiResponse | null> {
    if (!this.accessToken) return null;
    const response = await this.httpClient.fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.api+json",
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as KitsuJsonApiResponse;
  }

  private async authenticatedPatch(path: string, body: Record<string, unknown>): Promise<boolean> {
    if (!this.accessToken) return false;
    const response = await this.httpClient.fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify(body),
    });
    return response.ok;
  }

  async authenticate(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "password",
      username: this.username,
      password: this.password,
    });

    const response = await this.httpClient.fetch(`${this.oauthUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: string; error_description?: string };
      throw new Error(
        `Kitsu authentication failed: ${error.error_description ?? error.error ?? response.statusText}`,
      );
    }

    const json = (await response.json()) as { access_token: string };
    this.accessToken = json.access_token;
    return this.accessToken;
  }

  async getUserList(): Promise<TrackerAnime[]> {
    const userResponse = await this.authenticatedGet("/users?filter[self]=true");
    if (!userResponse) return [];

    const userData = singleOrFirst(userResponse.data);
    if (!userData) return [];

    const userId = String(userData.id);
    const libraryResponse = await this.authenticatedGet(
      `/users/${userId}/library-entries?include=anime`,
    );
    if (!libraryResponse) return [];

    const entries = Array.isArray(libraryResponse.data) ? libraryResponse.data : [];
    const included = libraryResponse.included ?? [];
    const animeById = new Map<string, KitsuJsonApiData>();
    for (const item of included) {
      if (item.type === "anime") {
        animeById.set(String(item.id), item);
      }
    }

    return entries.map((entry): TrackerAnime => {
      const animeId = extractAnimeId(entry);
      const anime = animeById.get(animeId);
      const attrs = entry.attributes ?? {};
      const animeAttrs = anime?.attributes ?? {};

      const status = str(attrs["status"]) ?? "current";
      const ratingTwenty = num(attrs["ratingTwenty"]);

      return {
        trackerId: String(entry.id),
        title: str(animeAttrs["canonicalTitle"]) ?? "",
        image: posterUrl(animeAttrs),
        year: parseYear(animeAttrs["startDate"]),
        entryType: KITSU_SUBTYPE_MAP[str(animeAttrs["subtype"]) ?? ""] ?? "tv",
        watchStatus: KITSU_STATUS_MAP[status] ?? "watching",
        episodesWatched: numOr(attrs["progress"], 0),
        totalEpisodes: numOr(animeAttrs["episodeCount"], 0),
        score: ratingTwenty != null ? ratingTwenty / 2 : undefined,
      };
    });
  }

  async getEntry(trackerId: string): Promise<TrackerEntry> {
    const response = await this.authenticatedGet(`/library-entries/${trackerId}?include=anime`);
    if (!response) {
      throw new Error(`Library entry ${trackerId} not found`);
    }

    const entry = singleOrFirst(response.data);
    if (!entry) {
      throw new Error(`Library entry ${trackerId} not found`);
    }

    const included = response.included ?? [];
    const animeId = extractAnimeId(entry);
    const anime = included.find((i) => i.type === "anime" && String(i.id) === animeId);
    const animeAttrs = anime?.attributes ?? {};
    const attrs = entry.attributes ?? {};
    const status = str(attrs["status"]) ?? "current";
    const ratingTwenty = num(attrs["ratingTwenty"]);

    return {
      trackerId: String(entry.id),
      title: str(animeAttrs["canonicalTitle"]) ?? "",
      watchStatus: KITSU_STATUS_MAP[status] ?? "watching",
      episodesWatched: numOr(attrs["progress"], 0),
      totalEpisodes: numOr(animeAttrs["episodeCount"], 0),
      score: ratingTwenty != null ? ratingTwenty / 2 : undefined,
      notes: str(attrs["notes"]),
    };
  }

  async updateEntry(trackerId: string, changes: TrackerEntryChanges): Promise<void> {
    const attributes: Record<string, unknown> = {};
    if (changes.watchStatus !== undefined) {
      attributes["status"] = KITSU_STATUS_REVERSE_MAP[changes.watchStatus] ?? changes.watchStatus;
    }
    if (changes.episodesWatched !== undefined) {
      attributes["progress"] = changes.episodesWatched;
    }
    if (changes.score !== undefined) {
      attributes["ratingTwenty"] = changes.score * 2;
    }
    if (changes.notes !== undefined) {
      attributes["notes"] = changes.notes;
    }

    await this.authenticatedPatch(`/library-entries/${trackerId}`, {
      data: {
        id: trackerId,
        type: "libraryEntries",
        attributes,
      },
    });
  }

  async getAnimeDetails(trackerId: string): Promise<TrackerAnimeDetails> {
    const response = await this.authenticatedGet(`/anime/${trackerId}?include=categories`);
    if (!response) {
      throw new Error(`Anime ${trackerId} not found`);
    }

    const anime = singleOrFirst(response.data);
    if (!anime) {
      throw new Error(`Anime ${trackerId} not found`);
    }

    const attrs = anime.attributes ?? {};
    const included = response.included ?? [];
    const genres = included
      .filter((i) => i.type === "categories")
      .map((i) => str(i.attributes?.["title"]) ?? "")
      .filter(Boolean);

    return {
      trackerId: String(anime.id),
      title: str(attrs["canonicalTitle"]) ?? "",
      image: posterUrl(attrs),
      year: parseYear(attrs["startDate"]),
      entryType: KITSU_SUBTYPE_MAP[str(attrs["subtype"]) ?? ""] ?? "tv",
      synopsis: str(attrs["synopsis"]),
      rating:
        typeof attrs["averageRating"] === "string"
          ? Number.parseFloat(attrs["averageRating"])
          : num(attrs["averageRating"]),
      genres: genres.length > 0 ? genres : undefined,
      totalEpisodes: num(attrs["episodeCount"]),
    };
  }
}
