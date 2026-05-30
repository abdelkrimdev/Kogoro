import { describe, expect, test } from "bun:test";
import { createLogger, resolveLogLevel } from "./logger";

describe("resolveLogLevel", () => {
  test("returns debug when verbose is true", () => {
    expect(resolveLogLevel({ verbose: true })).toBe("debug");
  });

  test("returns error when quiet is true", () => {
    expect(resolveLogLevel({ quiet: true })).toBe("error");
  });

  test("returns info when neither verbose nor quiet is set", () => {
    expect(resolveLogLevel({})).toBe("info");
  });

  test("verbose takes precedence over quiet", () => {
    expect(resolveLogLevel({ verbose: true, quiet: true })).toBe("debug");
  });
});

describe("createLogger", () => {
  test("prefixes info messages", () => {
    const lines: string[] = [];
    const logger = createLogger("info", (msg) => lines.push(msg));
    logger.info("Matched 12 files");
    expect(lines).toEqual(["[kogoro] Matched 12 files"]);
  });

  test("prefixes error messages", () => {
    const lines: string[] = [];
    const logger = createLogger("info", (msg) => lines.push(msg));
    logger.error("Failed to connect");
    expect(lines).toEqual(["[kogoro] Failed to connect"]);
  });

  test("prefixes debug messages", () => {
    const lines: string[] = [];
    const logger = createLogger("debug", (msg) => lines.push(msg));
    logger.debug("HTTP GET /api/search");
    expect(lines).toEqual(["[kogoro:debug] HTTP GET /api/search"]);
  });

  test("suppresses info when level is error", () => {
    const lines: string[] = [];
    const logger = createLogger("error", (msg) => lines.push(msg));
    logger.info("Matched 12 files");
    expect(lines).toEqual([]);
  });

  test("emits errors even at quiet level", () => {
    const lines: string[] = [];
    const logger = createLogger("error", (msg) => lines.push(msg));
    logger.error("Failed");
    expect(lines).toEqual(["[kogoro] Failed"]);
  });

  test("suppresses debug when level is info", () => {
    const lines: string[] = [];
    const logger = createLogger("info", (msg) => lines.push(msg));
    logger.debug("trace data");
    expect(lines).toEqual([]);
  });
});
