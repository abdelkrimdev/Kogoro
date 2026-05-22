import { describe, expect, test } from "bun:test";
import { createLogCapture } from "../../test-fixtures";
import { createRenameHandlers } from "./handlers";

describe("rename CLI commands", () => {
  test("rename command returns plan as JSON", async () => {
    const handlers = createRenameHandlers();
    const log = createLogCapture();

    await handlers.rename(
      "/source/Episode.mkv",
      {
        anime: "Jujutsu Kaisen",
        entryType: "tv",
        season: 1,
        episode: 13,
        title: "Tomorrow",
        action: "move",
      },
      log.onLog,
      () => {},
    );

    const plan = JSON.parse(log.output);
    expect(plan.sourcePath).toBe("/source/Episode.mkv");
    expect(plan.targetPath).toBe("Jujutsu Kaisen/TV/Jujutsu Kaisen - 1x13 - Tomorrow.mkv");
    expect(plan.action).toBe("move");
  });

  test("rename command handles movie entry type", async () => {
    const handlers = createRenameHandlers();
    const log = createLogCapture();

    await handlers.rename(
      "/source/Movie.mkv",
      {
        anime: "Your Name",
        entryType: "movie",
        title: "Your Name",
        action: "copy",
      },
      log.onLog,
      () => {},
    );

    const plan = JSON.parse(log.output);
    expect(plan.targetDir).toBe("Your Name/Movies");
    expect(plan.action).toBe("copy");
  });

  test("rename command falls back to TV for unknown entry type", async () => {
    const handlers = createRenameHandlers();
    const log = createLogCapture();

    await handlers.rename(
      "/source/Episode.mkv",
      {
        anime: "Test",
        entryType: "unknown",
        action: "move",
      },
      log.onLog,
      () => {},
    );

    const plan = JSON.parse(log.output);
    expect(plan.targetDir).toBe("Test/TV");
  });

  test("rename command with custom templates", async () => {
    const handlers = createRenameHandlers({
      filenameTemplate: "{anime} - {episode:03}.{ext}",
      directoryTemplate: "Anime/{type}",
    });
    const log = createLogCapture();

    await handlers.rename(
      "/source/Ep.mkv",
      {
        anime: "Naruto",
        entryType: "tv",
        episode: 1,
        action: "symlink",
      },
      log.onLog,
      () => {},
    );

    const plan = JSON.parse(log.output);
    expect(plan.targetDir).toBe("Anime/TV");
    expect(plan.targetFilename).toBe("Naruto - 001.mkv");
    expect(plan.action).toBe("symlink");
  });
});
