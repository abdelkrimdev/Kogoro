import type { SubtitleResult } from "./types.ts";

export interface SubtitlePlugin {
  search(
    animeTitle: string,
    season?: number,
    episode?: number,
    language?: string,
  ): Promise<SubtitleResult[]>;

  download(fileId: number): Promise<string>;
}
