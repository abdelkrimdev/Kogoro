import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabasePlugin } from "@kogoro/core";
import { createMockHttpClient, createSequenceHttpClient, withTempDir } from "@kogoro/core";
import { AniDBPlugin } from "./anidb-plugin";

function mockHttpClient(data: string, status = 200) {
  return createMockHttpClient(async (_url: string | URL, _init?: RequestInit) => {
    return new Response(data, {
      status,
      headers: { "Content-Type": "application/xml" },
    });
  });
}

const animetitlesXml = `<?xml version="1.0" encoding="UTF-8"?>
<animetitles>
  <anime aid="12345" year="2020">
    <title type="main" xml:lang="en">Jujutsu Kaisen</title>
    <title type="official" xml:lang="ja">呪術廻戦</title>
  </anime>
  <anime aid="67890" year="2013">
    <title type="main" xml:lang="en">Attack on Titan</title>
    <title type="official" xml:lang="ja">進撃の巨人</title>
  </anime>
</animetitles>`;

describe("AniDBPlugin", () => {
  describe("searchAnime", () => {
    test("returns matching anime from title cache", async () => {
      await withTempDir("anidb-cache", async (dir) => {
        writeFileSync(join(dir, "anime-titles.xml"), animetitlesXml);
        const plugin = new AniDBPlugin({
          client: "kogoro",
          clientver: "1",
          cacheDir: dir,
        });
        const results = await plugin.searchAnime("Jujutsu Kaisen");
        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe("12345");
        expect(results[0]?.titleEn).toBe("Jujutsu Kaisen");
        expect(results[0]?.titleJa).toBe("呪術廻戦");
        expect(results[0]?.year).toBe(2020);
      });
    });

    test("returns empty array for no matching title", async () => {
      await withTempDir("anidb-cache", async (dir) => {
        writeFileSync(join(dir, "anime-titles.xml"), animetitlesXml);
        const plugin = new AniDBPlugin({
          client: "kogoro",
          clientver: "1",
          cacheDir: dir,
        });
        const results = await plugin.searchAnime("Nonexistent Anime");
        expect(results).toEqual([]);
      });
    });

    test("matches case-insensitively", async () => {
      await withTempDir("anidb-cache", async (dir) => {
        writeFileSync(join(dir, "anime-titles.xml"), animetitlesXml);
        const plugin = new AniDBPlugin({
          client: "kogoro",
          clientver: "1",
          cacheDir: dir,
        });
        const results = await plugin.searchAnime("attack on titan");
        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe("67890");
      });
    });

    test("matches partial titles", async () => {
      await withTempDir("anidb-cache", async (dir) => {
        writeFileSync(join(dir, "anime-titles.xml"), animetitlesXml);
        const plugin = new AniDBPlugin({
          client: "kogoro",
          clientver: "1",
          cacheDir: dir,
        });
        const results = await plugin.searchAnime("Titan");
        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe("67890");
      });
    });

    test("skips anime with no English title", async () => {
      const xmlWithNoEnglishTitle = `<?xml version="1.0" encoding="UTF-8"?>
<animetitles>
  <anime aid="99999" year="2021">
    <title type="main" xml:lang="ja">日本語のみ</title>
  </anime>
  <anime aid="12345" year="2020">
    <title type="main" xml:lang="en">Jujutsu Kaisen</title>
  </anime>
</animetitles>`;
      await withTempDir("anidb-cache", async (dir) => {
        writeFileSync(join(dir, "anime-titles.xml"), xmlWithNoEnglishTitle);
        const plugin = new AniDBPlugin({
          client: "kogoro",
          clientver: "1",
          cacheDir: dir,
        });
        const results = await plugin.searchAnime("Jujutsu");
        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe("12345");
      });
    });

    test("returns empty array on cache download failure", async () => {
      await withTempDir("anidb-cache", async (dir) => {
        const plugin = new AniDBPlugin({
          client: "kogoro",
          clientver: "1",
          cacheDir: dir,
          httpClient: mockHttpClient("", 500),
        });
        const results = await plugin.searchAnime("Jujutsu Kaisen");
        expect(results).toEqual([]);
      });
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
    <title type="main" xml:lang="en">Jujutsu Kaisen</title>
    <title type="official" xml:lang="ja">呪術廻戦</title>
  </titles>
  <picture>12345.jpg</picture>
  <description>A boy fights curses.</description>
  <episodes>
    <episode id="1001">
      <epno>1</epno>
      <length>24</length>
      <airdate>2020-10-03</airdate>
      <rating>8.5</rating>
      <title xml:lang="en">Ryomen Sukuna</title>
    </episode>
    <episode id="1002">
      <epno>2</epno>
      <length>24</length>
      <airdate>2020-10-10</airdate>
      <rating>8.7</rating>
      <title xml:lang="en">For Myself</title>
    </episode>
  </episodes>
</anime>`;

    test("returns EpisodeResult array from anime XML", async () => {
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeXml),
      });
      const results = await plugin.getEpisodes("12345");
      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe("1001");
      expect(results[0]?.episode).toBe(1);
      expect(results[0]?.titleEn).toBe("Ryomen Sukuna");
      expect(results[0]?.airDate).toBe("2020-10-03");
      expect(results[0]?.entryType).toBe("tv");
      expect(results[1]?.id).toBe("1002");
      expect(results[1]?.episode).toBe(2);
      expect(results[1]?.titleEn).toBe("For Myself");
    });

    test("returns empty array on API failure", async () => {
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient("", 404),
      });
      const results = await plugin.getEpisodes("99999");
      expect(results).toEqual([]);
    });

    test("returns empty array when no episodes element", async () => {
      const xmlWithoutEpisodes = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>Movie</type>
  <titles>
    <title type="main" xml:lang="en">Some Movie</title>
  </titles>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(xmlWithoutEpisodes),
      });
      const results = await plugin.getEpisodes("12345");
      expect(results).toEqual([]);
    });

    test("maps anime types to entry types", async () => {
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

      const moviePlugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(movieXml),
      });
      const ovaPlugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(ovaXml),
      });
      const specialPlugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(specialXml),
      });
      const tvSpecialPlugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(tvSpecialXml),
      });

      expect((await moviePlugin.getEpisodes("111"))[0]?.entryType).toBe("movie");
      expect((await ovaPlugin.getEpisodes("222"))[0]?.entryType).toBe("ova");
      expect((await specialPlugin.getEpisodes("333"))[0]?.entryType).toBe("special");
      expect((await tvSpecialPlugin.getEpisodes("444"))[0]?.entryType).toBe("special");
    });

    test("defaults to season 1 when no related anime", async () => {
      const xml = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><title>Episode 1</title></episode>
  </episodes>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(xml),
      });
      const results = await plugin.getEpisodes("12345");
      expect(results).toHaveLength(1);
      expect(results[0]?.season).toBe(1);
    });

    test("resolves season from prequel", async () => {
      const prequelXml = `<?xml version="1.0"?>
<anime>
  <id>111</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><title>Old Ep</title></episode>
  </episodes>
</anime>`;
      const currentXml = `<?xml version="1.0"?>
<anime>
  <id>222</id>
  <type>TV Series</type>
  <relatedanime>
    <anime id="111" type="Prequel">Old</anime>
  </relatedanime>
  <episodes>
    <episode id="2"><epno>1</epno><title>New Ep</title></episode>
  </episodes>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: createSequenceHttpClient(
          new Response(currentXml, { headers: { "Content-Type": "application/xml" } }),
          new Response(prequelXml, { headers: { "Content-Type": "application/xml" } }),
        ),
      });
      const results = await plugin.getEpisodes("222");
      expect(results).toHaveLength(1);
      expect(results[0]?.season).toBe(2);
    });

    test("resolves season across multiple prequels", async () => {
      const grandparentXml = `<?xml version="1.0"?>
<anime>
  <id>111</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><title>Grandparent Ep</title></episode>
  </episodes>
</anime>`;
      const parentXml = `<?xml version="1.0"?>
<anime>
  <id>222</id>
  <type>TV Series</type>
  <relatedanime>
    <anime id="111" type="Prequel">Grandparent</anime>
  </relatedanime>
  <episodes>
    <episode id="2"><epno>1</epno><title>Parent Ep</title></episode>
  </episodes>
</anime>`;
      const currentXml = `<?xml version="1.0"?>
<anime>
  <id>333</id>
  <type>TV Series</type>
  <relatedanime>
    <anime id="222" type="Prequel">Parent</anime>
  </relatedanime>
  <episodes>
    <episode id="3"><epno>1</epno><title>Current Ep</title></episode>
  </episodes>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: createSequenceHttpClient(
          new Response(currentXml, { headers: { "Content-Type": "application/xml" } }),
          new Response(parentXml, { headers: { "Content-Type": "application/xml" } }),
          new Response(grandparentXml, { headers: { "Content-Type": "application/xml" } }),
        ),
      });
      const results = await plugin.getEpisodes("333");
      expect(results).toHaveLength(1);
      expect(results[0]?.season).toBe(3);
    });

    test("uses absolute episode numbers", async () => {
      const multiSeasonXml = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>25</epno><title>Episode 25</title></episode>
    <episode id="2"><epno>26</epno><title>Episode 26</title></episode>
  </episodes>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(multiSeasonXml),
      });
      const results = await plugin.getEpisodes("12345");
      expect(results).toHaveLength(2);
      expect(results[0]?.episode).toBe(25);
      expect(results[1]?.episode).toBe(26);
    });

    test("assigns same season to all episodes", async () => {
      const xml = `<?xml version="1.0"?>
<anime>
  <id>12345</id>
  <type>TV Series</type>
  <episodes>
    <episode id="1"><epno>1</epno><title>S1E1</title></episode>
    <episode id="2"><epno>2</epno><title>S1E2</title></episode>
    <episode id="3"><epno>3</epno><title>S1E3</title></episode>
  </episodes>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(xml),
      });
      const results = await plugin.getEpisodes("12345");
      expect(results).toHaveLength(3);
      expect(results[0]?.season).toBe(1);
      expect(results[0]?.episode).toBe(1);
      expect(results[1]?.season).toBe(1);
      expect(results[1]?.episode).toBe(2);
      expect(results[2]?.season).toBe(1);
      expect(results[2]?.episode).toBe(3);
    });

    test("throws on AniDB error XML", async () => {
      const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error code="500">Banned</error>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(errorXml),
      });
      await expect(plugin.getEpisodes("12345")).rejects.toThrow("AniDB error 500: Banned");
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
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeWithPictureXml),
      });
      const results = await plugin.getArtwork("12345", "poster");
      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe("poster");
      expect(results[0]?.url).toBe("https://cdn.anidb.net/images/main/12345.jpg");
    });

    test("returns empty array when no picture available", async () => {
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeWithoutPictureXml),
      });
      const results = await plugin.getArtwork("67890", "poster");
      expect(results).toEqual([]);
    });

    test("returns empty array for non-poster artwork types", async () => {
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeWithPictureXml),
      });
      const fanartResults = await plugin.getArtwork("12345", "fanart");
      expect(fanartResults).toEqual([]);
      const bannerResults = await plugin.getArtwork("12345", "banner");
      expect(bannerResults).toEqual([]);
    });

    test("returns empty array on API failure", async () => {
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient("", 404),
      });
      const results = await plugin.getArtwork("99999", "poster");
      expect(results).toEqual([]);
    });

    test("throws on AniDB error XML", async () => {
      const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error code="320">no such anime</error>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(errorXml),
      });
      await expect(plugin.getArtwork("99999", "poster")).rejects.toThrow(
        "AniDB error 320: no such anime",
      );
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
    <title type="main" xml:lang="en">Jujutsu Kaisen</title>
    <title type="official" xml:lang="ja">呪術廻戦</title>
  </titles>
  <description>A boy fights curses.</description>
