# Framework Components

28 Svelte components exported by `@skeletonlabs/skeleton-svelte`. All are built on **Zag.js** state machines and require **Svelte 5**. All use a sub-component anatomy: the root element accepts child snippets/sub-components for each section.

If a primitive does not need state, accessibility wiring, or keyboard handling, prefer the Tailwind utility class from `tailwind-components.md` instead.

## Quick reference

| Component | When to use | Sub-components |
| --- | --- | --- |
| `Accordion` | Expandable/collapsible FAQ-like sections | `.Item`, `.ItemTrigger`, `.ItemIndicator`, `.ItemContent` |
| `AppBar` | Top app header with lead/headline/trail slots | `.Toolbar`, `.Lead`, `.Headline`, `.Trail` |
| `Avatar` | User profile image with fallback initials | `.Image`, `.Fallback` |
| `Carousel` | Slideshow / paginated image gallery | `.Control`, `.PrevTrigger`, `.NextTrigger`, `.AutoplayTrigger`, `.ItemGroup`, `.Item`, `.IndicatorGroup`, `.Indicator`, `.ProgressText` |
| `Collapsible` | Single expandable panel (show more/less) | `.Trigger`, `.Content` |
| `Combobox` | Searchable, filterable select with custom rendering | `.Label`, `.Control`, `.Input`, `.Trigger`, `.ClearTrigger`, `.Positioner`, `.Content`, `.Item`, `.ItemText`, `.ItemIndicator` |
| `DatePicker` | Date input with calendar popover | `.Label`, `.Control`, `.Input`, `.Trigger`, `.Positioner`, `.Content`, `.View`, `.ViewControl`, `.ViewTrigger`, `.PrevTrigger`, `.NextTrigger`, `.RangeText`, `.Table`, `.TableHead`, `.TableBody`, `.TableRow`, `.TableHeader`, `.TableCell`, `.TableCellTrigger`, `.MonthSelect`, `.YearSelect` |
| `Dialog` | Modal dialog with backdrop and focus trap | `.Trigger`, `.Backdrop`, `.Positioner`, `.Content`, `.Title`, `.Description`, `.CloseTrigger` (plus `Portal`) |
| `FileUpload` | Drag-and-drop file picker | `.Label`, `.Dropzone`, `.Trigger`, `.HiddenInput`, `.ItemGroup`, `.Item`, `.ItemName`, `.ItemSizeText`, `.ItemDeleteTrigger`, `.ClearTrigger` |
| `FloatingPanel` | Free-floating, draggable, resizable panel | `.Trigger`, `.Positioner`, `.Content`, `.DragTrigger`, `.Header`, `.Title`, `.Control`, `.StageTrigger`, `.CloseTrigger`, `.Body`, `.ResizeTrigger` |
| `Listbox` | Selectable list (single/multiple) with collection helper | `.Label`, `.Content`, `.Item`, `.ItemText`, `.ItemIndicator` |
| `Menu` | Dropdown menu with optional radio/checkbox items | `.Trigger`, `.Positioner`, `.Content`, `.OptionItem`, `.ItemText`, `.ItemIndicator`, `.Separator` |
| `Navigation` | Sidebar / rail / bar navigation layout | `.Header`, `.Content`, `.Group`, `.Label`, `.Menu`, `.Trigger`, `.TriggerAnchor`, `.TriggerText`, `.Footer` |
| `Pagination` | Page navigation for long lists | `.FirstTrigger`, `.PrevTrigger`, `.Item`, `.Ellipsis`, `.NextTrigger`, `.LastTrigger` |
| `Popover` | Anchored floating content (info, menus, profile cards) | `.Trigger`, `.Positioner`, `.Content`, `.Title`, `.Description`, `.CloseTrigger`, `.Arrow`, `.ArrowTip` |
| `Portal` | Render children at the document root (utility) | — |
| `Progress` | Linear or circular progress indicator | `.Label`, `.Track`, `.Range`, `.ValueText`, `.Circle`, `.CircleTrack`, `.CircleRange` |
| `RatingGroup` | Star/heart rating input | `.Label`, `.Control`, `.Item`, `.HiddenInput` |
| `SegmentedControl` | iOS-style segmented control | `.Label`, `.Control`, `.Indicator`, `.Item`, `.ItemText`, `.ItemHiddenInput` |
| `Slider` | Single or range slider | `.Control`, `.Track`, `.Range`, `.Thumb`, `.HiddenInput` |
| `Steps` | Stepped wizard/progress indicator | `.List`, `.Item`, `.Trigger`, `.Indicator`, `.Separator`, `.Content`, `.PrevTrigger`, `.NextTrigger` |
| `Switch` | On/off toggle (use instead of styled checkbox) | `.Control`, `.Thumb`, `.Label`, `.HiddenInput` |
| `Tabs` | Tabbed content panels | `.List`, `.Trigger`, `.Indicator`, `.Content` |
| `TagsInput` | Tag editor (add/remove tokens) | `.Label`, `.Control`, `.Input`, `.ClearTrigger`, `.Item`, `.ItemPreview`, `.ItemText`, `.ItemDeleteTrigger`, `.ItemInput`, `.HiddenInput` |
| `Toast` | Transient notifications | `.Group`, `.Message`, `.Title`, `.Description`, `.ActionTrigger`, `.CloseTrigger` (uses `createToaster()`) |
| `ToggleGroup` | Toolbar-style toggle buttons (single or multi) | `.Item` |
| `Tooltip` | Hover/focus popover for hints | `.Trigger`, `.Positioner`, `.Content`, `.Arrow`, `.ArrowTip` |
| `TreeView` | Hierarchical file/folder view | `.Label`, `.Tree`, `.NodeProvider`, `.Branch`, `.BranchControl`, `.BranchIndicator`, `.BranchText`, `.BranchContent`, `.BranchIndentGuide`, `.Item` |

