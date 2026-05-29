import type { RPCSchema } from "electrobun";

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getWindowState: {
        params: Record<string, never>;
        response: { x: number; y: number; width: number; height: number } | null;
      };
      writeOnboardingConfig: {
        params: {
          primaryDb: string;
          apiKey: string;
          templatePreset: string;
          templateCustom?: string;
        };
        response: { success: boolean; error?: string };
      };
      checkOnboarding: {
        params: Record<string, never>;
        response: { needsOnboarding: boolean };
      };
    };
    messages: {
      showOnboarding: Record<string, never>;
      showMainApp: Record<string, never>;
    };
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
