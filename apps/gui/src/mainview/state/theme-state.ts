import type { ThemeMode } from "../../shared/types";
import type { RPCClient } from "../shared";

interface ThemeState {
  mode: ThemeMode;
  dataTheme: string;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
  onChange: (listener: (mode: ThemeMode) => void) => () => void;
}

interface CreateThemeStateOptions {
  initialMode?: ThemeMode;
}

export function createThemeState(options: CreateThemeStateOptions = {}): ThemeState {
  const { initialMode = "dark" } = options;

  let mode: ThemeMode = initialMode;
  const listeners = new Set<(mode: ThemeMode) => void>();

  function notify() {
    for (const listener of listeners) {
      listener(mode);
    }
  }

  function toggle() {
    mode = mode === "light" ? "dark" : "light";
    notify();
  }

  function setMode(newMode: ThemeMode) {
    if (mode !== newMode) {
      mode = newMode;
      notify();
    }
  }

  function onChange(listener: (mode: ThemeMode) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    get mode() {
      return mode;
    },
    get dataTheme() {
      return "cerberus";
    },
    toggle,
    setMode,
    onChange,
  };
}

export function applyThemeToDocument(state: ThemeState): () => void {
  document.documentElement.setAttribute("data-theme", state.dataTheme);
  document.documentElement.classList.toggle("dark", state.mode === "dark");

  return state.onChange((_mode) => {
    document.documentElement.setAttribute("data-theme", state.dataTheme);
    document.documentElement.classList.toggle("dark", state.mode === "dark");
  });
}

export interface RPCThemeState extends ThemeState {
  load: () => Promise<void>;
}

export function createRPCThemeState(
  rpc: RPCClient,
  options: CreateThemeStateOptions = {},
): RPCThemeState {
  const state = createThemeState(options) as RPCThemeState;

  state.load = async () => {
    try {
      const result = (await rpc.request("getThemeMode", {})) as {
        mode: ThemeMode;
      } | null;
      if (result?.mode) {
        state.setMode(result.mode);
      }
    } catch {}
  };

  const originalSetMode = state.setMode;
  state.setMode = (mode: ThemeMode) => {
    originalSetMode(mode);
    rpc.request("setThemeMode", { mode }).catch(() => {});
  };

  const originalToggle = state.toggle;
  state.toggle = () => {
    originalToggle();
    rpc.request("setThemeMode", { mode: state.mode }).catch(() => {});
  };

  return state;
}
