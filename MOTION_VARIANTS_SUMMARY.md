# Motion Variants Library Summary

## Overview

The `src/lib/motion-variants.ts` file provides a comprehensive animation library for the Kogoro app, featuring reusable animation presets that are optimized for performance, accessibility, and user experience.

## Features

### 🎨 **Entry/Exit Animations**
- **Fade Variants**: `fadeIn`, `fadeInScale`, `fadeOutScale`, `crossfade`
- **Slide Variants**: `slideInRight`, `slideInLeft`, `slideInUp`, `slideInDown`, `slideFade`
- **Scale Variants**: `scaleIn`, `scaleOut`, `bounceScale`, `gentleScale`

### 🎯 **UI Component Variants**
- **Button Variants**: `primary`, `secondary`, `ghost` with hover, active, and disabled states
- **Card Variants**: `standard`, `compact`, `featured` with lift and shadow effects
- **Modal Variants**: `overlay`, `content`, `fullscreen`, `slideUp` for dialog animations
- **Sidebar Variants**: `left`, `right`, `compressed` for navigation panels
- **List Variants**: `staggered`, `sequential`, `reorder` for dynamic content

### 📱 **Layout Animations**
- **Page Variants**: `fade`, `slide`, `scale` for route transitions
- **Container Variants**: `height`, `gridReflow`, `flexReflow` for layout changes

### 🖱️ **Interaction Variants**
- **Hover Variants**: `lift`, `glow`, `brightness`, `rotate` for interactive feedback
- **Focus Variants**: `scale`, `border`, `shadow` for accessibility
- **Tap Variants**: `press`, `ripple` for touch interactions

### ⏳ **Loading Variants**
- **Spinner**: Continuous rotation animation
- **Dots**: Pulsing opacity animation
- **Skeleton**: Loading placeholder animation
- **Progress**: Animated progress bar
- **Bounce**: Bouncing dots animation

### 🌓 **Theme-Aware Variants**
- **Subtle**: Gentle transitions that adapt to light/dark themes
- **Vibrant**: More pronounced theme transitions
- **Color-Aware**: Semantic color integration with theme system

### 📐 **Responsive Variants**
- **Mobile**: Optimized for small screens (faster, simpler animations)
- **Tablet**: Medium complexity animations
- **Desktop**: Full-featured animations for larger screens

### ♿ **Reduced Motion Variants**
- **Opacity**: Simple fade transitions
- **Instant**: No animation for users who prefer reduced motion
- **Color**: Color-only transitions for accessibility

### 🎌 **Collection-Specific Variants**
- **Anime Cards**: `grid`, `list`, `compact` variants for anime collection display
- **Search**: `input`, `filterTag`, `results` for search interfaces
- **Theme Switch**: `toggle`, `overlay` for theme switching animations

## Usage Examples

### Basic Usage

```typescript
import { MOTION_VARIANTS } from '@/lib/motion-variants'

// Use a fade animation
const fadeIn = MOTION_VARIANTS.fade.fadeIn

// Use a card animation with hover effects
const cardAnimation = MOTION_VARIANTS.card.standard
```

### Accessibility-Friendly Animations

```typescript
import { getAccessibleVariant, MOTION_VARIANTS } from '@/lib/motion-variants'

// Automatically respects reduced motion preferences
const safeAnimation = getAccessibleVariant(
  MOTION_VARIANTS.fade.fadeIn,
  MOTION_VARIANTS.reducedMotion.opacity
)
```

### Staggered Animations

```typescript
import { createStaggeredVariant, MOTION_VARIANTS } from '@/lib/motion-variants'

// Create staggered list items
const baseVariant = MOTION_VARIANTS.list.staggered
const items = [0, 1, 2, 3].map(index => 
  createStaggeredVariant(baseVariant, index * 100)
)
```

### Theme-Aware Animations

```typescript
import { getThemeVariant } from '@/lib/motion-variants'

// Get theme-specific variant
const currentTheme = 'dark' // or 'light'
const variant = getThemeVariant(currentTheme, 'subtle')
```