</anime>`;

      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeXml),
      });
      const result = await plugin.getAnime("12345");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("12345");
      expect(result?.titleEn).toBe("Jujutsu Kaisen");
      expect(result?.titleJa).toBe("呪術廻戦");
      expect(result?.overview).toBe("A boy fights curses.");
      expect(result?.entryType).toBe("tv");
    });

    test("returns null on API failure", async () => {
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient("", 404),
      });
      const result = await plugin.getAnime("99999");
      expect(result).toBeNull();
    });

    test("throws on AniDB error XML", async () => {
      const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error code="310">illegal input or access denied</error>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(errorXml),
      });
      await expect(plugin.getAnime("12345")).rejects.toThrow(
        "AniDB error 310: illegal input or access denied",
      );
    });

    test("returns franchise root title for sequel", async () => {
      const prequelXml = `<?xml version="1.0"?>
<anime>
  <id>111</id>
  <type>TV Series</type>
  <startdate>2020-10-03</startdate>
  <titles>
    <title type="main" xml:lang="en">Root Series</title>
    <title type="official" xml:lang="ja">ルートシリーズ</title>
  </titles>
</anime>`;
      const sequelXml = `<?xml version="1.0"?>
<anime>
  <id>222</id>
  <type>TV Series</type>
  <startdate>2021-01-10</startdate>
  <titles>
    <title type="main" xml:lang="en">Sequel Series</title>
    <title type="official" xml:lang="ja">続編シリーズ</title>
  </titles>
  <relatedanime>
    <anime id="111" type="Prequel">Root</anime>
  </relatedanime>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: createSequenceHttpClient(
          new Response(sequelXml, { headers: { "Content-Type": "application/xml" } }),
          new Response(prequelXml, { headers: { "Content-Type": "application/xml" } }),
        ),
      });
      const result = await plugin.getAnime("222");
      expect(result?.titleEn).toBe("Root Series");
      expect(result?.titleJa).toBe("ルートシリーズ");
      expect(result?.id).toBe("222");
    });

    test("returns root title across deep prequel chain", async () => {
      const grandparentXml = `<?xml version="1.0"?>
<anime>
  <id>111</id>
  <type>TV Series</type>
  <titles>
    <title type="main" xml:lang="en">Franchise Origin</title>
  </titles>
</anime>`;
      const parentXml = `<?xml version="1.0"?>
<anime>
  <id>222</id>
  <type>TV Series</type>
  <titles>
    <title type="main" xml:lang="en">Middle Sequel</title>
  </titles>
  <relatedanime>
    <anime id="111" type="Prequel">Origin</anime>
  </relatedanime>
</anime>`;
      const currentXml = `<?xml version="1.0"?>
<anime>
  <id>333</id>
  <type>TV Series</type>
  <titles>
    <title type="main" xml:lang="en">Latest Sequel</title>
  </titles>
  <relatedanime>
    <anime id="222" type="Prequel">Middle</anime>
  </relatedanime>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: createSequenceHttpClient(
          new Response(currentXml, { headers: { "Content-Type": "application/xml" } }),
          new Response(parentXml, { headers: { "Content-Type": "application/xml" } }),
          new Response(grandparentXml, { headers: { "Content-Type": "application/xml" } }),
        ),
      });
      const result = await plugin.getAnime("333");
      expect(result?.titleEn).toBe("Franchise Origin");
    });

    test("falls back to own title when prequel has no English title", async () => {
      const prequelXml = `<?xml version="1.0"?>
<anime>
  <id>111</id>
  <type>TV Series</type>
  <titles>
    <title type="main" xml:lang="ja">日本語のみ</title>
  </titles>
</anime>`;
      const sequelXml = `<?xml version="1.0"?>
<anime>
  <id>222</id>
  <type>TV Series</type>
  <titles>
    <title type="main" xml:lang="en">English Sequel</title>
  </titles>
  <relatedanime>
    <anime id="111" type="Prequel">Root</anime>
  </relatedanime>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: createSequenceHttpClient(
          new Response(sequelXml, { headers: { "Content-Type": "application/xml" } }),
          new Response(prequelXml, { headers: { "Content-Type": "application/xml" } }),
        ),
      });
      const result = await plugin.getAnime("222");
      expect(result?.titleEn).toBe("English Sequel");
    });

    test("returns null when neither anime nor prequel has English title", async () => {
      const prequelXml = `<?xml version="1.0"?>
<anime>
  <id>111</id>
  <type>TV Series</type>
  <titles>
    <title type="main" xml:lang="ja">日本アニメ</title>
  </titles>
</anime>`;
      const sequelXml = `<?xml version="1.0"?>
<anime>
  <id>222</id>
  <type>TV Series</type>
  <titles>
    <title type="main" xml:lang="ja">続編</title>
  </titles>
  <relatedanime>
    <anime id="111" type="Prequel">Root</anime>
  </relatedanime>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: createSequenceHttpClient(
          new Response(sequelXml, { headers: { "Content-Type": "application/xml" } }),
          new Response(prequelXml, { headers: { "Content-Type": "application/xml" } }),
        ),
      });
      const result = await plugin.getAnime("222");
      expect(result).toBeNull();
    });
  });

  test("satisfies DatabasePlugin contract", () => {
    const plugin: DatabasePlugin = new AniDBPlugin({
      client: "kogoro",
      clientver: "1",
    });
    expect(plugin.validate).toBeInstanceOf(Function);
    expect(plugin.searchAnime).toBeInstanceOf(Function);
    expect(plugin.getEpisodes).toBeInstanceOf(Function);
    expect(plugin.getAnime).toBeInstanceOf(Function);
    expect(plugin.getArtwork).toBeInstanceOf(Function);
  });

  describe("validate", () => {
    test("returns valid when API call succeeds", async () => {
      const animeXml = `<?xml version="1.0" encoding="UTF-8"?>
<anime>
  <id>1</id>
  <type>TV Series</type>
  <titles>
    <title type="main" xml:lang="en">Cowboy Bebop</title>
  </titles>
</anime>`;
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient(animeXml),
      });
      const result = await plugin.validate();
      expect(result).toEqual({ valid: true });
    });

    test("returns invalid when client is rejected", async () => {
      const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<error code="310">illegal input or access denied</error>`;
      const plugin = new AniDBPlugin({
        client: "bad-client",
        clientver: "1",
        httpClient: mockHttpClient(errorXml),
      });
      const result = await plugin.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain("310");
    });

    test("returns invalid on HTTP error", async () => {
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: mockHttpClient("", 500),
      });
      const result = await plugin.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain("500");
    });

    test("returns invalid on network error", async () => {
      const plugin = new AniDBPlugin({
        client: "kogoro",
        clientver: "1",
        httpClient: createMockHttpClient(async () => {
          throw new Error("Connection refused");
        }),
      });
      const result = await plugin.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Connection refused");
    });
  });
});
