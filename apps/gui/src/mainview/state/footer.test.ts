import { describe, expect, it } from "bun:test";
import { statusKindFor } from "./footer";

describe("statusKindFor", () => {
  it("returns ready for Ready", () => {
    expect(statusKindFor("Ready")).toBe("ready");
  });

  it("returns active for Scanning", () => {
    expect(statusKindFor("Scanning: 3/10 - matched")).toBe("active");
  });

  it("returns complete for Complete", () => {
    expect(statusKindFor("Complete: 8 renamed, 2 failed")).toBe("complete");
  });

  it("returns complete for Complete: cover art", () => {
    expect(statusKindFor("Complete: cover art")).toBe("complete");
  });

  it("returns complete for Complete: metadata", () => {
    expect(statusKindFor("Complete: metadata")).toBe("complete");
  });
});
