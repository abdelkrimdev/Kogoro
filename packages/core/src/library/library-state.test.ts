import { describe, expect, test } from "bun:test";
import { computeLibraryState } from "./library-state";

describe("computeLibraryState", () => {
  test("returns not_on_disk for empty groups", () => {
    expect(computeLibraryState([])).toBe("not_on_disk");
  });

  test("returns on_disk when all groups have files", () => {
    expect(
      computeLibraryState([
        { groupId: 1, filesOnDisk: 12 },
        { groupId: 2, filesOnDisk: 24 },
      ]),
    ).toBe("on_disk");
  });

  test("returns not_on_disk when no group has files", () => {
    expect(
      computeLibraryState([
        { groupId: 1, filesOnDisk: 0 },
        { groupId: 2, filesOnDisk: 0 },
      ]),
    ).toBe("not_on_disk");
  });

  test("returns partially_on_disk when some groups have files", () => {
    expect(
      computeLibraryState([
        { groupId: 1, filesOnDisk: 12 },
        { groupId: 2, filesOnDisk: 0 },
      ]),
    ).toBe("partially_on_disk");
  });

  test("returns on_disk for single group with files", () => {
    expect(computeLibraryState([{ groupId: 1, filesOnDisk: 5 }])).toBe("on_disk");
  });

  test("returns not_on_disk for single group with zero files", () => {
    expect(computeLibraryState([{ groupId: 1, filesOnDisk: 0 }])).toBe("not_on_disk");
  });
});