Plus the `useListCollection` hook (powers `Listbox`, `Combobox`, `Select`-style data flows).

## Common patterns

### Bindable props

Most components support `bind:value` / `bind:open` / `bind:checked` shortcuts:

```svelte
<Dialog bind:open>…</Dialog>
<Switch bind:checked>…</Switch>
<Tabs bind:value>…</Tabs>
<Accordion bind:value>…</Accordion>
```

For non-bindable state, use the controlled form:

```svelte
<Dialog {open} onOpenChange={(d) => (open = d.open)}>…</Dialog>
```

### Provider pattern (imperative control)

When you need to open/close a component from anywhere (e.g. a header button opening a sidebar), use the `useX()` hook plus `<X.Provider value={…}>`:

```svelte
<script>
  import { Dialog, Portal, useDialog } from '@skeletonlabs/skeleton-svelte';
  const id = $props.id();
  const dialog = useDialog({ id });
</script>

<button class="btn preset-filled" onclick={() => dialog().setOpen(true)}>Open</button>

<Dialog.Provider value={dialog}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center">
      <Dialog.Content class="card bg-surface-100-900 p-4">…</Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog.Provider>
```

### Context snippet

Some components expose imperative data via a `Context` snippet, so you can render dynamic children:

```svelte
<ToggleGroup>
  <ToggleGroup.Context>
    {#snippet children(api)}
      {#each api().value as v (v)}
        <ToggleGroup.Item {v}>…</ToggleGroup.Item>
      {/each}
    {/snippet}
  </ToggleGroup.Context>
</ToggleGroup>
```

The same pattern is used in `FileUpload`, `TreeView`, `Carousel`, etc.

### The `Portal` wrapper

Floating components (`Dialog`, `Popover`, `Tooltip`, `Menu`, `Combobox`, `Listbox`, `DatePicker`, `FloatingPanel`, `Toast`) require a `<Portal>` wrapper around the positioned content to escape parent overflow/stacking contexts. The root trigger stays inline; the positioner and content go inside `Portal`.

