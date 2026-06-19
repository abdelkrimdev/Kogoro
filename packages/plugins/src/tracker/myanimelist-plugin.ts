import type {
  CredentialStore,
  HttpClient,
  TrackerAnime,
  TrackerAnimeDetails,
  TrackerEntry,
  TrackerEntryChanges,
  TrackerPlugin,
  TrackerWatchStatus,
} from "@kogoro/core";

interface MALNode {
  id: number;
  title: string;
  main_picture?: {
    medium: string;
    large: string;
  };
  alternative_titles?: {
    en?: string;
    ja?: string;
  };
  start_date?: string;
  media_type?: string;
  num_episodes?: number;
}

interface MALListStatus {
  status: string;
  score: number;
  num_episodes_watched: number;
  is_rewatching: boolean;
  updated_at: string;
}

interface MALAnimeListResponse {
  data: Array<{
    node: MALNode;
    list_status?: MALListStatus;
  }>;
  paging?: {
    previous?: string;
    next?: string;
  };
}

interface MALAnimeDetailsResponse extends MALNode {
  synopsis?: string;
  mean?: number;
  genres?: Array<{ id: number; name: string }>;
  studios?: Array<{ id: number; name: string }>;
  my_list_status?: MALListStatus;
}

function mapMALStatus(status: string): TrackerWatchStatus {
  switch (status) {
    case "watching":
      return "watching";
    case "completed":
      return "completed";
    case "on_hold":
      return "on-hold";
    case "dropped":
      return "dropped";
    case "plan_to_watch":
      return "plan-to-watch";
    default:
      return "plan-to-watch";
  }
}

function mapToKogoroStatus(status: TrackerWatchStatus): string {
  switch (status) {
    case "watching":
      return "watching";
    case "completed":
      return "completed";
    case "on-hold":
      return "on_hold";
    case "dropped":
      return "dropped";
    case "plan-to-watch":
      return "plan_to_watch";
    default:
      return "plan_to_watch";
  }
}

function mapMediaType(mediaType: string | undefined): "tv" | "movie" | "ova" | "special" {
  switch (mediaType) {
    case "tv":
    case "tv_special":
      return "tv";
    case "movie":
      return "movie";
    case "ova":
      return "ova";
    case "special":
      return "special";
    default:
      return "tv";
  }
}

export class MyAnimeListPlugin implements TrackerPlugin {
  private static readonly BASE_URL = "https://api.myanimelist.net/v2";

  private accessToken: string | null = null;
  private credentialStore: CredentialStore;
  private httpClient: HttpClient;

  constructor(options: {
    credentialStore: CredentialStore;
    httpClient: HttpClient;
  }) {
    this.credentialStore = options.credentialStore;
    this.httpClient = options.httpClient;
  }

  async authenticate(): Promise<string> {
    const token = await this.credentialStore.getCredential("mal");
    if (token) {
      this.accessToken = token;
      return token;
    }

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    await this.credentialStore.setCredential("mal_code_verifier", codeVerifier);

    const authUrl = new URL("https://myanimelist.net/v1/oauth2/authorize");
    authUrl.searchParams.set("client_id", process.env["MAL_CLIENT_ID"] || "");
    authUrl.searchParams.set("redirect_uri", "http://localhost:3000/callback");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("scope", "write:users");

    throw new Error(
      `MAL authentication requires OAuth flow. Please visit: ${authUrl.toString()} and complete authentication.`,
    );
  }

  async getUserList(): Promise<TrackerAnime[]> {
    await this.ensureAuthenticated();

    const allAnime: TrackerAnime[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const data = await this.fetchJson<MALAnimeListResponse>(
        `${MyAnimeListPlugin.BASE_URL}/users/@me/animelist?offset=${offset}&limit=${limit}&fields=list_status`,
      );

      for (const item of data.data) {
        if (!item.list_status) continue;

        allAnime.push({
          trackerId: String(item.node.id),
          title: item.node.title,
          alternativeTitles: [
            item.node.alternative_titles?.en,
            item.node.alternative_titles?.ja,
          ].filter(Boolean) as string[],
          image: item.node.main_picture?.large || item.node.main_picture?.medium,
          year: item.node.start_date
            ? Number.parseInt(item.node.start_date.substring(0, 4), 10)
            : undefined,
          entryType: mapMediaType(item.node.media_type),
          watchStatus: mapMALStatus(item.list_status.status),
          episodesWatched: item.list_status.num_episodes_watched,
          totalEpisodes: item.node.num_episodes || 0,
          score: item.list_status.score || undefined,
        });
      }

      if (!data.paging?.next) break;
      offset += limit;
    }

    return allAnime;
  }

  async getEntry(trackerId: string): Promise<TrackerEntry> {
    await this.ensureAuthenticated();

    const data = await this.fetchJson<MALAnimeDetailsResponse>(
      `${MyAnimeListPlugin.BASE_URL}/anime/${trackerId}?fields=my_list_status,num_episodes`,
    );

    if (!data.my_list_status) {
      throw new Error(`Anime ${trackerId} not in user's list`);
    }

    return {
      trackerId: String(data.id),
      title: data.title,
      watchStatus: mapMALStatus(data.my_list_status.status),
      episodesWatched: data.my_list_status.num_episodes_watched,
      totalEpisodes: data.num_episodes || 0,
      score: data.my_list_status.score || undefined,
    };
  }

  async updateEntry(trackerId: string, changes: TrackerEntryChanges): Promise<void> {
    await this.ensureAuthenticated();

    const params = new URLSearchParams();

    if (changes.watchStatus !== undefined) {
      params.append("status", mapToKogoroStatus(changes.watchStatus));
    }

    if (changes.episodesWatched !== undefined) {
      params.append("num_watched_episodes", String(changes.episodesWatched));
    }

    if (changes.score !== undefined) {
      params.append("score", String(changes.score));
    }

    if (changes.notes !== undefined) {
      params.append("comments", changes.notes);
    }

    const response = await this.httpClient.fetch(
      `${MyAnimeListPlugin.BASE_URL}/anime/${trackerId}/my_list_status`,
      {
        method: "PATCH",
        headers: {
          ...this.authHeaders("application/x-www-form-urlencoded"),
        },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to update MAL entry: ${response.status}`);
    }
  }

  async getAnimeDetails(trackerId: string): Promise<TrackerAnimeDetails> {
    await this.ensureAuthenticated();

    const data = await this.fetchJson<MALAnimeDetailsResponse>(
      `${MyAnimeListPlugin.BASE_URL}/anime/${trackerId}?fields=synopsis,mean,genres,studios,main_picture,alternative_titles,start_date,num_episodes,media_type`,
    );

    return {
      trackerId: String(data.id),
      title: data.title,
      alternativeTitles: [data.alternative_titles?.en, data.alternative_titles?.ja].filter(
        Boolean,
      ) as string[],
      image: data.main_picture?.large || data.main_picture?.medium,
      year: data.start_date ? Number.parseInt(data.start_date.substring(0, 4), 10) : undefined,
      entryType: mapMediaType(data.media_type),
      synopsis: data.synopsis,
      rating: data.mean,
      genres: data.genres?.map((g) => g.name),
      studio: data.studios?.[0]?.name,
      totalEpisodes: data.num_episodes,
    };
  }

  private authHeaders(contentType: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": contentType,
    };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.httpClient.fetch(url, {
      method: "GET",
      headers: this.authHeaders("application/json"),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch MAL data: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken) {
      await this.authenticate();
    }
  }
}
