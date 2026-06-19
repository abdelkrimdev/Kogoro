import { describe, expect, it } from "bun:test";
import { createMockRPC } from "../../fixtures";
import { createSidebarState, NAV_ITEMS } from "./nav";

describe("NAV_ITEMS", () => {
  it("contains four navigation entries", () => {
    expect(NAV_ITEMS).toHaveLength(4);
  });

  it("maps dashboard view to Dashboard label", () => {
    expect(NAV_ITEMS[0]?.view).toBe("dashboard");
    expect(NAV_ITEMS[0]?.label).toBe("Dashboard");
  });

  it("maps library view to Library label", () => {
    expect(NAV_ITEMS[1]?.view).toBe("library");
    expect(NAV_ITEMS[1]?.label).toBe("Library");
  });

  it("maps scan view to Scan label", () => {
    expect(NAV_ITEMS[2]?.view).toBe("scan");
    expect(NAV_ITEMS[2]?.label).toBe("Scan");
  });

  it("maps settings view to Settings label", () => {
    expect(NAV_ITEMS[3]?.view).toBe("settings");
    expect(NAV_ITEMS[3]?.label).toBe("Settings");
  });

  it("each item has a non-null icon component", () => {
    for (const item of NAV_ITEMS) {
      expect(item.icon).toBeDefined();
    }
  });
});

describe("createSidebarState", () => {
  it("defaults to not collapsed", () => {
    const { request } = createMockRPC();
    const state = createSidebarState(() => ({ request }));
    expect(state.collapsed).toBe(false);
  });

  it("toggles collapsed state", () => {
    const { request } = createMockRPC();
    const state = createSidebarState(() => ({ request }));
    state.toggle();
    expect(state.collapsed).toBe(true);
  });

  it("toggles back to not collapsed", () => {
    const { request } = createMockRPC();
    const state = createSidebarState(() => ({ request }));
    state.toggle();
    state.toggle();
    expect(state.collapsed).toBe(false);
  });

  it("load fetches collapsed state from RPC", async () => {
    const { request } = createMockRPC({ getSidebarCollapsed: { collapsed: true } });
    const state = createSidebarState(() => ({ request }));

    await state.load();

    expect(state.collapsed).toBe(true);
  });

  it("load keeps default when RPC returns null", async () => {
    const { request } = createMockRPC({ getSidebarCollapsed: null });
    const state = createSidebarState(() => ({ request }));

    await state.load();

    expect(state.collapsed).toBe(false);
  });

  it("load keeps default on RPC error", async () => {
    const request = async () => {
      throw new Error("fail");
    };
    const state = createSidebarState(() => ({ request }));

    await state.load();

    expect(state.collapsed).toBe(false);
  });

  it("toggle persists via RPC", async () => {
    const { request, calls } = createMockRPC();
    const state = createSidebarState(() => ({ request }));

    state.toggle();

    expect(state.collapsed).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([{ method: "setSidebarCollapsed", params: { collapsed: true } }]);
  });
});
