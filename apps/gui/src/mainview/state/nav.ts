import { LayoutGrid, Search, Settings } from "@lucide/svelte";

export type View = "onboarding" | "scan" | "library" | "details" | "settings" | "review";

export interface NavItem {
  view: View;
  label: string;
  icon: typeof Search;
}

export const NAV_ITEMS: NavItem[] = [
  { view: "scan", label: "Scan", icon: Search },
  { view: "library", label: "Library", icon: LayoutGrid },
  { view: "settings", label: "Settings", icon: Settings },
];

const SIDEBAR_KEY = "kogoro-sidebar-collapsed";

export function loadSidebarCollapsed(): boolean {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  } catch {}
}
