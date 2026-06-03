<script lang="ts">
  import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';

  interface Props {
    value: string;
    options: Array<{ value: string; label: string }>;
    label?: string;
    placeholder?: string;
    onValueChange?: (value: string) => void;
  }

  let { value, options, label = "", placeholder = "Search...", onValueChange }: Props = $props();

  let filterText = $state("");

  const filteredOptions = $derived(
    filterText
      ? options.filter((item) => item.label.toLowerCase().includes(filterText.toLowerCase()))
      : options,
  );

  const collection = $derived(
    useListCollection({
      items: filteredOptions,
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
    }),
  );
</script>

<label class="label">
  <span class="label-text">{label}</span>
  <Combobox
    {placeholder}
    {collection}
    onOpenChange={() => { filterText = ""; }}
    onInputValueChange={(e) => { filterText = e.inputValue; }}
    value={[value]}
    onValueChange={(e) => { onValueChange?.(e.value[0] ?? ""); }}
  >
    <Combobox.Control>
      <Combobox.Input />
      <Combobox.Trigger />
    </Combobox.Control>
    <Portal>
      <Combobox.Positioner>
        <Combobox.Content>
          {#each filteredOptions as item (item.value)}
            <Combobox.Item {item}>
              <Combobox.ItemText>{item.label}</Combobox.ItemText>
              <Combobox.ItemIndicator />
            </Combobox.Item>
          {/each}
        </Combobox.Content>
      </Combobox.Positioner>
    </Portal>
  </Combobox>
</label>
