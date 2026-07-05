<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import type { RPCClient } from "../shared";

  interface AuthInfo {
    authUrl?: string;
    instructions?: string;
  }

  interface Field {
    name: string;
    label: string;
    type: "text" | "password";
    placeholder?: string;
  }

  interface Props {
    rpc: RPCClient;
    trackerName: string | null;
    fields: Field[];
    authInfo: AuthInfo;
    onConnect: (trackerName: string, values: Record<string, string>) => Promise<void>;
    onOpenExternalError?: (url: string) => void;
    onCancel: () => void;
  }

  let { rpc, trackerName, fields, authInfo, onConnect, onOpenExternalError, onCancel }: Props = $props();

  let values = $state<Record<string, string>>({});
  let connecting = $state(false);

  async function handleOpenAuthUrl() {
    if (!authInfo.authUrl) return;
    const result = (await rpc.request("openExternal", { url: authInfo.authUrl })) as { success: boolean; url?: string };
    if (!result.success && result.url && onOpenExternalError) {
      onOpenExternalError(result.url);
    }
  }

  async function handleConnect() {
    if (!trackerName) return;
    connecting = true;
    try {
      await onConnect(trackerName, values);
    } finally {
      connecting = false;
    }
  }

  function handleInput(fieldName: string, event: Event) {
    const target = event.target as HTMLInputElement;
    values[fieldName] = target.value;
  }
</script>

<Dialog open={!!trackerName} onOpenChange={(details) => { if (!details.open) onCancel(); }}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-sm" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class="card preset-outlined-surface-300-700 w-full max-w-sm p-0 shadow-xl">
        <div class="p-4">
          <Dialog.Title class="text-lg font-semibold text-surface-950-50 mb-2">Connect {trackerName ?? ""}</Dialog.Title>
          <Dialog.Description class="text-sm text-surface-600-400 mb-4">
            {#if authInfo.instructions}
              <div class="whitespace-pre-line mb-2">{authInfo.instructions}</div>
              {#if authInfo.authUrl}
                <button
                  type="button"
                  class="text-primary-500 underline hover:text-primary-600 text-left break-all cursor-pointer bg-transparent border-0 p-0"
                  onclick={handleOpenAuthUrl}
                >
                  Open Authorization Link
                </button>
              {/if}
            {:else}
              Enter your credentials to connect this tracker.
            {/if}
          </Dialog.Description>
          <div class="space-y-3">
            {#each fields as field}
              <label class="label">
                <span class="label-text">{field.label}</span>
                <input
                  type={field.type}
                  placeholder={field.placeholder ?? ""}
                  oninput={(e) => handleInput(field.name, e)}
                  class="input"
                />
              </label>
            {/each}
          </div>
        </div>
        <div class="p-4 border-t border-surface-300-700 flex justify-end gap-3">
          <Dialog.CloseTrigger class="btn preset-tonal-surface rounded-lg font-medium">
            Cancel
          </Dialog.CloseTrigger>
          <button
            type="button"
            class="btn preset-filled-primary-500 rounded-lg font-medium"
            onclick={handleConnect}
            disabled={connecting}
          >
            {connecting ? "Connecting..." : "Connect"}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
