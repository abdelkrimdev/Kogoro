# Design Presets

Presets are shorthand class combinations that apply a complete background + text color treatment to any element. Use them on buttons, cards, badges, alerts - any element that should feel "filled", "tonal", or "outlined" in a specific color.

## Three preset families

| Family | Visual | Use for |
| --- | --- | --- |
| `preset-filled` | Solid background, auto contrast text | Primary actions, CTAs, emphasized cards |
| `preset-tonal` | Soft tinted background, colored text | Secondary actions, alerts, status badges |
| `preset-outlined` | Transparent background, colored border + text | Tertiary actions, subtle cards, low-emphasis surfaces |

## Syntax

```
preset-{family}-{color}
preset-{family}-{color}-{shade}      (filled and outlined only)
```

- **Colors:** `primary`, `secondary`, `tertiary`, `success`, `warning`, `error`, `surface`.
- **Shades:** 50–950. Only the `500` shade is used by default; specify another for tone tuning.
- **Tonal** uses a single fixed shade, so the `-{shade}` segment is not used.

## Examples

### Buttons

```html
<button class="btn preset-filled-primary-500">Primary</button>
<button class="btn preset-tonal-secondary">Secondary</button>
<button class="btn preset-outlined-surface-300-700">Cancel</button>
<button class="btn preset-filled-error-500">Delete</button>
```

### Cards

```html
<div class="card preset-filled-surface-100-900 p-4">…</div>
<div class="card preset-outlined-primary-500 p-4">…</div>
<div class="card preset-tonal-success p-4">…</div>
```

### Badges / status pills

```html
<span class="badge preset-tonal-success">Active</span>
<span class="badge preset-tonal-warning">Pending</span>
<span class="badge preset-tonal-error">Failed</span>
<span class="badge preset-filled-primary-500">New</span>
```

### Generic elements

Presets work on any element, not just `btn` / `card` / `badge`:

```html
<div class="preset-filled-primary-500 p-4 rounded-container">…</div>
<p class="preset-tonal-error p-2">Inline notice.</p>
```

## Combining with utilities

Layer presets with sizing, spacing, hover, and state utilities:

```html
<button class="btn preset-filled-primary-500 px-6 py-3 shadow-md">Large CTA</button>

<button class="btn preset-tonal-primary hover:preset-filled-primary-500">
  Hover fills
</button>

<button class="btn preset-outlined-surface-300-700 md:preset-filled-surface-100-900">
  Responsive
</button>
```

## Custom presets

Define a custom preset in your global CSS using `@apply` to combine Skeleton utilities and Tailwind utilities. The `preset-` prefix is convention, not required.

```css
/* app.css */
@layer components {
  .preset-elevated {
    @apply preset-filled-surface-50-950 shadow-lg transition-shadow hover:shadow-xl;
  }

  .preset-glass {
    @apply border border-surface-300-700 bg-surface-50-950/10 backdrop-blur-md;
  }
}
```

```html
<div class="card preset-elevated p-4">…</div>
<div class="card preset-glass p-4">…</div>
```

(For Tailwind v4 the `@layer components` wrapper is optional; in `@apply`-based setups it is the conventional location.)

### Gradient presets

Gradients combine two color stops via CSS variables:

```css
@layer components {
  .preset-gradient-primary {
    background-image: linear-gradient(45deg, var(--color-primary-500), var(--color-tertiary-500));
    color: var(--color-primary-contrast-500);
  }
}
```

```html
<button class="btn preset-gradient-primary">Gradient</button>
```

## Agent Directives

- **(Strict) Use presets for the visual treatment**, they are deliberately background + text only.
- **(Freedom) Add standard Tailwind utilities** on top of presets for layout, sizing, and spacing.
- **(Strict) Pick the family that matches emphasis.** Filled > tonal > outlined, from most to least attention.
- **(Strict) For theme-aware surfaces, use pairings in the shade slot.** e.g. `preset-outlined-surface-200-800` adapts to light/dark.
