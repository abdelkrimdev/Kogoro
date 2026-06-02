# Skeleton Installation

## Packages

Two packages, both dev dependencies:

- `@skeletonlabs/skeleton` - core CSS, themes, Tailwind plugin
- `@skeletonlabs/skeleton-svelte` - Svelte component library (requires Svelte 5)

```bash
npm i -D @skeletonlabs/skeleton @skeletonlabs/skeleton-svelte
```

## SvelteKit setup

`src/app.css`:

```css
@import 'tailwindcss';

@import '@skeletonlabs/skeleton';
@import '@skeletonlabs/skeleton/themes/cerberus';
```

`src/routes/+layout.svelte`:

```svelte
<script>
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

`src/app.html`:

```html
<!doctype html>
<html lang="en" data-theme="cerberus">
  …
</html>
```

## Other setups (Vite, Astro, non-SvelteKit)

The pattern is the same in all cases: import Tailwind, the core package, and a theme in the global stylesheet, then set `data-theme` on the root element.

## Versioning

| Package | Notes |
| --- | --- |
| Tailwind CSS | v4 (uses `@import 'tailwindcss'`, no `tailwind.config.js`) |
| Svelte | v5 (uses runes) |
| `@skeletonlabs/skeleton-svelte` | requires Svelte 5 |

## Upgrading from Skeleton v3

- The Avatar component no longer accepts `src` / `name` props on the root. Use `<Avatar.Image>` and `<Avatar.Fallback>`.
- Components now use a sub-component anatomy (`Dialog.Trigger`, `Dialog.Backdrop`, `Dialog.Content`, …) instead of single-element APIs.
- Preset themes renamed: `skeleton` (default) is now `cerberus`. `rocket`, `vintage`, `wintry`, `modern`, `seafoam`, `sahara` are no longer included by default.
- The dual-tone color-pairing syntax is unchanged.

See the official migration guide for the full list.
