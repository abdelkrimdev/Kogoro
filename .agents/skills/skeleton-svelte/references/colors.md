# Color System

Skeleton uses a small, fixed palette of 7 colors across 11 shades, with a **dual-tone pairing** syntax that swaps between light and dark mode without `dark:` prefixes.

## Color palette

| Name | Role |
| --- | --- |
| `primary` | Brand color, primary actions |
| `secondary` | Secondary brand, supporting actions |
| `tertiary` | Tertiary accent, used sparingly |
| `success` | Positive states, confirmations |
| `warning` | Caution states, pending states |
| `error` | Destructive actions, errors |
| `surface` | Neutral backgrounds, layering, text |

## Shades

Each color has 11 shades: `50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`.

Lower = lighter, higher = darker. The middle shade (`500`) is the canonical accent color used by most presets.

## Utility class pattern

```
{property}-{color}-{shade}
```

**Properties:** `bg`, `text`, `border`, `accent`, `caret`, `decoration`, `divide`, `fill`, `outline`, `ring`, `shadow`, `stroke`.

```html
<div class="bg-primary-500 text-white">Primary background</div>
<p class="text-error-700">Error text</p>
<button class="border-secondary-300">Bordered</button>
```

## Color pairings (theme-aware)

For elements that need to adapt to the current color scheme, use the condensed dual-tone syntax:

```
{property}-{color}-{lightShade}-{darkShade}
```

The light shade applies in light mode; the dark shade applies in dark mode. There is no `dark:` prefix.

```html
<!-- Light: surface-50 background.  Dark: surface-950 background. -->
<div class="bg-surface-50-950">…</div>

<!-- Light: dark text.  Dark: light text. -->
<p class="text-surface-950-50">Adapts to mode</p>

<!-- Light: subtle border.  Dark: stronger border. -->
<div class="border border-surface-300-700">…</div>
```

**Why this exists:** it removes the need to repeat `dark:` variants and makes the intent obvious in the markup.

### Common pairings

**Surfaces (backgrounds):**

| Class | Light | Dark |
| --- | --- | --- |
| `bg-surface-50-950` | lightest | darkest |
| `bg-surface-100-900` | near-white | near-black |
| `bg-surface-200-800` | very light | very dark |
| `bg-surface-300-700` | light gray | dark gray |

**Text on surfaces:**

| Class | Light | Dark |
| --- | --- | --- |
| `text-surface-950-50` | near-black | white |
| `text-surface-900-100` | strong | strong |
| `text-surface-700-300` | secondary | secondary |
| `text-surface-600-400` | muted | muted |

**Borders:**

| Class | Use |
| --- | --- |
| `border-surface-200-800` | subtle dividers |
| `border-surface-300-700` | standard borders |
| `divide-surface-200-800` | between children in a list |

## Contrast colors

For accessible text on filled backgrounds, Skeleton provides matching contrast colors:

```
{property}-{color}-contrast-{shade}
```

```html
<div class="bg-primary-500 text-primary-contrast-500">…</div>
```

These are tuned for WCAG-compliant contrast against the matching shade in both light and dark mode.

## Transparency

All colors and pairings support Tailwind's slash syntax:

```html
<div class="bg-primary-500/25">25% opacity</div>
<div class="bg-surface-100-900/50">Semi-transparent adaptive</div>
```

## Forcing a scheme

To pin a subtree to light or dark mode regardless of the page-level scheme, use the `scheme-light` or `scheme-dark` class:

```html
<div class="scheme-light">
  <div class="bg-primary-50-950">Always light</div>
</div>

<div class="scheme-dark">
  <div class="bg-primary-50-950">Always dark</div>
</div>
```

## Agent Directives

- **(Strict) Never use `dark:` for Skeleton colors.** Use pairings instead.
- **(Freedom) The `dark:` prefix is allowed** for plain Tailwind colors that are not in Skeleton's palette.
- **(Strict) Use semantic colors over aesthetic ones.** `text-error-500` for an error, not `text-red-500`.
- **(Strict) Use `surface` for layering and backgrounds**, not `primary` or `secondary`.
- **(Strict) Use a contrast color or a pair from the inverse end** for text on filled surfaces.
