<script lang="ts">
  import { Check, Minus } from '@lucide/svelte';

  interface Props {
    checked: boolean | null;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { checked, disabled = false, onchange }: Props = $props();

  const isChecked = $derived(checked === true);
  const isIndeterminate = $derived(checked === null);

  function handleClick() {
    if (disabled) return;
    onchange?.(!isChecked);
  }
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked === null ? "mixed" : checked}
  {disabled}
  class="shrink-0 size-4 rounded border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 {isChecked ? 'bg-primary-500 border-primary-500' : isIndeterminate ? 'bg-primary-500/20 border-primary-500' : 'border-surface-400-500'} {disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}"
  onclick={handleClick}
>
  {#if isChecked}
    <Check class="size-3 text-white" />
  {:else if isIndeterminate}
    <Minus class="size-3 text-primary-500" />
  {/if}
</button>
