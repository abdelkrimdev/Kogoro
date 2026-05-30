import { describe, expect, test } from "bun:test";
import { createLogger } from "./logger";

describe("createLogger", () => {
  test("writes [kogoro] prefix for info messages", () => {
    const lines: string[] = [];
    const logger = createLogger("info", (msg) => lines.push(msg));
    logger.info("Matched 12 files");
    expect(lines).toEqual(["[kogoro] Matched 12 files"]);
  });

  test("writes [kogoro] prefix for error messages", () => {
    const lines: string[] = [];
    const logger = createLogger("info", (msg) => lines.push(msg));
    logger.error("Failed to connect");
    expect(lines).toEqual(["[kogoro] Failed to connect"]);
  });

  test("writes [kogoro:debug] prefix for debug messages", () => {
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
