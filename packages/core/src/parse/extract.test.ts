import { describe, expect, test } from "bun:test";
import { extract } from "./extract";

describe("extract", () => {
  describe("bracket tags", () => {
    test("extracts leading group from brackets", () => {
      const result = extract("[SubsPlease] Jujutsu Kaisen - 01 (1080p)");
      expect(result.tags.group).toBe("SubsPlease");
    });

    test("extracts resolution from brackets", () => {
      const result = extract("[Group] Title - 01 [1080p]");
      expect(result.tags.resolution).toBe("1080p");
    });

    test("extracts codec from brackets", () => {
      const result = extract("[Group] Title - 01 [HEVC]");
      expect(result.tags.codec).toBe("hevc");
    });

    test("extracts audio from brackets", () => {
      const result = extract("[Group] Title - 01 [AAC]");
      expect(result.tags.audio).toBe("aac");
    });

    test("extracts source from brackets", () => {
      const result = extract("[Group] Title - 01 [BD]");
      expect(result.tags.source).toBe("bd");
    });

    test("extracts multiple tags from separate brackets", () => {
      const result = extract("[Group] Title - 01 [1080p][HEVC][AAC]");
      expect(result.tags.resolution).toBe("1080p");
      expect(result.tags.codec).toBe("hevc");
      expect(result.tags.audio).toBe("aac");
    });

    test("extracts trailing group when no leading group", () => {
      const result = extract("Title - 01 [1080p][GroupTag]");
      expect(result.tags.group).toBe("GroupTag");
    });

    test("does not treat CRC as trailing group", () => {
      const result = extract("[Group] Title - 01 [592C6CD9]");
      expect(result.tags.group).toBe("Group");
    });

    test("does not treat tag-only bracket as group", () => {
      const result = extract("[Group] Title - 01 [1080p]");
      expect(result.tags.group).toBe("Group");
    });
  });

  describe("token tags", () => {
    test("extracts resolution from bare tokens", () => {
      const result = extract("[Group] Title - 01 1080p");
      expect(result.tags.resolution).toBe("1080p");
    });

    test("extracts codec from bare tokens", () => {
      const result = extract("[Group] Title - 01 x265");
      expect(result.tags.codec).toBe("x265");
    });

    test("extracts source from bare tokens", () => {
      const result = extract("[Group] Title - 01 WEB-DL");
      expect(result.tags.source).toBe("web-dl");
    });

    test("extracts audio from bare tokens", () => {
      const result = extract("[Group] Title - 01 FLAC");
      expect(result.tags.audio).toBe("flac");
    });
  });

  describe("cleanMetaTokens", () => {
    test("removes bracket-only tag groups from cleanName", () => {
      const result = extract("[Group] Title - 01 [1080p][HEVC]");
      expect(result.cleanName).toBe("Title - 01");
    });

    test("preserves year in brackets", () => {
      const result = extract("[Group] Title [2024] - 01");
      expect(result.cleanName).toContain("[2024]");
    });

    test("removes paren-only tag groups", () => {
      const result = extract("[Group] Title - 01 (1080p HEVC)");
      expect(result.cleanName).toBe("Title - 01");
    });

    test("preserves year in parentheses", () => {
      const result = extract("[Group] Title (2024) - 01");
      expect(result.cleanName).toContain("(2024)");
    });

    test("preserves meaningful paren content", () => {
      const result = extract("[Group] Title (Special Edition) - 01");
      expect(result.cleanName).toContain("(Special Edition)");
    });
  });

  describe("trailing group extraction", () => {
    test("does not override existing leading group with trailing", () => {
      const result = extract("[Group] Title - 01 -SceneName-");
      expect(result.tags.group).toBe("Group");
    });

    test("extracts dot-domain trailing group when no leading group", () => {
      const result = extract("Title - 01 takanime.pw");
      expect(result.tags.group).toBe("takanime.pw");
    });

    test("does not extract trailing tags as group", () => {
      const result = extract("[Group] Title - 01 END");
      expect(result.tags.group).toBe("Group");
    });
  });

  describe("cleanTrailingTokens", () => {
    test("removes trailing tag tokens from cleanName", () => {
      const result = extract("[Group] Title - 01 END");
      expect(result.cleanName).toBe("Title - 01");
    });

    test("removes trailing year", () => {
      const result = extract("[Group] Title - 01 2024");
      expect(result.cleanName).toBe("Title - 01");
    });

    test("removes trailing dash after cleanup", () => {
      const result = extract("[Group] Title - 01 -");
      expect(result.cleanName).toBe("Title - 01");
    });

    test("preserves non-tag trailing tokens", () => {
      const result = extract("[Group] Title - 01 OVA");
      expect(result.cleanName).toBe("Title - 01 OVA");
    });
  });
});