```svelte
<Dialog>
  <Dialog.Trigger class="btn preset-filled">Open</Dialog.Trigger>
  <Portal>
    <Dialog.Backdrop … />
    <Dialog.Positioner …>
      <Dialog.Content …>…</Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
```

## Anatomy details for the most-used components

### Dialog

```svelte
<Dialog>
  <Dialog.Trigger />
  <Portal>
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content>
        <Dialog.Title />
        <Dialog.Description />
        <Dialog.CloseTrigger />
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
```

`Dialog.Content` is your "panel" - the only part you style with `card preset-…`. `Dialog.Backdrop` is a separate full-screen overlay.

### Popover

Same structure as Dialog (Trigger + Portal + Positioner + Content). Adds optional `Popover.Title`, `Popover.Description`, `Popover.CloseTrigger`, and `Popover.Arrow` / `Popover.ArrowTip` for the visual arrow.

### Switch

```svelte
<Switch {checked} onCheckedChange={(d) => (checked = d.checked)}>
  <Switch.Control>
    <Switch.Thumb />
  </Switch.Control>
  <Switch.Label>Label</Switch.Label>
  <Switch.HiddenInput />
</Switch>
```

Use `<Switch>` for binary toggles. The native `<input type="checkbox">` is not styled by Skeleton.

### Tabs

```svelte
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Content value="overview">…</Tabs.Content>
</Tabs>
```

### Combobox / Listbox

Both rely on `useListCollection` to turn a data array into a collection:

```svelte
<script>
  import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';

  const data = [{ label: 'Apple', value: 'apple' }, …];
  const collection = useListCollection({
    items: data,
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
  });
</script>

<Combobox {collection}>
  <Combobox.Control>
    <Combobox.Input />
    <Combobox.Trigger />
  </Combobox.Control>
  <Portal>
    <Combobox.Positioner>
      <Combobox.Content>
        {#each collection.items as item (item.value)}
          <Combobox.Item {item}>
            <Combobox.ItemText>{item.label}</Combobox.ItemText>
            <Combobox.ItemIndicator />
          </Combobox.Item>
        {/each}
      </Combobox.Content>
    </Combobox.Positioner>
  </Portal>
</Combobox>
```

### Toast

Toasts need a toaster instance created once (typically at the app root):

```svelte
<script>
  import { Toast, createToaster } from '@skeletonlabs/skeleton-svelte';
  const toaster = createToaster();
</script>

<button class="btn preset-filled" onclick={() => toaster.info({ title: 'Hi', description: '…' })}>
  Trigger
</button>

<Toast.Group {toaster}>
  {#snippet children(toast)}
    <Toast {toast}>
      <Toast.Message>
        <Toast.Title>{toast.title}</Toast.Title>
        <Toast.Description>{toast.description}</Toast.Description>
      </Toast.Message>
      <Toast.CloseTrigger />
    </Toast>
  {/snippet}
</Toast.Group>
```

`createToaster()` accepts options like `placement`, `overlap`, `duration`, and `maxVisible`.

## Icons

Skeleton does not ship icons. Use `@lucide/svelte` (the most common pairing) and apply sizing with Tailwind:

```svelte
<XIcon class="size-4" />
<MenuIcon class="size-5" />
```

## Agent Directives

- **(Strict) Do not invent sub-components.** The list above is exhaustive for the current Svelte package. If you find yourself writing `Dialog.Header`, `Dialog.Body`, `Dialog.Footer`, `Card.Header`, `Card.Title`, `Card.Description`, `Button`, `Input`, or `<Dialog transition={fade}>`, you are looking at outdated (v2/v3) Skeleton code. It will not work in v4.
- **(Strict) Do not wrap every component in `<X.Provider>`.** Provider is for sharing one component's API across distant parts of the tree. For colocated usage, prefer the natural anatomy.
- **(Strict) Do not skip `Portal`** for floating components - you will hit z-index and overflow issues.
- **(Freedom) Mixing Layers:** You can freely place Tailwind utility components (like `btn`, `card`) inside the slots/snippets of framework components.
