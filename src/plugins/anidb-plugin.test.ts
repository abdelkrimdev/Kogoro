import { describe, expect, test } from "bun:test";
import { HttpClient } from "../http-client";
import { AniDBPlugin } from "./anidb-plugin";
import type { DatabasePlugin } from "./database-plugin";

function mockHttpClient(data: string, status = 200): HttpClient {
  return new HttpClient({
    minDelay: 0,
    maxRetries: 0,
    fetch: async (_url: string | URL, _init?: RequestInit) => {
      return new Response(data, {
        status,
        headers: { "Content-Type": "application/xml" },
      });
    },
  });
}

const animetitlesXml = `<?xml version="1.0" encoding="UTF-8"?>
<animetitles>
  <anime aid="12345" year="2020">
    <title type="main" lang="en" xml:lang="en">Jujutsu Kaisen</title>
    <title type="official" lang="ja" xml:lang="ja">呪術廻戦</title>
  </anime>
  <anime aid="67890" year="2013">
    <title type="main" lang="en" xml:lang="en">Attack on Titan</title>
    <title type="official" lang="ja" xml:lang="ja">進撃の巨人</title>
  </anime>
</animetitles>`;

describe("AniDBPlugin", () => {
  describe("searchAnime", () => {
    test("returns AnimeResult array from animetitles XML", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animetitlesXml),
      });
      const results = await adapter.searchAnime("Jujutsu Kaisen");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("12345");
      expect(results[0]?.title).toBe("Jujutsu Kaisen");
      expect(results[0]?.originalTitle).toBe("呪術廻戦");
      expect(results[0]?.year).toBe(2020);
    });

    test("returns empty array for no matching title", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animetitlesXml),
      });
      const results = await adapter.searchAnime("Nonexistent Anime");
      expect(results).toEqual([]);
    });

    test("matches case-insensitively", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animetitlesXml),
      });
      const results = await adapter.searchAnime("attack on titan");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("67890");
    });

    test("matches partial titles", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animetitlesXml),
      });
      const results = await adapter.searchAnime("Titan");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("67890");
    });

    test("skips anime with no English title", async () => {
      const xmlWithNoEnglishTitle = `<?xml version="1.0" encoding="UTF-8"?>
<animetitles>
  <anime aid="99999" year="2021">
    <title type="main" lang="ja" xml:lang="ja">日本語のみ</title>
  </anime>
  <anime aid="12345" year="2020">
    <title type="main" lang="en" xml:lang="en">Jujutsu Kaisen</title>
  </anime>
</animetitles>`;
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(xmlWithNoEnglishTitle),
      });
      const results = await adapter.searchAnime("Jujutsu");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("12345");
    });
  });

  describe("getEpisodes", () => {
    const animeXml = `<?xml version="1.0" encoding="UTF-8"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodecount>2</episodecount>
  <startdate>2020-10-03</startdate>
  <enddate>2020-10-10</enddate>
  <titles>
    <title type="main" lang="en" xml:lang="en">Jujutsu Kaisen</title>
    <title type="official" lang="ja" xml:lang="ja">呪術廻戦</title>
  </titles>
  <picture>12345.jpg</picture>
  <description>A boy fights curses.</description>
  <episodes>
    <episode id="1001">
      <epno>1</epno>
      <length>24</length>
      <airdate>2020-10-03</airdate>
      <rating>8.5</rating>
      <title>Ryomen Sukuna</title>
    </episode>
    <episode id="1002">
      <epno>2</epno>
      <length>24</length>
      <airdate>2020-10-10</airdate>
      <rating>8.7</rating>
      <title>For Myself</title>
    </episode>
  </episodes>
</anime>`;

    test("returns EpisodeResult array from anime XML", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeXml),
      });
      const results = await adapter.getEpisodes("12345");
      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe("1001");
      expect(results[0]?.episode).toBe(1);
      expect(results[0]?.title).toBe("Ryomen Sukuna");
      expect(results[0]?.airDate).toBe("2020-10-03");
      expect(results[0]?.entryType).toBe("tv");
      expect(results[1]?.id).toBe("1002");
      expect(results[1]?.episode).toBe(2);
      expect(results[1]?.title).toBe("For Myself");
    });

    test("returns empty array on API failure", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient("", 404),
      });
      const results = await adapter.getEpisodes("99999");
      expect(results).toEqual([]);
    });

    test("returns empty array when no episodes element", async () => {
      const xmlWithoutEpisodes = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>Movie</type>
  <titles>
    <title type="main" lang="en" xml:lang="en">Some Movie</title>
  </titles>
</anime>`;
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(xmlWithoutEpisodes),
      });
      const results = await adapter.getEpisodes("12345");
      expect(results).toEqual([]);
    });

    test("maps anime type to entry type", async () => {
      const movieXml = `<?xml version="1.0"?>
<anime>
  <id>111</id>
  <type>Movie</type>
  <episodes>
    <episode id="1"><epno>1</epno><title>Movie Title</title></episode>
  </episodes>
</anime>`;
      const ovaXml = `<?xml version="1.0"?>
<anime>
  <id>222</id>
  <type>OVA</type>
  <episodes>
    <episode id="2"><epno>1</epno><title>OVA Title</title></episode>
  </episodes>
</anime>`;
      const specialXml = `<?xml version="1.0"?>
<anime>
  <id>333</id>
  <type>Special</type>
  <episodes>
    <episode id="3"><epno>1</epno><title>Special Title</title></episode>
  </episodes>
</anime>`;
      const tvSpecialXml = `<?xml version="1.0"?>
<anime>
  <id>444</id>
  <type>TV Special</type>
  <episodes>
    <episode id="4"><epno>1</epno><title>TV Special Title</title></episode>
  </episodes>
</anime>`;

      const movieAdapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(movieXml),
      });
      const ovaAdapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(ovaXml),
      });
      const specialAdapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(specialXml),
      });
      const tvSpecialAdapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(tvSpecialXml),
      });

      expect((await movieAdapter.getEpisodes("111"))[0]?.entryType).toBe("movie");
      expect((await ovaAdapter.getEpisodes("222"))[0]?.entryType).toBe("ova");
      expect((await specialAdapter.getEpisodes("333"))[0]?.entryType).toBe("special");
      expect((await tvSpecialAdapter.getEpisodes("444"))[0]?.entryType).toBe("special");
    });

    test("parses season element from episode XML when present", async () => {
      const multiSeasonXml = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><season>1</season><title>Episode 1</title></episode>
    <episode id="2"><epno>2</epno><season>1</season><title>Episode 2</title></episode>
    <episode id="3"><epno>25</epno><season>2</season><title>Season 2 Ep 1</title></episode>
  </episodes>
</anime>`;
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(multiSeasonXml),
      });
      const results = await adapter.getEpisodes("12345");
      expect(results).toHaveLength(3);
      expect(results[0]?.season).toBe(1);
      expect(results[0]?.episode).toBe(1);
      expect(results[1]?.season).toBe(1);
      expect(results[1]?.episode).toBe(2);
      expect(results[2]?.season).toBe(2);
      expect(results[2]?.episode).toBe(25);
    });

    test("falls back to season 1 when no season element in episode", async () => {
      const xmlWithoutSeason = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><title>No Season Tag</title></episode>
    <episode id="2"><epno>2</epno><title>Also No Season</title></episode>
  </episodes>
</anime>`;
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(xmlWithoutSeason),
      });
      const results = await adapter.getEpisodes("12345");
      expect(results).toHaveLength(2);
      expect(results[0]?.season).toBe(1);
      expect(results[1]?.season).toBe(1);
    });

    test("uses absolute episode number from epno", async () => {
      const multiSeasonXml = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>25</epno><title>Episode 25</title></episode>
    <episode id="2"><epno>26</epno><title>Episode 26</title></episode>
  </episodes>
</anime>`;
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(multiSeasonXml),
      });
      const results = await adapter.getEpisodes("12345");
      expect(results).toHaveLength(2);
      expect(results[0]?.episode).toBe(25);
      expect(results[1]?.episode).toBe(26);
    });

    test("parses season from episode XML element", async () => {
      const multiSeasonXml = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><season>1</season><title>S1E1</title></episode>
    <episode id="2"><epno>2</epno><season>1</season><title>S1E2</title></episode>
    <episode id="3"><epno>3</epno><season>2</season><title>S2E1</title></episode>
  </episodes>
</anime>`;
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(multiSeasonXml),
      });
      const results = await adapter.getEpisodes("12345");
      expect(results).toHaveLength(3);
      expect(results[0]?.season).toBe(1);
      expect(results[0]?.episode).toBe(1);
      expect(results[1]?.season).toBe(1);
      expect(results[1]?.episode).toBe(2);
      expect(results[2]?.season).toBe(2);
      expect(results[2]?.episode).toBe(3);
    });

    test("defaults season to 1 when season element is absent", async () => {
      const noSeasonXml = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><title>No Season Tag</title></episode>
    <episode id="2"><epno>2</epno><season>2</season><title>With Season Tag</title></episode>
  </episodes>
</anime>`;
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(noSeasonXml),
      });
      const results = await adapter.getEpisodes("12345");
      expect(results).toHaveLength(2);
      expect(results[0]?.season).toBe(1);
      expect(results[1]?.season).toBe(2);
    });

    test("defaults season to 1 when season element is invalid", async () => {
      const invalidSeasonXml = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><season>abc</season><title>Invalid Season</title></episode>
  </episodes>
</anime>`;
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(invalidSeasonXml),
      });
      const results = await adapter.getEpisodes("12345");
      expect(results).toHaveLength(1);
      expect(results[0]?.season).toBe(1);
      expect(results[0]?.episode).toBe(1);
    });
  });

  describe("getArtwork", () => {
    const animeWithPictureXml = `<?xml version="1.0" encoding="UTF-8"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <picture>12345.jpg</picture>
  <description>A boy fights curses.</description>
</anime>`;

    const animeWithoutPictureXml = `<?xml version="1.0" encoding="UTF-8"?>
<anime>
  <id>67890</id>
  <type>TV Series</type>
  <description>No picture.</description>
</anime>`;

    test("returns poster artwork from anime picture", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeWithPictureXml),
      });
      const results = await adapter.getArtwork("12345", "poster");
      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe("poster");
      expect(results[0]?.url).toBe("https://cdn.anidb.net/images/main/12345.jpg");
    });

    test("returns empty array when no picture element", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeWithoutPictureXml),
      });
      const results = await adapter.getArtwork("67890", "poster");
      expect(results).toEqual([]);
    });

    test("returns empty array for non-poster artwork types", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeWithPictureXml),
      });
      const fanartResults = await adapter.getArtwork("12345", "fanart");
      expect(fanartResults).toEqual([]);
      const bannerResults = await adapter.getArtwork("12345", "banner");
      expect(bannerResults).toEqual([]);
    });

    test("returns empty array on API failure", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient("", 404),
      });
      const results = await adapter.getArtwork("99999", "poster");
      expect(results).toEqual([]);
    });
  });

  describe("error handling", () => {
    test("returns empty array on API failure for searchAnime", async () => {
      const adapter = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient("", 500),
      });
      const results = await adapter.searchAnime("Jujutsu Kaisen");
      expect(results).toEqual([]);
    });
  });
});

describe("getAnime", () => {
  test("returns AnimeResult from anime XML for a valid ID", async () => {
    const animeXml = `<?xml version="1.0" encoding="UTF-8"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <startdate>2020-10-03</startdate>
  <titles>
    <title type="main" lang="en" xml:lang="en">Jujutsu Kaisen</title>
    <title type="official" lang="ja" xml:lang="ja">呪術廻戦</title>
  </titles>
  <description>A boy fights curses.</description>
</anime>`;

    const adapter = new AniDBPlugin({
      client: "kogoro",
      clientver: "1",
      httpClient: mockHttpClient(animeXml),
    });
    const result = await adapter.getAnime("12345");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("12345");
    expect(result?.title).toBe("Jujutsu Kaisen");
    expect(result?.originalTitle).toBe("呪術廻戦");
    expect(result?.overview).toBe("A boy fights curses.");
    expect(result?.entryType).toBe("tv");
  });

  test("returns null on API failure", async () => {
    const adapter = new AniDBPlugin({
      client: "kogoro",
      clientver: "1",
      httpClient: mockHttpClient("", 404),
    });
    const result = await adapter.getAnime("99999");
    expect(result).toBeNull();
  });
});

describe("DatabasePlugin interface", () => {
  test("interface is defined", () => {
    const adapter: DatabasePlugin = new AniDBPlugin({
      client: "kogoro",
      clientver: "1",
    });
    expect(adapter.searchAnime).toBeInstanceOf(Function);
    expect(adapter.getEpisodes).toBeInstanceOf(Function);
    expect(adapter.getAnime).toBeInstanceOf(Function);
    expect(adapter.getArtwork).toBeInstanceOf(Function);
  });
});
