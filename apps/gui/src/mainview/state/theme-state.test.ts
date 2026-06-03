import { describe, expect, it } from "bun:test";
import type { ThemeMode } from "../../shared/types";
import { applyThemeToDocument, createRPCThemeState, createThemeState } from "./theme-state";

describe("createThemeState", () => {
  it("defaults to light mode", () => {
    const state = createThemeState();
    expect(state.mode).toBe("light");
  });

  it("accepts an initial mode", () => {
    const state = createThemeState({ initialMode: "dark" });
    expect(state.mode).toBe("dark");
  });

  it("toggles from light to dark", () => {
    const state = createThemeState({ initialMode: "light" });
    state.toggle();
    expect(state.mode).toBe("dark");
  });

  it("toggles from dark to light", () => {
    const state = createThemeState({ initialMode: "dark" });
    state.toggle();
    expect(state.mode).toBe("light");
  });

  it("sets mode explicitly", () => {
    const state = createThemeState({ initialMode: "light" });
    state.setMode("dark");
    expect(state.mode).toBe("dark");
  });

  it("does not change when setting same mode", () => {
    const state = createThemeState({ initialMode: "light" });
    state.setMode("light");
    expect(state.mode).toBe("light");
  });

  it("returns cerberus as data-theme for light mode", () => {
    const state = createThemeState({ initialMode: "light" });
    expect(state.dataTheme).toBe("cerberus");
  });

  it("returns cerberus as data-theme for dark mode", () => {
    const state = createThemeState({ initialMode: "dark" });
    expect(state.dataTheme).toBe("cerberus");
  });

  it("notifies listeners when mode changes", () => {
    const state = createThemeState({ initialMode: "light" });
    const changes: ThemeMode[] = [];
    state.onChange((mode) => changes.push(mode));
    state.toggle();
    expect(changes).toEqual(["dark"]);
  });

  it("does not notify listeners when mode stays the same", () => {
    const state = createThemeState({ initialMode: "light" });
    const changes: ThemeMode[] = [];
    state.onChange((mode) => changes.push(mode));
    state.setMode("light");
    expect(changes).toEqual([]);
  });

  it("supports multiple listeners", () => {
    const state = createThemeState({ initialMode: "light" });
    const changes1: ThemeMode[] = [];
    const changes2: ThemeMode[] = [];
    state.onChange((mode) => changes1.push(mode));
    state.onChange((mode) => changes2.push(mode));
    state.toggle();
    expect(changes1).toEqual(["dark"]);
    expect(changes2).toEqual(["dark"]);
  });

  it("allows unsubscribing a listener", () => {
    const state = createThemeState({ initialMode: "light" });
    const changes: ThemeMode[] = [];
    const unsubscribe = state.onChange((mode) => changes.push(mode));
    state.toggle();
    unsubscribe();
    state.toggle();
    expect(changes).toEqual(["dark"]);
  });
});

describe("applyThemeToDocument", () => {
  it("sets data-theme and dark class on document element", () => {
    let capturedAttribute: string | undefined;
    let capturedValue: string | undefined;
    let darkToggled: boolean | undefined;

    globalThis.document = {
      documentElement: {
        setAttribute: (attr: string, value: string) => {
          capturedAttribute = attr;
          capturedValue = value;
        },
        classList: {
          toggle: (_cls: string, force: boolean) => {
            darkToggled = force;
          },
        },
      },
    } as unknown as Document;

    const state = createThemeState();
    applyThemeToDocument(state);

    expect(capturedAttribute).toBe("data-theme");
    expect(capturedValue).toBe("cerberus");
    expect(darkToggled).toBe(false);
  });

  it("toggles dark class when mode changes", () => {
    const darkValues: boolean[] = [];

    globalThis.document = {
      documentElement: {
        setAttribute: () => {},
        classList: {
          toggle: (_cls: string, force: boolean) => {
            darkValues.push(force);
          },
        },
      },
    } as unknown as Document;

    const state = createThemeState();
    applyThemeToDocument(state);
    state.toggle();

    expect(darkValues).toContain(true);
  });

  it("cleans up listener when cleanup function is called", () => {
    const darkValues: boolean[] = [];

    globalThis.document = {
      documentElement: {
        setAttribute: () => {},
        classList: {
          toggle: (_cls: string, force: boolean) => {
            darkValues.push(force);
          },
        },
      },
    } as unknown as Document;

    const state = createThemeState();
    const cleanup = applyThemeToDocument(state);

    state.toggle();
    cleanup();
    state.toggle();

    expect(darkValues).toEqual([false, true]);
  });
});

describe("createRPCThemeState", () => {
  function createMockRPC(responses: Record<string, unknown> = {}) {
    const calls: Array<{ method: string; params: unknown }> = [];
    return {
      calls,
      request: async (method: string, params: unknown) => {
        calls.push({ method, params });
        return responses[method] ?? null;
      },
    };
  }

  it("defaults to light mode", () => {
    const { request } = createMockRPC();
    const state = createRPCThemeState({ request });
    expect(state.mode).toBe("light");
  });

  it("accepts an initial mode", () => {
    const { request } = createMockRPC();
    const state = createRPCThemeState({ request }, { initialMode: "dark" });
    expect(state.mode).toBe("dark");
  });

  it("load fetches mode from RPC", async () => {
    const { request } = createMockRPC({ getThemeMode: { mode: "dark" } });
    const state = createRPCThemeState({ request });

    await state.load();

    expect(state.mode).toBe("dark");
  });

  it("load keeps default when RPC returns null", async () => {
    const { request } = createMockRPC({ getThemeMode: null });
    const state = createRPCThemeState({ request });

    await state.load();

    expect(state.mode).toBe("light");
  });

  it("load keeps default on RPC error", async () => {
    const request = async () => {
      throw new Error("fail");
    };
    const state = createRPCThemeState({ request });

    await state.load();

    expect(state.mode).toBe("light");
  });

  it("setMode persists via RPC", async () => {
    const { request, calls } = createMockRPC();
    const state = createRPCThemeState({ request });

    state.setMode("dark");

    expect(state.mode).toBe("dark");
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([{ method: "setThemeMode", params: { mode: "dark" } }]);
  });

  it("toggle persists via RPC", async () => {
    const { request, calls } = createMockRPC();
    const state = createRPCThemeState({ request });

    state.toggle();

    expect(state.mode).toBe("dark");
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual([{ method: "setThemeMode", params: { mode: "dark" } }]);
  });

  it("notifies listeners on change", () => {
    const { request } = createMockRPC();
    const state = createRPCThemeState({ request });
    const changes: ThemeMode[] = [];
    state.onChange((mode) => changes.push(mode));

    state.toggle();

    expect(changes).toEqual(["dark"]);
  });
});
