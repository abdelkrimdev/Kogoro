import { LayoutGrid, Search, Settings } from "@lucide/svelte";
import type { RPCClient } from "../shared";

export type View = "onboarding" | "scan" | "library" | "details" | "settings" | "review";

interface NavItem {
  view: View;
  label: string;
  icon: typeof Search;
}

export const NAV_ITEMS: NavItem[] = [
  { view: "scan", label: "Scan", icon: Search },
  { view: "library", label: "Library", icon: LayoutGrid },
  { view: "settings", label: "Settings", icon: Settings },
];

export interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  load: () => Promise<void>;
}

export function createSidebarState(getRpc: () => RPCClient): SidebarState {
  let _collapsed = false;

  return {
    get collapsed() {
      return _collapsed;
    },
    toggle() {
      _collapsed = !_collapsed;
      getRpc()
        .request("setSidebarCollapsed", { collapsed: _collapsed })
        .catch(() => {});
    },
    async load() {
      try {
        const result = (await getRpc().request("getSidebarCollapsed", {})) as {
          collapsed: boolean;
        } | null;
        if (result?.collapsed !== undefined) {
          _collapsed = result.collapsed;
        }
      } catch {}
    },
  };
}
