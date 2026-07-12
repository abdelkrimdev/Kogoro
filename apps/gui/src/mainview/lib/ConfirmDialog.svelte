<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

  interface Props {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmClass?: string;
    onConfirm: () => void;
    onOpenChange?: (open: boolean) => void;
  }

  let {
    open,
    title,
    description,
    confirmLabel,
    confirmClass = "preset-filled-primary-500",
    onConfirm,
    onOpenChange,
  }: Props = $props();
</script>

<Dialog {open} onOpenChange={(details) => onOpenChange?.(details.open)}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-sm" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class="card preset-outlined-surface-300-700 w-full max-w-sm p-0 shadow-xl">
        <div class="p-4">
          <Dialog.Title class="text-lg font-semibold text-surface-950-50 mb-2">{title}</Dialog.Title>
          <Dialog.Description class="text-sm text-surface-600-400">
            {description}
          </Dialog.Description>
        </div>
        <div class="p-4 border-t border-surface-300-700 flex justify-end gap-3">
          <Dialog.CloseTrigger class="btn preset-tonal-surface rounded-lg font-medium">
            Cancel
          </Dialog.CloseTrigger>
          <button
            type="button"
            class="btn {confirmClass} rounded-lg font-medium"
            onclick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
