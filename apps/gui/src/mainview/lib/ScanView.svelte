<script lang="ts">
  import { FolderSearch } from '@lucide/svelte';

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
  }

  let { rpc }: Props = $props();

  let scanning = $state(false);

  async function startScan() {
    try {
      const result = (await rpc.request("openDirectoryPicker", {})) as { path: string } | null;
      if (!result) return;
      scanning = true;
      await rpc.request("scanStart", { path: result.path });
    } catch (err) {
      console.error("Failed to start scan:", err);
    } finally {
      scanning = false;
    }
  }
</script>

<div class="flex items-center justify-center h-full">
  <div class="text-center space-y-4">
    <FolderSearch class="size-16 text-surface-600-400 mx-auto" />
    <p class="text-surface-600-400 text-sm">Select a folder to scan for anime files.</p>
    <button
      type="button"
      class="btn preset-filled-primary-500 rounded-lg font-medium"
      onclick={startScan}
      disabled={scanning}
    >
      {scanning ? "Scanning..." : "Start Scan"}
    </button>
  </div>
</div>
