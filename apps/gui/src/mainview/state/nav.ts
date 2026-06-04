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
