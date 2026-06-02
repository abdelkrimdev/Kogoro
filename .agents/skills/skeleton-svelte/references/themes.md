# Themes

A **theme** in Skeleton is a CSS file that defines the palette tokens (`--color-primary-50` through `--color-primary-950`, etc.) used by the color utilities and presets. You register one or more themes and switch between them with the `data-theme` attribute on the root element.

## Preset themes

Skeleton ships four built-in themes:

| Name | Vibe |
| --- | --- |
| `cerberus` | Default. Neutral, professional, broad appeal. |
| `mona` | Friendly, slightly more saturated. |
| `vox` | High-contrast, editorial. |
| `catppuccin` | Pastel, soft contrast. |

(Other themes that were present in Skeleton v2/v3, such as `rocket`, `vintage`, `wintry`, `modern`, `seafoam`, `sahara`, are no longer included by default.)

## Registering themes

Import each theme you want to support in your global stylesheet:

```css
/* app.css */
@import 'tailwindcss';

@import '@skeletonlabs/skeleton';
@import '@skeletonlabs/skeleton/themes/cerberus';
@import '@skeletonlabs/skeleton/themes/mona';
@import '@skeletonlabs/skeleton/themes/vox';
```

Custom themes are imported the same way, using a relative path:

```css
@import './my-custom-theme.css';
```

The `.css` extension is optional.

## Activating a theme

Set `data-theme` on the highest element that should pick it up (typically `<html>`):

```html
<html data-theme="cerberus">…</html>
<html data-theme="mona">…</html>
```

All descendants inherit the theme. Pairings like `bg-surface-50-950` automatically adapt.

## Switching themes at runtime

Because themes are pure CSS variable swaps, switching is a one-attribute change:

```svelte
<script>
  let theme = $state('cerberus');
</script>

<html data-theme={theme}>
  <select bind:value={theme}>
    <option value="cerberus">Cerberus</option>
    <option value="mona">Mona</option>
    <option value="vox">Vox</option>
  </select>
  <!-- … -->
</html>
```

No flash, no re-render - just a CSS variable update.

## Theme-specific overrides

To target a specific theme from CSS, scope by the `[data-theme]` attribute:

```css
[data-theme='cerberus'] .h1 {
  color: red;
  @variant dark {
    color: green;
  }
}

[data-theme='mona'] .h1 {
  color: blue;
  @variant dark {
    color: yellow;
  }
}
```

To scope a Tailwind utility to a specific theme from markup, use the `theme-{name}:` prefix:

```html
<div class="bg-green-500 theme-cerberus:bg-red-500">…</div>
<div class="bg-green-500 theme-mona:bg-red-500">…</div>
```

## Authoring a custom theme

A custom theme is a CSS file that defines the 7-color × 11-shade grid plus optional contrast and surface tokens:

```css
/* themes/my-brand.css */
[data-theme='my-brand'] {
  --color-primary-50: oklch(0.97 0.02 250);
  --color-primary-100: oklch(0.93 0.04 250);
  /* … 50..950 for each color … */

  --color-primary-contrast-500: oklch(0.98 0 0);
  --color-surface-contrast-500: oklch(0.15 0 0);

  /* Optional: override spacing or radius per-theme */
  --spacing: 0.25rem;
}
```

Skeleton reads these CSS variables for the pairing utilities and the presets - there is no JavaScript to wire up.

## Light/dark mode inside a theme

A single theme can ship two schemes (light + dark) via the standard Skeleton scheme attribute on a container, or via Tailwind's `@variant dark`:

```html
<div class="scheme-light">
  <div class="bg-primary-50-950">Always light scheme</div>
</div>

<div class="scheme-dark">
  <div class="bg-primary-50-950">Always dark scheme</div>
</div>
```

```css
.h1 {
  color: var(--color-surface-950);
  @variant dark {
    color: var(--color-surface-50);
  }
}
```

## Agent Directives

- **(Strict) Register at least one theme** or the color utilities resolve to undefined CSS variables.
- **(Strict) Pick one theme as the default** by setting `data-theme` on `<html>` server-side. Switching at runtime is then purely additive.
- **(Strict) Custom themes must define all 7 colors × 11 shades** for the utility classes to work consistently.
- **(Freedom) Custom CSS variables:** You can freely define your own non-Skeleton CSS variables inside a theme block for project-specific needs.
