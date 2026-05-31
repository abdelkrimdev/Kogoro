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
    const target = document.getElementById("content");
    if (!target) return;
    mount(App, {
      target,
      props: {
        rpc: rpc as { request: (method: string, params: unknown) => Promise<unknown> },
        onMessage,
      },
    });

    if (result.needsOnboarding) {
      messageHandler?.("showOnboarding", {});
    }
  });
});

window.addEventListener("beforeunload", () => {
  const { innerWidth, innerHeight, screenX, screenY } = window;
  const rpcSend = electrobun.rpc as unknown as {
    send?: { windowWillClose?: (data: unknown) => void };
  };
  rpcSend.send?.windowWillClose?.({
    x: screenX,
    y: screenY,
    width: innerWidth,
    height: innerHeight,
  });
});
