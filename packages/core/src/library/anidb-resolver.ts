import type { AnimeRepository } from "./anime-repository";

export class AnidbResolver {
  private titleIndex: Map<string, string> | null = null;
  private altTitleIndex: Map<string, string> | null = null;

  constructor(private animeRepo: AnimeRepository) {}

  resolveByTitle(title: string): string | null {
    this.ensureIndexed();
    const titleLower = title.toLowerCase();

    const direct = this.titleIndex?.get(titleLower);
    if (direct) return direct;

    const alt = this.altTitleIndex?.get(titleLower);
    if (alt) return alt;

    return null;
  }

  invalidate(): void {
    this.titleIndex = null;
    this.altTitleIndex = null;
  }

  private ensureIndexed(): void {
    if (this.titleIndex !== null && this.altTitleIndex !== null) return;

    this.titleIndex = new Map();
    this.altTitleIndex = new Map();

    const allAnime = this.animeRepo.listAnidbAnime();
    for (const a of allAnime) {
      this.titleIndex.set(a.title.toLowerCase(), a.anidbId);
      if (a.alternativeTitles) {
        for (const alt of a.alternativeTitles) {
          if (!this.altTitleIndex.has(alt.toLowerCase())) {
            this.altTitleIndex.set(alt.toLowerCase(), a.anidbId);
          }
        }
      }
    }
  }
}
