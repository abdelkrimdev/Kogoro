import {
  ANILIST_REDIRECT_URI,
  buildCredentialFromToken,
  type CredentialStore,
  type EntryType,
  type HttpClient,
  loadOrRefreshCredential,
  type OAuthTokenResponse,
  type TrackerAnime,
  type TrackerAnimeDetails,
  type TrackerCredential,
  type TrackerEntry,
  type TrackerEntryChanges,
  TrackerError,
  type TrackerPlugin,
  type TrackerWatchStatus,
  throwHttpError,
} from "@kogoro/core";

interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

interface AniListMediaListEntry {
  mediaId: number;
  status: string;
  score: number;
  progress: number;
  media: {
    title: AniListTitle;
    coverImage: { large: string | null };
    startDate: { year: number | null };
    format: string;
    episodes: number | null;
    synonyms: string[];
  };
}

interface AniListMediaList {
  entries: AniListMediaListEntry[];
}

interface AniListMediaListResponse {
  MediaListCollection: {
    lists: AniListMediaList[];
  };
}

interface AniListMediaListEntryResponse {
  MediaList: {
    id: number;
    mediaId: number;
    status: string;
    score: number;
    progress: number;
    privateNotes: string | null;
    media: {
      title: AniListTitle;
      episodes: number | null;
    };
  };
}

interface AniListMediaResponse {
  Media: {
    id: number;
    title: AniListTitle;
    synonyms: string[];
    description: string | null;
    averageScore: number | null;
    genres: string[];
    studios: { nodes: { name: string }[] };
    coverImage: { large: string | null };
    startDate: { year: number | null };
    format: string;
    episodes: number | null;
  };
}

const ANILIST_STATUS_MAP: Record<string, TrackerWatchStatus> = {
  CURRENT: "watching",
  COMPLETED: "completed",
  PLANNING: "plan-to-watch",
  PAUSED: "on-hold",
  DROPPED: "dropped",
};

const STATUS_REVERSE_MAP: Record<TrackerWatchStatus, string> = {
  watching: "CURRENT",
  completed: "COMPLETED",
  "plan-to-watch": "PLANNING",
  "on-hold": "PAUSED",
  dropped: "DROPPED",
};

const FORMAT_MAP: Record<string, EntryType> = {
  TV: "tv",
  MOVIE: "movie",
  OVA: "ova",
  SPECIAL: "special",
  ONA: "tv",
  MUSIC: "special",
};

function pickTitle(title: AniListTitle): string {
  return title.romaji ?? "";
}

function pickAlternativeTitles(title: AniListTitle, synonyms: string[]): string[] | undefined {
  const seen = new Set<string>();
  const alts: string[] = [];

  const add = (value: string) => {
    if (seen.has(value)) return;
    seen.add(value);
    alts.push(value);
  };

  if (title.english && title.english !== title.romaji) add(title.english);
  if (title.native) add(title.native);
  for (const s of synonyms) {
    if (s !== title.romaji) add(s);
  }
  return alts.length > 0 ? alts : undefined;
}

function mapFormat(format: string): EntryType {
  return FORMAT_MAP[format] ?? "tv";
}

function mapStatus(status: string): TrackerWatchStatus {
  return ANILIST_STATUS_MAP[status] ?? "plan-to-watch";
}

const VIEWER_QUERY = `
query {
  Viewer {
    id
  }
}`;

const MEDIA_LIST_COLLECTION_QUERY = `
query ($type: MediaType!, $userId: Int!) {
  MediaListCollection(type: $type, userId: $userId) {
    lists {
      entries {
        mediaId
        status
        score
        progress
        media {
          title { romaji english native }
          coverImage { large }
          startDate { year }
          format
          episodes
          synonyms
        }
      }
    }
  }
}`;

const MEDIA_LIST_ENTRY_QUERY = `
query ($id: Int) {
  MediaList(id: $id) {
    id
    mediaId
    status
    score
    progress
    privateNotes
    media {
      title { romaji english }
      episodes
    }
  }
}`;

const SAVE_MEDIA_LIST_ENTRY_MUTATION = `
mutation ($id: Int, $mediaId: Int, $status: MediaListStatus, $scoreRaw: Int, $progress: Int, $privateNotes: String) {
  SaveMediaListEntry(id: $id, mediaId: $mediaId, status: $status, scoreRaw: $scoreRaw, progress: $progress, privateNotes: $privateNotes) {
    id
    status
    score
    progress
    privateNotes
  }
}`;

