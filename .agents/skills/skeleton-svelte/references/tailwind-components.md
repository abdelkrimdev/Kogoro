# Tailwind Utility Components

These are CSS classes shipped by `@skeletonlabs/skeleton`. Apply them to native HTML elements. **There are no Svelte imports.**

When in doubt, prefer these over framework components.

## Buttons

Apply `btn` to a `<button>` (or `<a>` for links).

```html
<button type="button" class="btn preset-filled-primary-500">Primary</button>
<button type="button" class="btn preset-tonal-secondary">Secondary</button>
<button type="button" class="btn preset-outlined-surface-300-700">Cancel</button>
```

**Sizes:** `btn-sm`, `btn-base` (default), `btn-lg`.

**Icon-only button:** use `btn-icon` instead of `btn`.

```html
<button type="button" class="btn-icon preset-filled" aria-label="Go">
  <ArrowRightIcon class="size-4" />
</button>
```

**Disabled:** use the standard `disabled` HTML attribute.

See `presets.md` for the full preset catalog.

## Cards

Apply `card` to a container. Style with presets and pairings.

```html
<div class="card preset-filled-surface-100-900 p-4 space-y-3">
  <h3 class="h3">Card title</h3>
  <p class="opacity-60">Body text.</p>
</div>
```

**Hover effect:** add `card-hover` to the `card` element to lift it on hover.

**Outlined card:**

```html
<div class="card preset-outlined-surface-300-700 p-4">
  <p>Outlined card</p>
</div>
```

**Sections** are plain HTML: `<header>`, `<article>`, `<footer>`. There are no `Card.Header` / `Card.Footer` sub-components in Skeleton v4.

## Badges

Apply `badge` to a `<span>`.

```html
<span class="badge preset-tonal-success">Active</span>
<span class="badge preset-tonal-warning">Pending</span>
<span class="badge preset-tonal-error">Failed</span>
<span class="badge preset-filled-primary-500">New</span>
```

**Icon-only / overlapping:** use `badge-icon` and position it absolutely inside a `relative` parent.

## Inputs

Apply `input` to `<input>`, `<select>`, `<textarea>`.

```html
<label class="label">
  <span class="label-text">Email</span>
  <input class="input" type="email" placeholder="you@example.com" />
</label>
```

**File, date, color, range, search, tel, url, password, number, etc.** - same `input` class on the corresponding `<input type="…">`.

**Textarea:** add `rounded-container` (or other shape utilities) to control the radius.

```html
<textarea class="textarea rounded-container" rows="4" placeholder="…"></textarea>
```

**Select:**

```html
<label class="label">
  <span class="label-text">Country</span>
  <select class="select">
    <option value="1">Option 1</option>
    <option value="2">Option 2</option>
  </select>
</label>
```

**Checkbox / radio:** use the standard HTML elements. Skeleton does not ship styled checkbox/radio components - style the label container as needed, or use the `Switch` framework component for binary toggles.

## Labels

`label` wraps a form field. `label-text` styles the text portion.

```html
<label class="label">
  <span class="label-text">Field name</span>
  <input class="input" type="text" />
</label>
```

## Progress bar

Native `<progress>` with the `progress` class.

```html
<progress class="progress" value="50" max="100"></progress>
```

## Chips

Apply `chip` to a small badge-like container. Useful for tags or removable items.

```html
<button type="button" class="chip preset-filled">Chip</button>
<button type="button" class="chip preset-filled" disabled>Disabled chip</button>
```

## Anchor / link

Apply `anchor` to `<a>` for the themed link color.

```html
<a class="anchor" href="https://example.com">Link</a>
```

## Other utility classes

- `code` - inline code styling
- `kbd` - keyboard key styling
- `hr` - themed horizontal rule
- `h1` … `h6` - typography presets
- `opacity-60` - standard muted text (use any Tailwind opacity utility)

## Pattern: form layout

A standard form uses `<label class="label">` wrapping a labeled control inside a `<fieldset class="space-y-4">`:

```html
<form class="w-full max-w-md space-y-4 p-4">
  <fieldset class="space-y-4">
    <label class="label">
      <span class="label-text">Name</span>
      <input class="input" type="text" />
    </label>
    <label class="label">
      <span class="label-text">Email</span>
      <input class="input" type="email" />
    </label>
    <label class="label">
      <span class="label-text">Bio</span>
      <textarea class="textarea rounded-container" rows="4"></textarea>
    </label>
  </fieldset>
  <fieldset class="flex justify-end">
    <button type="submit" class="btn preset-filled-primary-500">Save</button>
  </fieldset>
</form>
```

## Agent Directives

- **(Strict) Do not import these from `@skeletonlabs/skeleton-svelte`.** There is no `<Button>`, `<Card>`, `<Input>`, `<Label>`, `<Badge>`, `<Select>`, or `<Checkbox>` export. If you see code using those, it is wrong.
- **(Strict) Do not invent sub-components.** There are no `Card.Header` / `Card.Title` / `Card.Footer` sub-components. Use plain `<header>` / `<footer>` inside the card.
- **(Freedom) Use standard HTML + Tailwind** for anything not covered by these utility classes.
