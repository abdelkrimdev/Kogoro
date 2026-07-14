import { describe, expect, test } from "bun:test";
import { isAlreadyAppliedError, makeIdempotent } from "./db-migrations";

describe("makeIdempotent", () => {
  test("wraps CREATE TABLE with IF NOT EXISTS", () => {
    const input = "CREATE TABLE `users` (`id` integer PRIMARY KEY)";
    const result = makeIdempotent(input);
    expect(result).toBe("CREATE TABLE IF NOT EXISTS `users` (`id` integer PRIMARY KEY)");
  });

  test("wraps CREATE UNIQUE INDEX with IF NOT EXISTS", () => {
    const input = "CREATE UNIQUE INDEX `idx_name` ON `users` (`name`)";
    const result = makeIdempotent(input);
    expect(result).toBe("CREATE UNIQUE INDEX IF NOT EXISTS `idx_name` ON `users` (`name`)");
  });

  test("wraps CREATE INDEX with IF NOT EXISTS", () => {
    const input = "CREATE INDEX `idx_email` ON `users` (`email`)";
    const result = makeIdempotent(input);
    expect(result).toBe("CREATE INDEX IF NOT EXISTS `idx_email` ON `users` (`email`)");
  });

  test("handles multiple statements in one string", () => {
    const input = [
      "CREATE TABLE `anime` (`id` integer PRIMARY KEY);",
      "CREATE UNIQUE INDEX `idx_ext` ON `anime` (`external_id`);",
      "CREATE INDEX `idx_title` ON `anime` (`title`);",
    ].join("\n");
    const result = makeIdempotent(input);
    expect(result).toContain("CREATE TABLE IF NOT EXISTS `anime`");
    expect(result).toContain("CREATE UNIQUE INDEX IF NOT EXISTS `idx_ext`");
    expect(result).toContain("CREATE INDEX IF NOT EXISTS `idx_title`");
  });

  test("leaves non-DDL SQL unchanged", () => {
    const input = "ALTER TABLE `anime` ADD `notes` text;";
    expect(makeIdempotent(input)).toBe(input);
  });
});

describe("isAlreadyAppliedError", () => {
  test("returns true for duplicate column name error", () => {
    const err = new Error("duplicate column name: notes");
    expect(isAlreadyAppliedError(err)).toBe(true);
  });

  test("returns true for already exists error", () => {
    const err = new Error("table users already exists");
    expect(isAlreadyAppliedError(err)).toBe(true);
  });

  test("returns true when cause contains duplicate column name", () => {
    const cause = new Error("duplicate column name: title");
    const err = new Error("migration failed");
    err.cause = cause;
    expect(isAlreadyAppliedError(err)).toBe(true);
  });

  test("returns true when cause contains already exists", () => {
    const cause = new Error("index idx_name already exists");
    const err = new Error("migration failed");
    err.cause = cause;
    expect(isAlreadyAppliedError(err)).toBe(true);
  });

  test("returns false for unrelated error", () => {
    const err = new Error("database is locked");
    expect(isAlreadyAppliedError(err)).toBe(false);
  });

  test("returns false for non-Error values", () => {
    expect(isAlreadyAppliedError("string error")).toBe(false);
    expect(isAlreadyAppliedError(null)).toBe(false);
    expect(isAlreadyAppliedError(undefined)).toBe(false);
    expect(isAlreadyAppliedError(42)).toBe(false);
  });
});
