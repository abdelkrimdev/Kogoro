import { describe, expect, it } from "bun:test";
import { NAV_ITEMS } from "./nav";

describe("NAV_ITEMS", () => {
  it("contains three navigation entries", () => {
    expect(NAV_ITEMS).toHaveLength(3);
  });

  it("maps scan view to Scan label", () => {
    expect(NAV_ITEMS[0]?.view).toBe("scan");
    expect(NAV_ITEMS[0]?.label).toBe("Scan");
  });

  it("maps library view to Library label", () => {
    expect(NAV_ITEMS[1]?.view).toBe("library");
    expect(NAV_ITEMS[1]?.label).toBe("Library");
  });

  it("maps settings view to Settings label", () => {
    expect(NAV_ITEMS[2]?.view).toBe("settings");
    expect(NAV_ITEMS[2]?.label).toBe("Settings");
  });

  it("each item has a non-null icon component", () => {
    for (const item of NAV_ITEMS) {
      expect(item.icon).toBeDefined();
    }
  });
});
