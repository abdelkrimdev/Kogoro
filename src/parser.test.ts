import { describe, expect, test } from "bun:test";
import { parse } from "./parser.ts";

describe("Filename parsing", () => {
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
    expect(result.tags.codec).toBe("hevc");
  });

  test("parses movie filename with no episode number", () => {
    const result = parse("[Group] Anime Title The Movie.mkv");
    expect(result.title).toBe("Anime Title The Movie");
    expect(result.episode).toBeNull();
    expect(result.tags.group).toBe("Group");
  });

  test("recognizes large episode numbers that could be mistaken for years", () => {
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

    describe("Edge-case filenames", () => {
      test("Amagi.Brilliant.Park.S01E01.1080p.BluRay.10-Bit.Dual-Audio.FLAC2.0.x265-YURASUKA.mkv", () => {
        const result = parse(
          "Amagi.Brilliant.Park.S01E01.1080p.BluRay.10-Bit.Dual-Audio.FLAC2.0.x265-YURASUKA.mkv",
        );
        expect(result.title).toBe("Amagi Brilliant Park");
        expect(result.season).toBe(1);
        expect(result.episode).toBe(1);
        expect(result.tags.group).toBe("YURASUKA");
        expect(result.tags.resolution).toBe("1080p");
        expect(result.tags.codec).toBe("x265");
      });

      test("Chuukan.Kanriroku.Tonegawa.01.[720-x265].takanime.pw.mkv", () => {
        const result = parse("Chuukan.Kanriroku.Tonegawa.01.[720-x265].takanime.pw.mkv");
        expect(result.title).toBe("Chuukan Kanriroku Tonegawa");
        expect(result.episode).toBe(1);
        expect(result.tags.group).toBe("takanime.pw");
        expect(result.tags.resolution).toBe("720p");
        expect(result.tags.codec).toBe("x265");
      });

      test("Chuukan.Kanriroku.Tonegawa.24.[720-x265].takanime.biz.mkv", () => {
        const result = parse("Chuukan.Kanriroku.Tonegawa.24.[720-x265].takanime.biz.mkv");
        expect(result.title).toBe("Chuukan Kanriroku Tonegawa");
        expect(result.episode).toBe(24);
        expect(result.tags.group).toBe("takanime.biz");
        expect(result.tags.resolution).toBe("720p");
        expect(result.tags.codec).toBe("x265");
      });

      test("Ookami_to_Koushinryou_Merchant_Meets_the_Wise_Wolf_01_1080pMini.mkv", () => {
        const result = parse("Ookami_to_Koushinryou_Merchant_Meets_the_Wise_Wolf_01_1080pMini.mkv");
        expect(result.title).toBe("Ookami to Koushinryou Merchant Meets the Wise Wolf");
        expect(result.episode).toBe(1);
        expect(result.tags.resolution).toBe("1080p");
      });

      test("Akagami no Shirayuki-hime - OVA [BD 720p Hi10 x264 AAC] [0B7F926B].mkv", () => {
        const result = parse(
          "Akagami no Shirayuki-hime - OVA [BD 720p Hi10 x264 AAC] [0B7F926B].mkv",
        );
        expect(result.title).toBe("Akagami no Shirayuki-hime - OVA");
        expect(result.episode).toBeNull();
        expect(result.tags.resolution).toBe("720p");
        expect(result.tags.codec).toBe("x264");
      });

      test("BS.Team - Tonari no Kaibutsu-kun (Tonari no Gokudou-kun) OVA.mp4", () => {
        const result = parse("BS.Team - Tonari no Kaibutsu-kun (Tonari no Gokudou-kun) OVA.mp4");
        expect(result.title).toBe("Tonari no Kaibutsu-kun (Tonari no Gokudou-kun) OVA");
        expect(result.tags.group).toBe("BS.Team");
        expect(result.episode).toBeNull();
      });

      test("Kimagure Orange Road - NCED1 (BDRip 720x480p x265 HEVC AC3 2.0)[sxales].mkv", () => {
        const result = parse(
          "Kimagure Orange Road - NCED1 (BDRip 720x480p x265 HEVC AC3 2.0)[sxales].mkv",
        );
        expect(result.title).toBe("Kimagure Orange Road - NCED1");
        expect(result.tags.group).toBe("sxales");
        expect(result.episode).toBeNull();
      });

      test("Kimagure Orange Road - OVA 01 Notice (BDRip 720x480p x265 HEVC AC3 2.0)[sxales].mkv", () => {
        const result = parse(
          "Kimagure Orange Road - OVA 01 Notice (BDRip 720x480p x265 HEVC AC3 2.0)[sxales].mkv",
        );
        expect(result.title).toBe("Kimagure Orange Road - OVA 01 Notice");
        expect(result.tags.group).toBe("sxales");
        expect(result.episode).toBeNull();
      });

      test("TONIKAWA_ Over The Moon For You - SNS [1080p][Mini].mkv", () => {
        const result = parse("TONIKAWA_ Over The Moon For You - SNS [1080p][Mini].mkv");
        expect(result.title).toBe("TONIKAWA Over The Moon For You - SNS");
        expect(result.episode).toBeNull();
        expect(result.tags.resolution).toBe("1080p");
      });

      test("Yowamushi Pedal OVA - Special Ride   [DarkDream].mkv", () => {
        const result = parse("Yowamushi Pedal OVA - Special Ride   [DarkDream].mkv");
        expect(result.title).toBe("Yowamushi Pedal OVA - Special Ride");
        expect(result.tags.group).toBe("DarkDream");
        expect(result.episode).toBeNull();
      });

      test("Mirai.ai] Eizouken ni wa Te wo Dasu na! - 07 [720p][Mini].mkv].mkv", () => {
        const result = parse("Mirai.ai] Eizouken ni wa Te wo Dasu na! - 07 [720p][Mini].mkv].mkv");
        expect(result.title).toBe("Eizouken ni wa Te wo Dasu na!");
        expect(result.episode).toBe(7);
        expect(result.tags.group).toBe("Mirai.ai");
        expect(result.tags.resolution).toBe("720p");
      });

      test("Mirai.ai] Eizouken ni wa Te wo Dasu na! - 09 [720p][Mini].mkv.mkv].mkv", () => {
        const result = parse(
          "Mirai.ai] Eizouken ni wa Te wo Dasu na! - 09 [720p][Mini].mkv.mkv].mkv",
        );
        expect(result.title).toBe("Eizouken ni wa Te wo Dasu na!");
        expect(result.episode).toBe(9);
        expect(result.tags.group).toBe("Mirai.ai");
        expect(result.tags.resolution).toBe("720p");
      });

      test("100.Meters.2025.1080p.NF.WEB-DL.DUAL.DDP5.1.H.264-VARYG.mkv", () => {
        const result = parse("100.Meters.2025.1080p.NF.WEB-DL.DUAL.DDP5.1.H.264-VARYG.mkv");
        expect(result.title).toBe("100 Meters");
        expect(result.tags.group).toBe("VARYG");
        expect(result.tags.resolution).toBe("1080p");
      });

      test("Kimagure Orange Road Ano Hi ni Kaeritai (1988) (BDRip 1920x1036p x265 HEVC FLAC 2.0)[sxales].mkv", () => {
        const result = parse(
          "Kimagure Orange Road Ano Hi ni Kaeritai (1988) (BDRip 1920x1036p x265 HEVC FLAC 2.0)[sxales].mkv",
        );
        expect(result.title).toBe("Kimagure Orange Road Ano Hi ni Kaeritai (1988)");
        expect(result.tags.group).toBe("sxales");
        expect(result.episode).toBeNull();
      });

      test("Kimagure Orange Road OVA - 01 Shiroi Koibito-tachi (1989) (BDRip 1440x1080p x265 HEVC FLAC 2.0)[sxales].mkv", () => {
        const result = parse(
          "Kimagure Orange Road OVA - 01 Shiroi Koibito-tachi (1989) (BDRip 1440x1080p x265 HEVC FLAC 2.0)[sxales].mkv",
        );
        expect(result.title).toBe("Kimagure Orange Road OVA");
        expect(result.episode).toBe(1);
        expect(result.tags.group).toBe("sxales");
      });

      test("Shangri-La.Frontier.S02E01.MULTi.1080p.WEBRiP.x265-T3KASHi.mkv", () => {
        const result = parse("Shangri-La.Frontier.S02E01.MULTi.1080p.WEBRiP.x265-T3KASHi.mkv");
        expect(result.title).toBe("Shangri-La Frontier");
        expect(result.season).toBe(2);
        expect(result.episode).toBe(1);
        expect(result.tags.group).toBe("T3KASHi");
        expect(result.tags.resolution).toBe("1080p");
        expect(result.tags.codec).toBe("x265");
      });

      test("Yowamushi Pedal SPARE BIKE.mkv", () => {
        const result = parse("Yowamushi Pedal SPARE BIKE.mkv");
        expect(result.title).toBe("Yowamushi Pedal SPARE BIKE");
        expect(result.episode).toBeNull();
      });
    });
  });
});
