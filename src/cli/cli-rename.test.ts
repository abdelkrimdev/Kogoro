import { describe, expect, test } from "bun:test";
import { createRenameHandlers } from "../cli/rename-commands";

describe("rename CLI commands", () => {
  test("rename command returns plan as JSON", async () => {
    const handlers = createRenameHandlers();
    let output = "";
    const onLog = (msg: string) => {
      output = msg;
    };

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
      onLog,
      () => {},
    );

    const plan = JSON.parse(output);
    expect(plan.sourcePath).toBe("/source/Episode.mkv");
    expect(plan.targetPath).toBe("Jujutsu Kaisen/TV/Jujutsu Kaisen - 1x13 - Tomorrow.mkv");
    expect(plan.action).toBe("move");
  });

  test("rename command handles movie entry type", async () => {
    const handlers = createRenameHandlers();
    let output = "";
    const onLog = (msg: string) => {
      output = msg;
    };

    await handlers.rename(
      "/source/Movie.mkv",
      {
        anime: "Your Name",
        entryType: "movie",
        title: "Your Name",
        action: "copy",
      },
      onLog,
      () => {},
    );

    const plan = JSON.parse(output);
    expect(plan.targetDir).toBe("Your Name/Movies");
    expect(plan.action).toBe("copy");
  });

  test("rename command falls back to TV for unknown entry type", async () => {
    const handlers = createRenameHandlers();
    let output = "";
    const onLog = (msg: string) => {
      output = msg;
    };

    await handlers.rename(
      "/source/Episode.mkv",
      {
        anime: "Test",
        entryType: "unknown",
        action: "move",
      },
      onLog,
      () => {},
    );

    const plan = JSON.parse(output);
    expect(plan.targetDir).toBe("Test/TV");
  });

  test("rename command with custom templates", async () => {
    const handlers = createRenameHandlers({
      filenameTemplate: "{anime} - {episode:03}.{ext}",
      directoryTemplate: "Anime/{type}",
    });
    let output = "";
    const onLog = (msg: string) => {
      output = msg;
    };

    await handlers.rename(
      "/source/Ep.mkv",
      {
        anime: "Naruto",
        entryType: "tv",
        episode: 1,
        action: "symlink",
      },
      onLog,
      () => {},
    );

    const plan = JSON.parse(output);
    expect(plan.targetDir).toBe("Anime/TV");
    expect(plan.targetFilename).toBe("Naruto - 001.mkv");
    expect(plan.action).toBe("symlink");
  });
});
