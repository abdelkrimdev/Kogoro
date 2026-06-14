import "./index.css";
import { Electroview } from "electrobun/view";
import { mount } from "svelte";
import type { AppRPC } from "../shared/types";
import App from "./lib/App.svelte";

type MessageHandler = (message: string, data: unknown) => void;

const messageHandlers = new Set<MessageHandler>();

function onMessage(handler: MessageHandler) {
  messageHandlers.add(handler);
  return () => {
    messageHandlers.delete(handler);
  };
}

const rpc = Electroview.defineRPC<AppRPC>({
  maxRequestTime: Infinity,
  handlers: {
    requests: {},
    messages: {
      "*": (message: string, data: unknown) => {
        for (const handler of messageHandlers) {
          handler(message, data);
        }
      },
    },
  },
});

const electrobun = new Electroview({ rpc });

document.addEventListener("DOMContentLoaded", () => {
  const appRpc = rpc as { request: (method: string, params: unknown) => Promise<unknown> };

  const target = document.getElementById("content");
  if (!target) return;

  mount(App, { target, props: { rpc: appRpc, onMessage } });
});

window.addEventListener("beforeunload", () => {
  const { outerWidth, outerHeight, screenX, screenY } = window;
  electrobun?.rpc?.send.windowWillClose({
    x: screenX,
    y: screenY,
    width: outerWidth,
    height: outerHeight,
  });
});