const MEDIA_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    synonyms
    description
    averageScore
    genres
    studios(isMain: true) { nodes { name } }
    coverImage { large }
    startDate { year }
    format
    episodes
  }
}`;

export class AniListPlugin implements TrackerPlugin {
  private baseUrl: string;
  private clientId: string;
  private token: string | null;
  private credentialStore: CredentialStore | null;
  private httpClient: HttpClient;

  constructor(options: {
    baseUrl: string;
    clientId?: string;
    token?: string;
    credentialStore?: CredentialStore;
    httpClient: HttpClient;
  }) {
    this.baseUrl = options.baseUrl;
    this.clientId = options.clientId ?? "";
    this.token = options.token ?? null;
    this.credentialStore = options.credentialStore ?? null;
    this.httpClient = options.httpClient;
  }

  async authenticate(): Promise<string> {
    if (this.token) return this.token;

    if (!this.credentialStore) {
      throw new TrackerError("auth_invalid", "No credential store available", "anilist");
    }

    const credential = await loadOrRefreshCredential(
      this.credentialStore,
      "anilist",
      this.refreshSession.bind(this),
    );
    this.token = credential.access_token;
    return this.token;
  }

  async generateAuthUrl(): Promise<string> {
    const authUrl = new URL("https://anilist.co/api/v2/oauth/authorize");
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("redirect_uri", ANILIST_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    return authUrl.toString();
  }

  async exchangeCode(code: string): Promise<TrackerCredential> {
    const response = await this.httpClient.fetch("https://anilist.co/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: this.clientId,
        redirect_uri: ANILIST_REDIRECT_URI,
        code,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as OAuthTokenResponse;

    if (!response.ok) {
      throw new TrackerError(
        "auth_invalid",
        `AniList token exchange failed: ${body.message ?? body.error ?? response.statusText}`,
        "anilist",
      );
    }

    const credential = buildCredentialFromToken(body.access_token ?? "", body.expires_in);

    if (this.credentialStore) {
      await this.credentialStore.setCredential("anilist", JSON.stringify(credential));
    }

    this.token = credential.access_token;
    return credential;
  }

  async ensureAuthenticated(): Promise<void> {
    await this.authenticate();
  }

  async refreshSession(): Promise<TrackerCredential> {
    throw new TrackerError(
      "auth_expired",
      "AniList does not support token refresh. Please re-authenticate.",
      "anilist",
    );
  }

  async getUserList(): Promise<TrackerAnime[]> {
    await this.ensureAuthenticated();

    const viewerData = await this.graphql<{ Viewer: { id: number } }>(VIEWER_QUERY);
    if (!viewerData?.Viewer?.id) {
      throw new TrackerError("auth_invalid", "Could not retrieve authenticated user ID", "anilist");
    }

    const data = await this.graphql<AniListMediaListResponse>(MEDIA_LIST_COLLECTION_QUERY, {
      type: "ANIME",
      userId: viewerData.Viewer.id,
    });
    if (!data?.MediaListCollection) return [];

    const results: TrackerAnime[] = [];
    for (const list of data.MediaListCollection.lists) {
      for (const entry of list.entries) {
        results.push({
          trackerId: String(entry.mediaId),
          title: pickTitle(entry.media.title),
          alternativeTitles: pickAlternativeTitles(entry.media.title, entry.media.synonyms),
          image: entry.media.coverImage.large ?? undefined,
          year: entry.media.startDate.year ?? undefined,
          entryType: mapFormat(entry.media.format),
          watchStatus: mapStatus(entry.status),
          episodesWatched: entry.progress,
          totalEpisodes: entry.media.episodes ?? 0,
          score: entry.score || undefined,
        });
      }
    }
    return results;
  }

  async getEntry(trackerId: string): Promise<TrackerEntry> {
    await this.ensureAuthenticated();
    const data = await this.graphql<AniListMediaListEntryResponse>(MEDIA_LIST_ENTRY_QUERY, {
      id: Number.parseInt(trackerId, 10),
    });
    if (!data?.MediaList) {
      return {
        trackerId,
        title: "",
        watchStatus: "plan-to-watch",
        episodesWatched: 0,
        totalEpisodes: 0,
      };
    }
    const entry = data.MediaList;
    return {
      trackerId: String(entry.id),
      title: pickTitle(entry.media.title),
      watchStatus: mapStatus(entry.status),
      episodesWatched: entry.progress,
      totalEpisodes: entry.media.episodes ?? 0,
      score: entry.score || undefined,
      notes: entry.privateNotes ?? undefined,
    };
  }

  async updateEntry(trackerId: string, changes: TrackerEntryChanges): Promise<void> {
    await this.ensureAuthenticated();
    const variables: Record<string, unknown> = {
      id: Number.parseInt(trackerId, 10),
    };
    if (changes.watchStatus !== undefined) {
      variables["status"] = STATUS_REVERSE_MAP[changes.watchStatus];
    }
    if (changes.episodesWatched !== undefined) {
      variables["progress"] = changes.episodesWatched;
    }
    if (changes.score !== undefined) {
      variables["scoreRaw"] = changes.score * 100;
    }
    if (changes.notes !== undefined) {
      variables["privateNotes"] = changes.notes;
    }
    await this.graphql(SAVE_MEDIA_LIST_ENTRY_MUTATION, variables);
  }

  async getAnimeDetails(trackerId: string): Promise<TrackerAnimeDetails> {
    await this.ensureAuthenticated();
    const data = await this.graphql<AniListMediaResponse>(MEDIA_QUERY, {
      id: Number.parseInt(trackerId, 10),
    });
    if (!data?.Media) {
      return {
        trackerId,
        title: "",
        entryType: "tv",
      };
    }
    const media = data.Media;
    return {
      trackerId: String(media.id),
      title: pickTitle(media.title),
      alternativeTitles: pickAlternativeTitles(media.title, media.synonyms),
      image: media.coverImage.large ?? undefined,
      year: media.startDate.year ?? undefined,
      entryType: mapFormat(media.format),
      synopsis: media.description ?? undefined,
      rating: media.averageScore ?? undefined,
      genres: media.genres,
      studio: media.studios.nodes[0]?.name ?? undefined,
      totalEpisodes: media.episodes ?? undefined,
    };
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await this.httpClient.fetch(this.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    let json: { data?: T; errors?: Array<{ message: string; status?: number }> };
    try {
      json = (await response.json()) as typeof json;
    } catch {
      throwHttpError(response, "anilist");
    }

    if (!response.ok || json.errors?.length) {
      throwHttpError(response, "anilist", undefined, json.errors);
    }
    return json.data ?? null;
  }
}
