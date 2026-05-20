import type { DatabasePlugin } from "./plugins/database/plugin";
import type { ArtworkResult } from "./plugins/database/types";

export function mockFetch(
  data: string,
  status = 200,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, _init?: RequestInit) => {
    return new Response(data, {
      status,
      headers: { "Content-Type": "image/jpeg" },
    });
  };
}

export const testImageBytes = "\xff\xd8\xff\xe0\u0000\u0010JFIF\u0000\u0001";

export function createMockDb(artworks: ArtworkResult[]): DatabasePlugin {
  return {
    async searchAnime() {
      return [];
    },
    async getEpisodes() {
      return [];
    },
    async getArtwork() {
      return artworks;
    },
    async getAnime() {
      return null;
    },
  };
}
