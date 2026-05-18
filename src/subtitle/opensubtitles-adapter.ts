import type { SubtitlePlugin } from "./subtitle-plugin.ts";
import type { SubtitleResult } from "./types.ts";

const BASE_URL = "https://api.opensubtitles.com/api/v1";

interface OSSearchAttributes {
  subtitle_id: number;
  language: string;
  download_count: number;
  file_id: number;
}

interface OSSearchItem {
  id: string;
  type: string;
  attributes: OSSearchAttributes;
}

interface OSSearchResponse {
  data: OSSearchItem[];
}

interface OSDownloadResponse {
  link: string;
  file_name: string;
}

export class OpenSubtitlesAdapter implements SubtitlePlugin {
  private fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>;

  constructor(
    private options: {
      apiKey: string;
      fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>;
    },
  ) {
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  async search(
    animeTitle: string,
    season?: number,
    episode?: number,
    language: string = "en",
  ): Promise<SubtitleResult[]> {
    const params = new URLSearchParams({
      query: animeTitle,
      languages: language,
    });
    if (season !== undefined) params.set("season_number", String(season));
    if (episode !== undefined) params.set("episode_number", String(episode));

    const response = await this.fetchFn(`${BASE_URL}/subtitles?${params.toString()}`, {
      headers: {
        "Api-Key": this.options.apiKey,
        "User-Agent": "Kogoro/0.1.0",
      },
    });

    if (!response.ok) return [];

    const json = (await response.json()) as OSSearchResponse;
    return json.data.map(
      (item): SubtitleResult => ({
        id: item.id,
        fileId: item.attributes.file_id,
        language: item.attributes.language,
        format: "srt",
        score: item.attributes.download_count,
        fileName: "",
      }),
    );
  }

  async download(fileId: number): Promise<string> {
    const response = await this.fetchFn(`${BASE_URL}/download`, {
      method: "POST",
      headers: {
        "Api-Key": this.options.apiKey,
        "User-Agent": "Kogoro/0.1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!response.ok) return "";

    const json = (await response.json()) as OSDownloadResponse;
    const contentResponse = await this.fetchFn(json.link);
    if (!contentResponse.ok) return "";
    return contentResponse.text();
  }
}
