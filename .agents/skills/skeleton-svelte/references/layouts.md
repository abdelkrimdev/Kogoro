# Layout Patterns

Skeleton does not provide layout components - layouts are built from **semantic HTML + Tailwind utilities**. Skeleton's contribution is the color/preset system applied to that HTML.

## Core principles

### 1. Prefer semantic HTML

| Element | Role |
| --- | --- |
| `<header>` | Introductory content, top nav |
| `<nav>` | Navigation links |
| `<main>` | Dominant page content (only one per page) |
| `<article>` | Self-contained composition (blog post, card) |
| `<section>` | Thematic grouping, with a heading |
| `<aside>` | Tangential content, sidebars |
| `<footer>` | Closing information |

Semantic elements give you keyboard navigation, screen reader landmarks, and SEO for free.

### 2. Make `<body>` the scroller

Let the body scroll instead of inner containers. This preserves mobile pull-to-refresh, browser auto-hide UI, print styles, and framework-specific behavior.

```css
/* global CSS */
html,
body {
  height: 100%;
}
body {
  overflow-y: auto;
}
```

Avoid `overflow-y-auto` on `<main>` or `<aside>` unless you have a specific reason (sticky toolbars inside scrolling panes).

### 3. CSS Grid for page layout, Flexbox for components

- Use **grid** for major page regions (header / sidebar / main).
- Use **flex** inside regions (toolbar with logo + nav + actions).

## Grid

```html
<!-- Basic 3-column grid -->
<div class="grid grid-cols-3 gap-4">
  <div>One</div>
  <div>Two</div>
  <div>Three</div>
</div>

<!-- Responsive columns -->
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  <!-- … -->
</div>

<!-- 12-column with spans -->
<div class="grid grid-cols-12 gap-4">
  <div class="col-span-8">Main</div>
  <div class="col-span-4">Sidebar</div>
</div>

<!-- Fixed sidebar + flexible main -->
<div class="grid h-full grid-cols-1 md:grid-cols-[250px_1fr]">
  <aside class="bg-surface-100-900">…</aside>
  <main>…</main>
</div>

<!-- Constrained middle column with side rails -->
<div class="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,900px)_250px]">
  <aside>…</aside>
  <main>…</main>
  <aside>…</aside>
</div>
```

## Flexbox

```html
<!-- Row with space between -->
<div class="flex items-center justify-between">
  <span>Left</span>
  <span>Right</span>
</div>

<!-- Column with gap -->
<div class="flex flex-col gap-4">
  <div>…</div>
  <div>…</div>
</div>

<!-- Centered -->
<div class="flex h-screen items-center justify-center">
  <div>Centered</div>
</div>
```

**Common alignment utilities:**

- `justify-start|center|end|between|around|evenly`
- `items-start|center|end|stretch|baseline`
- `gap-{n}`, `gap-x-{n}`, `gap-y-{n}`

## Responsive design

Mobile-first. Define the base style, then add breakpoints:

| Prefix | Min width |
| --- | --- |
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |
| `2xl:` | 1536px |

```html
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  <!-- … -->
</div>
```

## Common page layouts

### Single column (blog, docs)

```html
<div class="flex h-full flex-col">
  <header class="sticky top-0 z-10 border-b border-surface-300-700 bg-surface-50-950">
    <!-- Header -->
  </header>

  <main class="flex-1 overflow-y-auto">
    <div class="container mx-auto max-w-4xl px-4 py-8">
      <!-- Content -->
    </div>
  </main>

  <footer class="border-t border-surface-300-700 bg-surface-100-900">
    <!-- Footer -->
  </footer>
</div>
```

### Two-column (sidebar + main)

```html
<div class="grid h-full grid-cols-1 md:grid-cols-[250px_1fr]">
  <aside class="sticky top-0 h-screen overflow-y-auto bg-surface-100-900">
    <nav class="p-4">…</nav>
  </aside>

  <main class="overflow-y-auto">
    <div class="container mx-auto px-4 py-8">…</div>
  </main>
</div>
```

### Three-column (two sidebars + main)

```html
<div class="grid h-full grid-cols-1 gap-4 lg:grid-cols-[250px_minmax(0,1fr)_250px]">
  <aside class="hidden bg-surface-100-900 lg:block">Left</aside>
  <main>Main</main>
  <aside class="hidden bg-surface-100-900 lg:block">Right</aside>
</div>
```

### Dashboard

```html
<div class="grid h-full grid-rows-[auto_1fr]">
  <header class="sticky top-0 z-20 border-b border-surface-300-700 bg-surface-50-950">…</header>

  <div class="grid grid-cols-1 md:grid-cols-[200px_1fr]">
    <aside class="overflow-y-auto bg-surface-100-900">…</aside>

    <main class="overflow-y-auto p-6">
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <!-- Cards -->
      </div>
    </main>
  </div>
</div>
```

For the actual top nav use the `AppBar` framework component; for the actual sidebar use `Navigation`.

## Sticky elements

### Single sticky header

```html
<header class="sticky top-0 z-10 bg-surface-50-950">
  <nav class="container mx-auto px-4 py-3">…</nav>
</header>
```

### Stacked sticky elements

When multiple sticky elements stack, use a CSS variable for the offset:

```svelte
<script>
  const headerHeight = '64px';
  const subnavHeight = '48px';
</script>

<header class="sticky top-0 z-20 h-16 bg-surface-50-950">…</header>
<nav class="sticky z-10 bg-surface-100-900" style="top: {headerHeight}">…</nav>
<aside class="sticky z-5 bg-surface-50-950" style="top: calc({headerHeight} + {subnavHeight})">…</aside>
```

## Container utilities

```html
<!-- Centered, max-width by Tailwind config -->
<div class="container mx-auto px-4">…</div>

<!-- Explicit max-width -->
<div class="mx-auto max-w-4xl px-4">…</div>

<!-- Responsive padding -->
<div class="container mx-auto px-4 sm:px-6 lg:px-8">…</div>
```

## Layering and z-index

Convention for sticky/fixed/overlay elements:

| Layer | z-index |
| --- | --- |
| Base content | 0 |
| Sticky toolbars | 10 |
| Dropdown menus / popovers | 20 |
| Modal backdrops | 40 |
| Modal content | 50 |
| Toasts | 60 |

Skeleton framework components (Dialog, Popover, Tooltip) handle their own z-index, but you may need to override with `class="z-20!"` etc. on the `Positioner` when stacking floating UI over other sticky elements.

## Agent Directives

- **(Strict) Start mobile-first.** Default styles target small screens; add `md:` / `lg:` for larger.
- **(Strict) Use the body as the scroller.** Reach for inner `overflow-auto` only when you need independent panes.
- **(Strict) Use semantic elements.** Reach for `<div>` only when no semantic element fits.
- **(Strict) Match the AppBar and Navigation framework components** for the actual top nav / sidebar where the user expects a complete shell.
- **(Freedom) Arbitrary Layouts:** You are free to use standard Tailwind CSS Grid and Flexbox utilities to achieve any layout requirement not explicitly covered here.
