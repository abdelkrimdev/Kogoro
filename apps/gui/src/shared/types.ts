import type { RPCSchema } from "electrobun";

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getWindowState: {
        params: Record<string, never>;
        response: { x: number; y: number; width: number; height: number } | null;
      };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      windowWillClose: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
  }>;
};
