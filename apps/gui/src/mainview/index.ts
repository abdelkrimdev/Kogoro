import "./index.css";
import { Electroview } from "electrobun/view";
import { mount } from "svelte";
import type { AppRPC } from "../shared/types";
import App from "./lib/App.svelte";

let messageHandler: ((message: string, data: unknown) => void) | null = null;

function onMessage(handler: (message: string, data: unknown) => void) {
  messageHandler = handler;
}

const rpc = Electroview.defineRPC<AppRPC>({
  handlers: {
    requests: {},
    messages: {
      "*": (message: string, data: unknown) => {
        messageHandler?.(message, data);
      },
    },
  },
});

const electrobun = new Electroview({ rpc });

document.addEventListener("DOMContentLoaded", () => {
  rpc.request("checkOnboarding", {}).then((result) => {
    if (result.needsOnboarding) {
      const target = document.getElementById("content");
      if (target) {
        mount(App, {
          target,
          props: {
            rpc: rpc as { request: (method: string, params: unknown) => Promise<unknown> },
            onMessage,
          },
        });
      }
      messageHandler?.("showOnboarding", {});
      return;
    }

    rpc.request("getLibraryStats", {}).then((stats) => {
      const libraryStats = stats as { animeCount: number; episodeCount: number };
      const initialView = libraryStats.animeCount > 0 ? "library" : "scan";
      const target = document.getElementById("content");
      if (!target) return;
      mount(App, {
        target,
        props: {
          rpc: rpc as { request: (method: string, params: unknown) => Promise<unknown> },
          onMessage,
          initialView,
        },
      });
    });
  });
});

window.addEventListener("beforeunload", () => {
  const { innerWidth, innerHeight, screenX, screenY } = window;
  electrobun?.rpc?.send.windowWillClose({
    x: screenX,
    y: screenY,
    width: innerWidth,
    height: innerHeight,
  });
});
