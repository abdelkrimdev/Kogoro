import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { AppRPC } from "../shared/types";

const STATE_FILE = join(import.meta.dir, "../../.window-state.json");

function loadWindowState(): { x: number; y: number; width: number; height: number } | null {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {
    // ignore corrupt state
  }
  return null;
}

function saveWindowState(state: { x: number; y: number; width: number; height: number }) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // ignore write errors
  }
}

const savedState = loadWindowState();

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {
      getWindowState: () => {
        return savedState;
      },
    },
    messages: {
      "*": () => {},
    },
  },
});

const defaultFrame = { width: 1200, height: 800, x: 200, y: 200 };

const win = new BrowserWindow({
  title: "Kogoro",
  titleBarStyle: "hiddenInset",
  url: "views://mainview/index.html",
  frame: savedState
    ? { width: savedState.width, height: savedState.height, x: savedState.x, y: savedState.y }
    : defaultFrame,
  rpc,
});

win.on("resize", (event: unknown) => {
  const e = event as { data: { x: number; y: number; width: number; height: number } };
  saveWindowState({ x: e.data.x, y: e.data.y, width: e.data.width, height: e.data.height });
});

win.on("move", () => {
  const frame = win.getFrame();
  saveWindowState({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
});
