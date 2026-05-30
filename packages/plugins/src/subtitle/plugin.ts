import type { SubtitleResult } from "@kogoro/core";

export interface SubtitlePlugin {
  search(
    animeTitle: string,
    season?: number,
    episode?: number,
    language?: string,
  ): Promise<SubtitleResult[]>;

  download(fileId: number): Promise<string>;
}
