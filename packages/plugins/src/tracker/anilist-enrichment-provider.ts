import type {
  EnrichmentMediaResult,
  EnrichmentProvider,
  EnrichmentSearchResult,
  HttpClient,
} from "@kogoro/core";

interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

interface AniListMedia {
  id: number;
  title: AniListTitle;
  format: string;
  episodes: number | null;
  relations?: {
    edges: Array<{
      relationType: string;
      node: {
        id: number;
        title: AniListTitle;
        format: string;
      };
    }>;
  };
  externalLinks?: Array<{
    site: string;
    id: string;
  }>;
}

interface AniListGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; status?: number }>;
}

const SEARCH_QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME) {
    id
    title { romaji english native }
    format
    episodes
  }
}`;

const MEDIA_FIELDS = `{
  id
  title { romaji english native }
  format
  episodes
  relations {
    edges {
      relationType
      node {
        id
        title { romaji english native }
        format
      }
    }
  }
  externalLinks {
    site
    id
  }
}`;

const MAX_BATCH_SIZE = 20;

function buildBatchQuery(count: number): string {
  const params = Array.from({ length: count }, (_, i) => `$id${i + 1}: Int`).join(", ");
  const aliases = Array.from(
    { length: count },
    (_, i) => `Media${i + 1}: Media(id: $id${i + 1}, type: ANIME) ${MEDIA_FIELDS}`,
  ).join("\n");

  return `query (${params}) { ${aliases} }`;
}

function pickTitle(title: AniListTitle): string {
  return title.romaji ?? title.english ?? title.native ?? "";
}

function mapMediaResult(id: string, media: AniListMedia | null): EnrichmentMediaResult {
  if (!media) {
    return { anilistId: id, title: `Unknown ${id}`, relations: [] };
  }

  return {
    anilistId: String(media.id),
    title: pickTitle(media.title),
    format: media.format,
    episodes: media.episodes ?? undefined,
    relations: (media.relations?.edges ?? []).map((edge) => ({
      anilistId: String(edge.node.id),
      title: pickTitle(edge.node.title),
      relationType: edge.relationType,
      format: edge.node.format,
    })),
    externalLinks: media.externalLinks?.map((link) => ({
      site: link.site,
      id: link.id,
    })),
  };
}

export class AniListEnrichmentProvider implements EnrichmentProvider {
  constructor(
    private baseUrl: string,
    private httpClient: HttpClient,
    private token?: string,
    private batchSize: number = MAX_BATCH_SIZE,
  ) {}

  async searchByTitle(title: string): Promise<EnrichmentSearchResult | null> {
    const response = await this.graphql<{ Media: AniListMedia | null }>(SEARCH_QUERY, {
      search: title,
    });

    if (!response.Media) {
      return null;
    }

    return {
      anilistId: String(response.Media.id),
      title: pickTitle(response.Media.title),
      format: response.Media.format,
      episodes: response.Media.episodes ?? undefined,
    };
  }

  async getMediaDetailsBatch(anilistIds: string[]): Promise<EnrichmentMediaResult[]> {
    if (anilistIds.length === 0) return [];

    const results: EnrichmentMediaResult[] = [];

    for (let i = 0; i < anilistIds.length; i += this.batchSize) {
      const chunk = anilistIds.slice(i, i + this.batchSize);
      const chunkResults = await this.fetchMediaChunk(chunk);
      results.push(...chunkResults);
    }

    return results;
  }

  private async fetchMediaChunk(ids: string[]): Promise<EnrichmentMediaResult[]> {
    const query = buildBatchQuery(ids.length);
    const variables: Record<string, number> = {};

    for (let i = 0; i < ids.length; i++) {
      variables[`id${i + 1}`] = Number(ids[i]);
    }

    const response = await this.graphql<Record<string, AniListMedia | null>>(query, variables);

    return ids.map((id, index) => mapMediaResult(id, response[`Media${index + 1}`] ?? null));
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
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

    const json = await this.parseResponse<T>(response);

    if (json.data != null) {
      return json.data;
    }

    if (json.errors && json.errors.length > 0) {
      throw new Error(`AniList GraphQL error: ${json.errors[0]?.message}`);
    }

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
    }

    throw new Error(`AniList API error: empty response (status ${response.status})`);
  }

  private async parseResponse<T>(response: Response): Promise<AniListGraphqlResponse<T>> {
    try {
      return (await response.json()) as AniListGraphqlResponse<T>;
    } catch {
      throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
    }
  }
}
