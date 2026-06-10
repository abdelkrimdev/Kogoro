<script lang="ts">
  import { TriangleAlert } from '@lucide/svelte';
  import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';

  interface Props {
    platform: string;
    envVar: string;
  }

  let { platform, envVar }: Props = $props();

  const platformGuidance: Record<string, { title: string; steps: string[] }> = {
    linux: {
      title: "Fix keyring on Linux",
      steps: [
        "Install a keyring daemon: sudo apt install gnome-keyring",
        "Start it: gnome-keyring-daemon --start",
        "If on WSL or headless, use the environment variable instead.",
      ],
    },
    darwin: {
      title: "Fix keychain on macOS",
      steps: [
        "Open Keychain Access (Spotlight → Keychain Access)",
        "Make sure the login keychain is unlocked",
        "If locked, click the lock icon and enter your password",
      ],
    },
    win32: {
      title: "Fix Credential Manager on Windows",
      steps: [
        "Open Control Panel → Credential Manager",
        "Make sure Windows Credential Manager is accessible",
        "Try saving a test credential manually to verify it works",
      ],
    },
  };

  const guidance = $derived(platformGuidance[platform] ?? platformGuidance["linux"]);
</script>

<div class="card preset-tonal-warning p-3 flex items-start gap-3 text-sm">
  <TriangleAlert class="size-4 mt-0.5 shrink-0 text-warning-500-400" />
  <div class="flex-1 min-w-0">
    <p class="text-surface-950-50">
      OS keyring unavailable — your API key will not be saved permanently.
      Set the <code class="text-xs bg-surface-200-800 px-1 py-0.5 rounded">{envVar}</code> environment variable to persist it.
    </p>
    <Popover>
      <Popover.Trigger class="text-xs text-warning-600-400 underline mt-1 cursor-pointer hover:text-warning-500-300">
        How to fix the keyring
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner class="z-50">
          <Popover.Content class="card bg-surface-100-900 p-4 w-80 shadow-xl space-y-2">
            <Popover.Title class="text-sm font-semibold text-surface-950-50">{guidance?.title}</Popover.Title>
            <Popover.Description class="text-xs text-surface-700-300 space-y-1">
              {#each guidance?.steps ?? [] as step}
                <p>{step}</p>
              {/each}
              <p class="pt-1">
                Or set the environment variable:
                <code class="block bg-surface-200-800 px-1 py-0.5 rounded mt-1">{envVar}=your-api-key</code>
              </p>
            </Popover.Description>
            <Popover.CloseTrigger class="btn btn-sm preset-tonal-surface rounded-lg w-full mt-2">
              Got it
            </Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover>
  </div>
</div>
