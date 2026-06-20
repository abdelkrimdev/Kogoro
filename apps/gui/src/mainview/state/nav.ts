import { LayoutDashboard, Library, Search, Settings } from "@lucide/svelte";
import type { RPCClient } from "../shared";

export type View =
  | "onboarding"
  | "dashboard"
  | "scan"
  | "library"
  | "details"
  | "settings"
  | "review"
  | "import-preview";

interface NavItem {
  view: View;
  label: string;
  icon: typeof Search;
}

export const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "library", label: "Library", icon: Library },
  { view: "scan", label: "Scan", icon: Search },
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