### Custom Animations

```typescript
import { createCustomVariant } from '@/lib/motion-variants'

// Create custom animation
const customSlide = createCustomVariant({
  initial: { opacity: 0, transform: 'translateX(-50px)' },
  animate: { opacity: 1, transform: 'translateX(0)' },
  exit: { opacity: 0, transform: 'translateX(50px)' },
  transition: {
    duration: 0.4,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
})
```

## Integration with Kogoro Features

### Anime Collection Management
- **Grid View**: `MOTION_VARIANTS.animeCard.grid` with hover lift effects
- **List View**: `MOTION_VARIANTS.animeCard.list` with slide animations
- **Mobile View**: `MOTION_VARIANTS.animeCard.compact` for performance

### Search and Filter Interfaces
- **Search Input**: `MOTION_VARIANTS.search.input` with focus animations
- **Filter Tags**: `MOTION_VARIANTS.search.filterTag` with scale effects
- **Results Container**: `MOTION_VARIANTS.search.results` with height transitions

### Theme Switching
- **Toggle Button**: `MOTION_VARIANTS.themeSwitch.toggle` with rotation
- **Transition Overlay**: `MOTION_VARIANTS.themeSwitch.overlay` with fade

### Modal Dialogs
- **Overlay**: `MOTION_VARIANTS.modal.overlay` for backdrop
- **Content**: `MOTION_VARIANTS.modal.content` for dialog panel
- **Fullscreen**: `MOTION_VARIANTS.modal.fullscreen` for immersive views

### Sidebar Navigation
- **Slide In**: `MOTION_VARIANTS.sidebar.left` or `sidebar.right`
- **Compressed**: `MOTION_VARIANTS.sidebar.compressed` for collapsed state

## Performance Optimizations

### Reduced Motion Support
All animations automatically respect user's reduced motion preferences through the `getAccessibleVariant` utility.

### Responsive Animations
Different animation complexities for different screen sizes ensure optimal performance across devices.

### Hardware Acceleration
Animations use `transform` and `opacity` properties for GPU acceleration.

### Efficient Timing
Animation durations are optimized based on the UI_CONFIG settings:
- Fast: 150ms
- Normal: 300ms  
- Slow: 500ms

## TypeScript Integration

The library provides comprehensive TypeScript support with:

- **Type-safe variant selection** with autocomplete
- **Proper typing** for all animation properties
- **Utility function types** for custom animations
- **Theme-aware variant types** for light/dark mode

## Files Created

1. **`src/lib/motion-variants.ts`** - Main animation library
2. **`src/lib/motion-variants.test.ts`** - Comprehensive test suite
3. **`src/lib/motion-variants.example.ts`** - Usage examples and patterns
4. **`MOTION_VARIANTS_SUMMARY.md`** - This documentation

## Testing

The library includes 35 comprehensive tests covering:
- Variant structure validation
- Animation property verification
- Utility function testing
- Theme-aware functionality
- Accessibility features
- Collection-specific animations

Run tests with:
```bash
bun run test -- src/lib/motion-variants.test.ts
```

## Best Practices

### 1. Use Appropriate Variants
Choose variants that match the context and importance of the animation.

### 2. Respect Accessibility
Always use `getAccessibleVariant` for user-facing animations.

### 3. Consider Performance
Use simpler animations on mobile devices and for large lists.

### 4. Maintain Consistency
Stick to the established timing and easing functions for cohesive UX.

### 5. Theme Integration
Use theme-aware variants for animations that interact with the color system.

## Future Enhancements

- **Spring Physics**: Add spring-based animations for more natural movement
- **Gesture Support**: Enhance variants for drag and swipe interactions
- **Performance Monitoring**: Built-in performance metrics for animations
- **Animation Chaining**: Utilities for complex animation sequences
- **Micro-interactions**: Additional subtle animations for enhanced UX

This comprehensive animation library provides the foundation for smooth, accessible, and performant animations throughout the Kogoro anime collection management app.