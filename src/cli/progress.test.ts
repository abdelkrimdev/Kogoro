import { afterEach, describe, expect, mock, test } from "bun:test";
import { createMockClackPrompts } from "../test-fixtures";

const { mock: clackMock, captures } = createMockClackPrompts();
mock.module("@clack/prompts", () => clackMock);

import { createProgressTracker } from "./progress";

afterEach(() => {
  captures.reset();
});

describe("createProgressTracker", () => {
  test("returns ctx with progress, log, error functions", () => {
    const tracker = createProgressTracker();

    expect(typeof tracker.ctx.progress).toBe("function");
    expect(typeof tracker.ctx.log).toBe("function");
    expect(typeof tracker.ctx.error).toBe("function");
  });

  test("returns start and stop methods", () => {
    const tracker = createProgressTracker();

    expect(typeof tracker.start).toBe("function");
    expect(typeof tracker.stop).toBe("function");
  });
});

describe("verbose mode", () => {
  test("logs go to log.info", () => {
    const tracker = createProgressTracker({ verbose: true });
    tracker.ctx.log("Processing file.mkv");

    expect(captures.logInfo).toEqual(["Processing file.mkv"]);
  });

  test("errors go to log.error", () => {
    const tracker = createProgressTracker({ verbose: true });
    tracker.ctx.error("Failed to download");

    expect(captures.logError).toEqual(["Failed to download"]);
  });

  test("progress events are ignored", () => {
    const tracker = createProgressTracker({ verbose: true });

    expect(() => {
      tracker.ctx.progress({ completed: 1, total: 5, file: "test.mkv", status: "matched" });
    }).not.toThrow();
  });

  test("start and stop are no-ops", () => {
    const tracker = createProgressTracker({ verbose: true });

    expect(() => {
      tracker.start("Processing...");
      tracker.stop("Done");
    }).not.toThrow();
    expect(captures.spinnerStart).toHaveLength(0);
  });
});

describe("quiet mode", () => {
  test("logs are suppressed", () => {
    const tracker = createProgressTracker({ quiet: true });

    expect(() => tracker.ctx.log("should not appear")).not.toThrow();
    expect(captures.logInfo).toHaveLength(0);
  });

  test("errors are suppressed", () => {
    const tracker = createProgressTracker({ quiet: true });

    expect(() => tracker.ctx.error("should not appear")).not.toThrow();
    expect(captures.logError).toHaveLength(0);
  });

  test("progress events are ignored", () => {
    const tracker = createProgressTracker({ quiet: true });

    expect(() => {
      tracker.ctx.progress({ completed: 1, total: 5, file: "test.mkv", status: "matched" });
    }).not.toThrow();
  });

  test("start and stop are no-ops", () => {
    const tracker = createProgressTracker({ quiet: true });

    expect(() => {
      tracker.start("Processing...");
      tracker.stop("Done");
    }).not.toThrow();
    expect(captures.spinnerStart).toHaveLength(0);
  });
});

describe("normal mode", () => {
  test("shows file and counter in spinner", () => {
    const tracker = createProgressTracker();
    tracker.ctx.progress({ completed: 3, total: 10, file: "episode.mkv", status: "matched" });

    expect(captures.spinnerMessage).toEqual(["episode.mkv (3/10)..."]);
  });

  test("logs are suppressed", () => {
    const tracker = createProgressTracker();

    expect(() => tracker.ctx.log("should not appear")).not.toThrow();
    expect(captures.logInfo).toHaveLength(0);
  });

  test("start starts the spinner", () => {
    const tracker = createProgressTracker();
    tracker.start("Processing files...");

    expect(captures.spinnerStart).toEqual(["Processing files..."]);
  });

  test("stop stops the spinner with message", () => {
    const tracker = createProgressTracker();
    tracker.stop("Processed 10 files");

    expect(captures.spinnerStop).toEqual(["Processed 10 files"]);
  });

  test("stop uses default message when none provided", () => {
    const tracker = createProgressTracker();
    tracker.stop();

    expect(captures.spinnerStop).toEqual(["Done"]);
  });
});
