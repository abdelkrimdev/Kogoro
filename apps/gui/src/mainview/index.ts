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

document.addEventListener("DOMContentLoaded", async () => {
  const appRpc = rpc as { request: (method: string, params: unknown) => Promise<unknown> };

  const result = await rpc.request("checkOnboarding", {});

  if (result.needsOnboarding) {
    const target = document.getElementById("content");
    if (target) {
      mount(App, { target, props: { rpc: appRpc, onMessage } });
    }
    messageHandler?.("showOnboarding", {});
    return;
  }

  const target = document.getElementById("content");
  if (!target) return;

  const { animeCount } = (await rpc.request("getLibraryStats", {})) as {
    animeCount: number;
    episodeCount: number;
  };
  const initialView = animeCount > 0 ? "library" : "scan";
  mount(App, { target, props: { rpc: appRpc, onMessage, initialView } });
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
