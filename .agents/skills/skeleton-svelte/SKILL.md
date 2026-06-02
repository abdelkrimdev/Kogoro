---
name: skeleton-svelte
description: Build accessible, theme-aware UIs with Skeleton for Svelte 5. Skeleton has two layers - Tailwind utility classes for primitives (card, btn, input, badge) and 28 Svelte framework components (Dialog, Popover, Combobox, Tabs, etc.) powered by Zag.js. Use when building Svelte 5 UIs with Skeleton, choosing between Tailwind utilities and framework components, applying color pairings and presets, designing responsive layouts, or setting up Skeleton themes.
---

# Skeleton Svelte

## Overview

Skeleton is a design system built on **Tailwind CSS 4** with a Svelte component layer powered by **Zag.js**. It ships two distinct surfaces that are easy to confuse:

1. **Tailwind utility components** - CSS classes (`card`, `btn`, `input`, `badge`, …) applied to native HTML elements. No JS, no imports. This is the right choice for most primitives.
2. **Framework components** - 28 Svelte exports from `@skeletonlabs/skeleton-svelte` (Dialog, Popover, Combobox, Tabs, Accordion, …) for stateful, accessible, keyboard-driven widgets. Built on Zag.js.

Both layers share the **color-pairing** and **preset** systems, so the visual language is consistent.

## Agent Directives

### 1. Pick the Right Layer (Strict)

| Need | Use | Why |
| --- | --- | --- |
| Button, card, badge, input, label, select, textarea, chip, progress, kbd, anchor, hr, code | Tailwind utility class on native HTML | Zero JS, smallest bundle, full HTML semantics |
| Dialog, popover, combobox, listbox, menu, tabs, switch, slider, tooltip, accordion, date picker, file upload, pagination, toast, tree view, navigation, app bar, steps, rating group, tags input, toggle group, segmented control, carousel, collapsible, floating panel | Framework component from `@skeletonlabs/skeleton-svelte` | Need state, a11y, keyboard handling, focus management |

### 2. Theming and Styling (Strict)

Always use Skeleton's built-in systems for colors and base styles to maintain visual consistency:
- **Color Pairings:** `{property}-{color}-{lightShade}-{darkShade}` (e.g., `bg-surface-50-950 text-surface-950-50`). No `dark:` prefixes. See `references/colors.md`.
- **Presets:** `preset-filled-{color}-{shade}`, `preset-tonal-{color}`, `preset-outlined-{color}-{shade}`. Apply to interactive elements via `class`. See `references/presets.md`.

### 3. Fill the Gaps (Freedom)

You have full freedom to combine Skeleton primitives with standard Tailwind CSS utilities to achieve specific layouts, spacing, sizing, typography, and micro-interactions. If a design requirement isn't directly covered by a built-in Skeleton component or preset, use Tailwind to creatively solve the problem while adhering to the overall aesthetic.

## Quick start

```bash
npm i -D @skeletonlabs/skeleton @skeletonlabs/skeleton-svelte
```

```css
/* app.css */
@import 'tailwindcss';
@import '@skeletonlabs/skeleton';
@import '@skeletonlabs/skeleton/themes/cerberus';
```

```html
<html data-theme="cerberus">…</html>
```

```svelte
<script>
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  let open = $state(false);
</script>

<button type="button" class="btn preset-filled-primary-500" onclick={() => (open = true)}>
  Open dialog
</button>

<Dialog bind:open>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class="card bg-surface-100-900 w-md p-4 space-y-2 shadow-xl">
        <Dialog.Title class="text-2xl font-bold">Title</Dialog.Title>
        <Dialog.Description>Body text.</Dialog.Description>
        <Dialog.CloseTrigger class="btn preset-tonal">Close</Dialog.CloseTrigger>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
```

Full setup: `references/installation.md`.

## Workflow: building a UI

### Step 1 - Identify each piece

For each visual element, decide: native HTML + Tailwind class, or a framework component? Most "card with a button inside" patterns are utility classes with optional framework sub-components.

### Step 2 - Style with pairings + presets

Apply color pairings for backgrounds, text, borders. Apply presets for interactive elements (buttons, badges, alerts). Combine with Tailwind utilities for layout, spacing, sizing.

### Step 3 - Wire up state (framework components only)

Framework components use Svelte 5 runes. Control via the `value` / `defaultValue` + `onXChange` props, or `bind:open` / `bind:checked` shortcuts:

```svelte
<Dialog bind:open>…</Dialog>
<Switch bind:checked>…</Switch>
<Tabs {value} onValueChange={(d) => (value = d.value)}>…</Tabs>
```

Provider pattern for imperative control: `useX()` hook + `<X.Provider value={…}>` (see `references/framework-components.md`).

### Step 4 - Layer layout

Use semantic HTML + Tailwind grid/flex for structure. See `references/layouts.md`.

## Common patterns

### Card with action footer

```svelte
<div class="card preset-filled-surface-100-900 p-4 space-y-3">
  <h3 class="h3">Title</h3>
  <p class="opacity-60">Body text.</p>
  <div class="flex justify-end gap-2">
    <button type="button" class="btn preset-outlined-surface-300-700">Cancel</button>
    <button type="button" class="btn preset-filled-primary-500">Confirm</button>
  </div>
</div>
```

### Form field

```html
<label class="label">
  <span class="label-text">Email</span>
  <input class="input" type="email" placeholder="you@example.com" />
</label>
```

### Status badge

```html
<span class="badge preset-tonal-success">Active</span>
<span class="badge preset-tonal-warning">Pending</span>
<span class="badge preset-tonal-error">Failed</span>
```

### Theme-aware section

```html
<section class="bg-surface-100-900 text-surface-950-50 p-6">
  <h2 class="h2">Section</h2>
  <p class="text-surface-700-300">Adapts to light and dark automatically.</p>
</section>
```

## References

- `references/installation.md` - packages, CSS imports, theme setup
- `references/tailwind-components.md` - all utility-class primitives
- `references/framework-components.md` - all 28 Svelte exports with anatomies
- `references/colors.md` - color system, pairings, contrast, transparency
- `references/presets.md` - filled/tonal/outlined + custom presets
- `references/themes.md` - preset themes (cerberus, mona, vox, catppuccin) and custom themes
- `references/layouts.md` - semantic HTML, grid/flex patterns, responsive design

## External resources

- Docs: https://www.skeleton.dev
- Components catalog: https://www.skeleton.dev/components
- Themes: https://www.skeleton.dev/themes
- Repository: https://github.com/skeletonlabs/skeleton

## Notes

- Foundation: Tailwind CSS 4 + Zag.js (state machines, framework-agnostic).
- Two packages: `@skeletonlabs/skeleton` (core CSS, themes) and `@skeletonlabs/skeleton-svelte` (Svelte components). Both are dev dependencies.
- When in doubt, prefer the utility class over the framework component. The framework layer exists for behavior you cannot reasonably re-implement (focus traps, keyboard nav, ARIA wiring).
