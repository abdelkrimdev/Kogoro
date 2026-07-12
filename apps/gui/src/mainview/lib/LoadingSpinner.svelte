<script lang="ts">
  import { LoaderCircle } from '@lucide/svelte';

  interface Props {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    class?: string;
  }

  let { size = 'md', class: className = '' }: Props = $props();

  const sizeClass: Record<string, string> = {
    xs: 'size-3',
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-8',
  };
</script>

<LoaderCircle class="animate-spin {sizeClass[size]} {className}" />
