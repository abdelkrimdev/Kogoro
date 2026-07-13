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

interface AniListMediaResponse {
  Media: {
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
  };
}

interface AniListSearchResponse {
  Media: {
    id: number;
    title: AniListTitle;
    format: string;
    episodes: number | null;
  } | null;
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

function buildMediaRelationsQuery(count: number): string {
  const aliases = Array.from(
    { length: count },
    (_, i) => `Media${i + 1}: Media(id: $id${i + 1}, type: ANIME)`,
  ).join("\n    ");
  const params = Array.from({ length: count }, (_, i) => `$id${i + 1}: Int`).join(", ");

  return `
query (${params}) {
    ${aliases} {
    id
    title { romaji }
    format
    episodes
    relations {
      edges {
        relationType
        node {
          id
          title { romaji }
          format
        }
      }
    }
    externalLinks {
      site
      id
    }
  }
}`;
}

function pickTitle(title: AniListTitle): string {
  return title.romaji ?? title.english ?? title.native ?? "";
}

export class AniListEnrichmentProvider implements EnrichmentProvider {
  constructor(
    private baseUrl: string,
    private httpClient: HttpClient,
    private token?: string,
  ) {}

  async searchByTitle(title: string): Promise<EnrichmentSearchResult | null> {
    const response = await this.graphql<AniListSearchResponse>(SEARCH_QUERY, { search: title });

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

    const query = buildMediaRelationsQuery(anilistIds.length);
    const variables: Record<string, number> = {};
    for (let i = 0; i < anilistIds.length; i++) {
      variables[`id${i + 1}`] = Number(anilistIds[i]);
    }

    const response = await this.graphql<Record<string, AniListMediaResponse["Media"]>>(
      query,
      variables,
    );

    return anilistIds.map((id, index) => {
      const media = response[`Media${index + 1}`];
      if (!media) {
        return {
          anilistId: id,
          title: `Unknown ${id}`,
          relations: [],
        };
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
    });
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

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as { data: T; errors?: Array<{ message: string }> };
    if (result.errors && result.errors.length > 0) {
      throw new Error(`AniList GraphQL error: ${result.errors[0]?.message}`);
    }

    return result.data;
  }
}
