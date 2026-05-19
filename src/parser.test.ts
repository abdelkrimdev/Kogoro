import { describe, expect, test } from "bun:test";
import { parse } from "./parser.ts";

describe("FilenameParser", () => {
  test("parses [Group] Anime Title - 01 (1080p).mkv", () => {
    const result = parse("[SubsPlease] Jujutsu Kaisen - 01 (1080p).mkv");
    expect(result.title).toBe("Jujutsu Kaisen");
    expect(result.episode).toBe(1);
    expect(result.season).toBeNull();
  });

  test("parses Anime Title - S01E13.mkv", () => {
    const result = parse("Anime Title - S01E13.mkv");
    expect(result.title).toBe("Anime Title");
    expect(result.season).toBe(1);
    expect(result.episode).toBe(13);
  });

  test("parses Anime Title - 12 [1080p].mkv", () => {
    const result = parse("Anime Title - 12 [1080p].mkv");
    expect(result.title).toBe("Anime Title");
    expect(result.episode).toBe(12);
  });

  test("extracts metadata tags: group, resolution, codec", () => {
    const result = parse("[Group] Anime Title - 01 (1080p) [HEVC].mkv");
    expect(result.title).toBe("Anime Title");
    expect(result.episode).toBe(1);
    expect(result.tags.group).toBe("Group");
    expect(result.tags.resolution).toBe("1080p");
    expect(result.tags.codec).toBe("HEVC");
  });

  test("parses movie filename with no episode number", () => {
    const result = parse("[Group] Anime Title The Movie.mkv");
    expect(result.title).toBe("Anime Title The Movie");
    expect(result.episode).toBeNull();
    expect(result.tags.group).toBe("Group");
  });

  test("parses absolute numbering: One Piece - 1071", () => {
    const result = parse("[Group] One Piece - 1071.mkv");
    expect(result.title).toBe("One Piece");
    expect(result.episode).toBe(1071);
  });

  test("returns empty result for garbage filenames", () => {
    const result = parse("completely.garbage.filename.avi");
    expect(result.title).toBeNull();
    expect(result.episode).toBeNull();
    expect(result.season).toBeNull();
  });

  test("returns empty result for empty string", () => {
    const result = parse("");
    expect(result.title).toBeNull();
    expect(result.episode).toBeNull();
  });

  test("uses custom regex pattern from options", () => {
    const customPattern = /^CUSTOM_(?<title>.+?)_(?<episode>\d+)$/;
    const result = parse("CUSTOM_My Anime_42.mkv", {
      patterns: [customPattern],
    });
    expect(result.title).toBe("My Anime");
    expect(result.episode).toBe(42);
    expect(result.season).toBeNull();
  });

  test("custom patterns override defaults", () => {
    const result = parse("[SubsPlease] Jujutsu Kaisen - 01 (1080p).mkv", {
      patterns: [],
    });
    expect(result.title).toBeNull();
  });

  test("handles spaces in title correctly", () => {
    const result = parse("[Group] Anime Title With - 05.mkv");
    expect(result.title).toBe("Anime Title With");
    expect(result.episode).toBe(5);
  });

  describe("Real-world filename patterns", () => {
    test("parses [Group] Title - ##v# [tags][CRC] (version suffix + CRC)", () => {
      const result = parse("[LUNATIC] Summertime Render - 06v2 [C530F0E1].mkv");
      expect(result.title).toBe("Summertime Render");
      expect(result.episode).toBe(6);
      expect(result.tags.group).toBe("LUNATIC");
    });

    test("parses [Group] Title - ##v# END [CRC] (version + END + CRC)", () => {
      const result = parse("[LUNATIC] Summertime Render - 25v2 END [592C6CD9].mkv");
      expect(result.title).toBe("Summertime Render");
      expect(result.episode).toBe(25);
    });

    test("parses [Group] Title - ## END [tags][CRC]", () => {
      const result = parse("[Sawada & Maryam] Uramichi Oniisan - 13 END [1080p][22D3E264].mkv");
      expect(result.title).toBe("Uramichi Oniisan");
      expect(result.episode).toBe(13);
    });

    test("parses [Group] Title - ## [multi-word-tag] (spaces in codec tag)", () => {
      const result = parse("[Cipher] Usagi Drop - 01 [BD 720p AAC][346A423F].mkv");
      expect(result.title).toBe("Usagi Drop");
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title - ## [res][codec][audio][sub] (multiple bracket groups)", () => {
      const result = parse(
        "[Anime Time] Tonikaku Kawaii - 01 [1080p][HEVC 10bit x265][AAC][Multi Sub].mkv",
      );
      expect(result.title).toBe("Tonikaku Kawaii");
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title - S##E## (season/episode pattern)", () => {
      const result = parse("[Judas] Maou-sama - S02E13.mkv");
      expect(result.title).toBe("Maou-sama");
      expect(result.tags.group).toBe("Judas");
      expect(result.season).toBe(2);
      expect(result.episode).toBe(13);
    });

    test("parses [Group] Title - S##E##v# (S##E## with version)", () => {
      const result = parse("[Judas] Sousou no Frieren - S01E01v2.mkv");
      expect(result.title).toBe("Sousou no Frieren");
      expect(result.tags.group).toBe("Judas");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title with multi-dash - S##E##v#", () => {
      const result = parse("[Judas] Dr Stone - Science Future - S04E06v2.mkv");
      expect(result.title).toBe("Dr Stone - Science Future");
      expect(result.tags.group).toBe("Judas");
      expect(result.season).toBe(4);
      expect(result.episode).toBe(6);
    });

    test("parses [Group] Title S##E## [CRC] (S##E## without leading dash)", () => {
      const result = parse("[Trix] Insomniacs After School S01E01 [015350F6].mkv");
      expect(result.title).toBe("Insomniacs After School");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title - ## [res][codec][audio][sub] (multi brackets)", () => {
      const result = parse(
        "[Valenciano] Yowamushi Pedal - Limit Break - 10 [1080p][AV1 10bit][AAC][Multi-Sub].mkv",
      );
      expect(result.title).toBe("Yowamushi Pedal - Limit Break");
      expect(result.episode).toBe(10);
    });

    test("parses [Group] Title - ## [res][codec][audio][sub] (Weekly) (trailing parens)", () => {
      const result = parse(
        "[Valenciano] Yowamushi Pedal - Limit Break - 10 [1080p][AV1 10bit][AAC][Multi-Sub] (Weekly).mkv",
      );
      expect(result.title).toBe("Yowamushi Pedal - Limit Break");
      expect(result.episode).toBe(10);
    });

    test("parses [Group] Title - ## [BD][codec][CRC] (multiple brackets before CRC)", () => {
      const result = parse(
        "[mohbaboo] Yowamushi Pedal - Grande Road - 01 [BD][x265 10bit opus][748752C1].mkv",
      );
      expect(result.title).toBe("Yowamushi Pedal - Grande Road");
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title - ## (1080p HEVC) (resolution+codec in parens)", () => {
      const result = parse(
        "[BAM25] Zom 100 - Zombie ni Naru made ni Shitai 100 no Koto - 01 (1080p HEVC).mkv",
      );
      expect(result.title).toBe("Zom 100 - Zombie ni Naru made ni Shitai 100 no Koto");
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title - ##v# (version suffix, no trailing tags)", () => {
      const result = parse("[Aiz-san Sub] Boku no Kokoro no Yabai Yatsu - 03v1.mkv");
      expect(result.title).toBe("Boku no Kokoro no Yabai Yatsu");
      expect(result.episode).toBe(3);
    });

    test("parses [Group] Title - ## END [tag] (END marker with absolute number)", () => {
      const result = parse("[Asahi] Jujutsu Kaisen - 59 END [1080p].mkv");
      expect(result.title).toBe("Jujutsu Kaisen");
      expect(result.episode).toBe(59);
    });

    test("parses [Group] Title - ## [res][codec-with-dots] (codec with dots and dashes)", () => {
      const result = parse("[KiyoshiiSubs] Gachiakuta - 01 [1080p][H.265 - 10Bit].mkv");
      expect(result.title).toBe("Gachiakuta");
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title - ## [res codec] (combined resolution codec bracket)", () => {
      const result = parse(
        "[Mugi] Kimetsu no Yaiba - Katanakaji no Sato-hen - 01 [1080p HEVC].mkv",
      );
      expect(result.title).toBe("Kimetsu no Yaiba - Katanakaji no Sato-hen");
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title S# - ## [res] [v#] (season marker in title, separate version bracket)", () => {
      const result = parse("[ReDEJA] Bungo Stray Dogs S5 - 01 [1080p] [v2].mkv");
      expect(result.title).toBe("Bungo Stray Dogs S5");
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title ## [tag] (no dash before episode)", () => {
      const result = parse("[Rocks-Himo] Sakamoto Days 01 [1080].mkv");
      expect(result.title).toBe("Sakamoto Days");
      expect(result.episode).toBe(1);
    });

    test("parses [Group] Title ##[tag] (no space before tag)", () => {
      const result = parse("[Rocks-Himo] Sakamoto Days 13[1080p].mkv");
      expect(result.title).toBe("Sakamoto Days");
      expect(result.episode).toBe(13);
    });

    test("parses Title - ## [tag][tag] (no group bracket, multiple tags)", () => {
      const result = parse("Trigun Stampede - 01 [1080p][Mini].mkv");
      expect(result.title).toBe("Trigun Stampede");
      expect(result.episode).toBe(1);
    });

    test("parses Title - ## v# [tag] (no group bracket, version suffix)", () => {
      const result = parse("Kanojo, Okarishimasu - 18 v2 [1080p][Mini].mkv");
      expect(result.title).toBe("Kanojo, Okarishimasu");
      expect(result.episode).toBe(18);
    });

    test("parses Title - ## END (tag) [tag] (no group bracket, END + paren+bracket tags)", () => {
      const result = parse(
        "Kimagure Orange Road - 48 END (BDRip 1440x1080p x265 HEVC FLAC 2.0)[sxales].mkv",
      );
      expect(result.title).toBe("Kimagure Orange Road");
      expect(result.episode).toBe(48);
    });

    test("parses [Group] Title - S##E00 (special episode E00)", () => {
      const result = parse("[Judas] Tonikaku Kawaii - S02E00.mkv");
      expect(result.title).toBe("Tonikaku Kawaii");
      expect(result.tags.group).toBe("Judas");
      expect(result.season).toBe(2);
      expect(result.episode).toBe(0);
    });

    test("parses [Group] Title with & in group name", () => {
      const result = parse(
        "[Celestial Dragons & Najma-Subs] Oshi No Ko - 01v2 [1080p HEVC][94F246F8].mkv",
      );
      expect(result.title).toBe("Oshi No Ko");
      expect(result.episode).toBe(1);
      expect(result.tags.group).toBe("Celestial Dragons & Najma-Subs");
    });
  });
});
