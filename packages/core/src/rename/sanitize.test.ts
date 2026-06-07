import { describe, expect, test } from "bun:test";
import { sanitizeFilename } from "./sanitize";

describe("sanitizeFilename", () => {
  test("replaces illegal characters with underscore by default", () => {
    const result = sanitizeFilename('Zom 100: Bucket List of the "Dead"', {
      action: "replace",
      replacement: "_",
      chars: '\\/:*?"<>|',
    });
    expect(result).toBe("Zom 100_ Bucket List of the _Dead_");
  });

  test("strips illegal characters when action is strip", () => {
    const result = sanitizeFilename('Zom 100: Bucket List of the "Dead"', {
      action: "strip",
      replacement: "_",
      chars: '\\/:*?"<>|',
    });
    expect(result).toBe("Zom 100 Bucket List of the Dead");
  });

  test("strips trailing dots", () => {
    const result = sanitizeFilename("file name...", {
      action: "strip",
      replacement: "_",
      chars: '\\/:*?"<>|',
    });
    expect(result).toBe("file name");
  });

  test("strips trailing spaces", () => {
    const result = sanitizeFilename("file name   ", {
      action: "strip",
      replacement: "_",
      chars: '\\/:*?"<>|',
    });
    expect(result).toBe("file name");
  });

  test("returns empty string for empty input", () => {
    const result = sanitizeFilename("", {
      action: "replace",
      replacement: "_",
      chars: '\\/:*?"<>|',
    });
    expect(result).toBe("");
  });

  test("returns unchanged string when no illegal chars present", () => {
    const result = sanitizeFilename("Normal Title", {
      action: "replace",
      replacement: "_",
      chars: '\\/:*?"<>|',
    });
    expect(result).toBe("Normal Title");
  });

  test("uses custom replacement character", () => {
    const result = sanitizeFilename("Title: Part 1", {
      action: "replace",
      replacement: "-",
      chars: '\\/:*?"<>|',
    });
    expect(result).toBe("Title- Part 1");
  });

  test("handles custom char set", () => {
    const result = sanitizeFilename("Title (v2)", {
      action: "strip",
      replacement: "_",
      chars: "()",
    });
    expect(result).toBe("Title v2");
  });
});
