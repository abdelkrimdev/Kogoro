<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import type { RPCClient } from "../shared";
  import type { TrackerConnectionInfo } from "../../shared/types";

  interface AuthInfo {
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
    trackerStatus: TrackerConnectionInfo[];
    fields: Field[];
    authInfo: AuthInfo;
    onConnect: (trackerName: string, values: Record<string, string>) => Promise<void>;
    onOpenExternalError?: (url: string) => void;
    onCancel: () => void;
  }

  let { rpc, trackerName, trackerStatus, fields, authInfo, onConnect, onOpenExternalError, onCancel }: Props = $props();

  const displayName = $derived(
    trackerStatus.find((t) => t.name === trackerName)?.displayName ?? trackerName ?? ""
  );

  let values = $state<Record<string, string>>({});
  let connecting = $state(false);
  let waitingForCallback = $state(false);
  let callbackCancelled = $state(false);
  let errorMessage = $state<string | null>(null);

  const isOAuthTracker = $derived(fields.length === 0);

  $effect(() => {
    trackerName;
    values = {};
    connecting = false;
    waitingForCallback = false;
    callbackCancelled = false;
    errorMessage = null;
  });

  async function handleOpenAuthUrl() {
    if (!trackerName) return;
    waitingForCallback = true;
    callbackCancelled = false;
    errorMessage = null;
    try {
      const result = await rpc.request("startTrackerAuth", { trackerName }) as { authUrl: string; state: string };
      const openResult = (await rpc.request("openExternal", { url: result.authUrl })) as { success: boolean; url?: string };
      if (!openResult.success && openResult.url && onOpenExternalError) {
        onOpenExternalError(openResult.url);
      }
      const callbackResult = await rpc.request("waitForTrackerCallback", { state: result.state }) as { code: string; state: string };
      if (callbackCancelled) return;
      if (callbackResult.code) {
        await onConnect(trackerName, { code: callbackResult.code });
      } else {
        waitingForCallback = false;
        errorMessage = "Authorization timed out. Please try again.";
      }
    } catch (error) {
      if (callbackCancelled) return;
      waitingForCallback = false;
      errorMessage = error instanceof Error ? error.message : "Authorization failed";
    }
  }

  async function handleConnect() {
    if (!trackerName) return;
    connecting = true;
    errorMessage = null;
    try {
      await onConnect(trackerName, values);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Connection failed";
    } finally {
      connecting = false;
    }
  }

  async function handleCancelCallback() {
    callbackCancelled = true;
    waitingForCallback = false;
    await rpc.request("cancelTrackerAuth", {});
    onCancel();
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
          <Dialog.Title class="text-lg font-semibold text-surface-950-50 mb-2">Connect {displayName}</Dialog.Title>
          <Dialog.Description class="text-sm text-surface-600-400 mb-4">
            {#if waitingForCallback}
              <div class="flex flex-col items-center gap-3 py-4">
                <div class="size-8 border-2 border-surface-300-700 border-t-primary-500 rounded-full animate-spin"></div>
                <div class="text-surface-950-50 text-center">Waiting for authorization...</div>
                <div class="text-surface-600-400 text-xs text-center">Complete the authorization in your browser</div>
              </div>
            {:else if isOAuthTracker}
              <div class="whitespace-pre-line mb-2">{authInfo.instructions ?? `You'll be redirected to ${displayName} to authorize.`}</div>
            {:else}
              Enter your credentials to connect this tracker.
            {/if}
          </Dialog.Description>
          {#if errorMessage}
            <div class="text-sm text-error-500 mb-4 p-2 rounded bg-error-500/10">{errorMessage}</div>
            {#if isOAuthTracker}
              <button
                type="button"
                class="btn preset-filled-primary-500 rounded-lg font-medium mb-4"
                onclick={handleOpenAuthUrl}
              >
                Try Again
              </button>
            {/if}
          {:else if fields.length > 0 && !waitingForCallback}
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
          {/if}
        </div>
        <div class="p-4 border-t border-surface-300-700 flex justify-end gap-3">
          {#if waitingForCallback}
            <button
              type="button"
              class="btn preset-tonal-surface rounded-lg font-medium"
              onclick={handleCancelCallback}
            >
              Cancel
            </button>
          {:else}
            <Dialog.CloseTrigger class="btn preset-tonal-surface rounded-lg font-medium">
              Cancel
            </Dialog.CloseTrigger>
            <button
              type="button"
              class="btn preset-filled-primary-500 rounded-lg font-medium"
              onclick={isOAuthTracker ? handleOpenAuthUrl : handleConnect}
              disabled={connecting}
            >
              {connecting ? "Connecting..." : "Connect"}
            </button>
          {/if}
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
