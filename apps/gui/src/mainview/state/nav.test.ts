import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadSidebarCollapsed, NAV_ITEMS, saveSidebarCollapsed } from "./nav";

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

const KEY = "kogoro-sidebar-collapsed";

class InMemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

let mockStorage: InMemoryStorage;
const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  mockStorage = new InMemoryStorage();
  globalThis.localStorage = mockStorage as unknown as Storage;
});

afterEach(() => {
  globalThis.localStorage = originalLocalStorage;
});

describe("loadSidebarCollapsed", () => {
  it("returns false when localStorage is empty", () => {
    expect(loadSidebarCollapsed()).toBe(false);
  });

  it("returns true when localStorage has 'true'", () => {
    mockStorage.setItem(KEY, "true");
    expect(loadSidebarCollapsed()).toBe(true);
  });

  it("returns false when localStorage has 'false'", () => {
    mockStorage.setItem(KEY, "false");
    expect(loadSidebarCollapsed()).toBe(false);
  });

  it("returns false when localStorage throws", () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("quota exceeded");
      },
    } as unknown as Storage;
    expect(loadSidebarCollapsed()).toBe(false);
  });
});

describe("saveSidebarCollapsed", () => {
  it("persists true to localStorage", () => {
    saveSidebarCollapsed(true);
    expect(mockStorage.getItem(KEY)).toBe("true");
  });

  it("persists false to localStorage", () => {
    saveSidebarCollapsed(false);
    expect(mockStorage.getItem(KEY)).toBe("false");
  });

  it("does not throw when localStorage throws", () => {
    globalThis.localStorage = {
      setItem: () => {
        throw new Error("quota exceeded");
      },
    } as unknown as Storage;
    expect(() => saveSidebarCollapsed(true)).not.toThrow();
  });
});
