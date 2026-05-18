import type { SubtitleResult } from "./types.ts";

export interface SubtitlePlugin {
  search(
    animeTitle: string,
    season?: number,
    episode?: number,
    language?: string,
  ): Promise<SubtitleResult[]>;

  download(subtitleId: number): Promise<string>;
}
