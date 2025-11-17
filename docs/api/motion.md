# Motion API Documentation

## Core Motion System

### `motion.ts`

The core motion system provides the foundation for all animations in Kogoro.

#### Constants

##### `MOTION_DURATIONS`

Predefined animation durations in milliseconds.

```typescript
export const MOTION_DURATIONS = {
  fast: 150,    // Quick transitions
  normal: 300,  // Standard animations
  slow: 500,    // Slow, deliberate animations
  instant: 0,   // No animation
} as const
```

**Usage:**
```typescript
import { getDuration, MOTION_DURATIONS } from '@/lib/motion'

const duration = getDuration('normal') // 300ms
```

##### `MOTION_EASING`

Predefined easing functions for smooth animations.

```typescript
export const MOTION_EASING = {
  ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',      // Standard ease
  easeIn: 'cubic-bezier(0.42, 0, 1, 1)',          // Ease in
  easeOut: 'cubic-bezier(0, 0, 0.58, 1)',         // Ease out
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',      // Ease in-out
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Bounce effect
  linear: 'linear',                                // Linear timing
} as const
```

**Usage:**
```typescript
import { getEasing } from '@/lib/motion'

const easing = getEasing('easeOut') // 'cubic-bezier(0, 0, 0.58, 1)'
```

##### `MOTION_DELAYS`

Predefined animation delays in milliseconds.

```typescript
export const MOTION_DELAYS = {
  none: 0,      // No delay
  short: 50,    // Short delay
  normal: 100,  // Normal delay
  long: 200,    // Long delay
} as const
```

#### Functions

##### `initializeMotion(): void`

Initializes the motion system and sets up reduced motion detection.

```typescript
import { initializeMotion } from '@/lib/motion'

// Call once at app startup
initializeMotion()
```

##### `getMotionState(): MotionState`

Returns the current motion state.

```typescript
interface MotionState {
  reducedMotion: boolean  // User prefers reduced motion
  enabled: boolean        // Motion is enabled
}

const state = getMotionState()
console.log(state.reducedMotion) // true/false
```

##### `isMotionEnabled(): boolean`

Checks if animations are currently enabled.

```typescript
import { isMotionEnabled } from '@/lib/motion'

if (isMotionEnabled()) {
  // Run animations
} else {
  // Skip animations
}
```

##### `getDuration(duration: keyof typeof MOTION_DURATIONS): number`

Gets animation duration respecting reduced motion preferences.

```typescript
const duration = getDuration('normal') // 300ms or 0 if reduced motion
```

##### `getEasing(easing: keyof typeof MOTION_EASING): string`

Gets easing function string.

```typescript
const easing = getEasing('easeInOut') // 'cubic-bezier(0.4, 0, 0.2, 1)'
```

##### `getDelay(delay: keyof typeof MOTION_DELAYS): number`

Gets animation delay respecting reduced motion preferences.

```typescript
const delay = getDelay('short') // 50ms or 0 if reduced motion
```

#### Animation Presets

##### `MOTION_PRESETS`

Predefined animation configurations for common UI patterns.

```typescript
export const MOTION_PRESETS = {
  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  },

  // Slide animations
  slideInRight: {
    initial: { opacity: 0, transform: 'translateX(100%)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(-100%)' },
    transition: { duration: 0.3, easing: 'cubic-bezier(0, 0, 0.58, 1)' },
  },

  // Scale animations
  scaleIn: {
    initial: { opacity: 0, transform: 'scale(0.9)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.9)' },
    transition: { duration: 0.15, easing: 'cubic-bezier(0, 0, 0.58, 1)' },
  },

  // ... more presets
} as const
```

**Usage:**
```typescript
import { MOTION_PRESETS } from '@/lib/motion'

const fadeAnimation = MOTION_PRESETS.fadeIn
```

#### Theme-Aware Variants

##### `THEME_MOTION_VARIANTS`

Theme-specific animation variants for light and dark modes.

```typescript
export const THEME_MOTION_VARIANTS = {
  light: {
    subtle: {
      initial: { opacity: 0.8 },
      animate: { opacity: 1 },
      transition: { duration: 0.3, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    },
    vibrant: {
      initial: { opacity: 0, filter: 'brightness(0.8)' },
      animate: { opacity: 1, filter: 'brightness(1)' },
      transition: { duration: 0.15, easing: 'cubic-bezier(0, 0, 0.58, 1)' },
    },
  },
  dark: {
    subtle: {
      initial: { opacity: 0.7 },
      animate: { opacity: 1 },
      transition: { duration: 0.3, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    },
    vibrant: {
      initial: { opacity: 0, filter: 'brightness(1.2)' },
      animate: { opacity: 1, filter: 'brightness(1)' },
      transition: { duration: 0.15, easing: 'cubic-bezier(0, 0, 0.58, 1)' },
    },
  },
} as const
```

#### Utility Functions

##### `createMotionPreset(preset: Partial<typeof MOTION_PRESETS.fadeIn>): typeof MOTION_PRESETS.fadeIn`

Creates a custom animation preset based on an existing one.

```typescript
const customFade = createMotionPreset({
  initial: { opacity: 0, transform: 'translateY(20px)' },
  animate: { opacity: 1, transform: 'translateY(0)' },
  transition: { duration: 0.4 },
})
```

##### `getThemeMotion(theme: 'light' | 'dark', variant: keyof typeof THEME_MOTION_VARIANTS.light)`

Gets theme-specific animation variant.

```typescript
const lightSubtle = getThemeMotion('light', 'subtle')
const darkVibrant = getThemeMotion('dark', 'vibrant')
```

#### CSS Utilities

##### `MOTION_CSS`

CSS-in-JS utilities for Tailwind integration.

```typescript
export const MOTION_CSS = {
  // Generate CSS transition string
  transition: (
    properties: string[],
    duration: keyof typeof MOTION_DURATIONS = 'normal',
    easing: keyof typeof MOTION_EASING = 'easeInOut'
  ): string => {
    const durationMs = getDuration(duration)
    const easingFn = getEasing(easing)
    return properties
      .map((prop) => `${prop} ${durationMs}ms ${easingFn}`)
      .join(', ')
  },

  // Generate CSS animation string
  animation: (
    name: string,
    duration: keyof typeof MOTION_DURATIONS = 'normal',
    easing: keyof typeof MOTION_EASING = 'easeInOut',
    delay: keyof typeof MOTION_DELAYS = 'none',
    count: number | 'infinite' = 1,
    direction: 'normal' | 'reverse' | 'alternate' = 'normal'
  ): string => {
    const durationMs = getDuration(duration)
    const easingFn = getEasing(easing)
    const delayMs = getDelay(delay)
    return `${name} ${durationMs}ms ${easingFn} ${delayMs}ms ${count} ${direction}`
  },

  // Generate CSS keyframes
  keyframes: (
    frames: Record<string, Record<string, string | number>>
  ): string => {
    const keyframeRules = Object.entries(frames)
      .map(([offset, properties]) => {
        const props = Object.entries(properties)
          .map(([prop, value]) => `${prop}: ${value}`)
          .join('; ')
        return `${offset} { ${props} }`
      })
      .join(' ')
    return `@keyframes animation { ${keyframeRules} }`
  },
} as const
```

**Usage:**
```typescript
// Generate transition string
const transition = MOTION_CSS.transition(
  ['opacity', 'transform'],
  'normal',
  'easeOut'
)
// "opacity 300ms cubic-bezier(0, 0, 0.58, 1), transform 300ms cubic-bezier(0, 0, 0.58, 1)"

// Generate animation string
const animation = MOTION_CSS.animation(
  'fadeIn',
  'fast',
  'easeInOut',
  'none',
  1,
  'normal'
)
// "fadeIn 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms 1 normal"
```

## Animation Variants Library

### `motion-variants.ts`

Comprehensive animation library with 200+ variants for all UI patterns.

#### Core Variants

##### Entry/Exit Animations

```typescript
export const MOTION_VARIANTS = {
  fade: {
    fadeIn: { /* fade in animation */ },
    fadeInScale: { /* fade and scale in */ },
    fadeOutScale: { /* fade and scale out */ },
    crossfade: { /* crossfade transition */ },
  },
  
  slide: {
    slideInRight: { /* slide from right */ },
    slideInLeft: { /* slide from left */ },
    slideInUp: { /* slide from top */ },
    slideInDown: { /* slide from bottom */ },
    slideFade: { /* slide with fade */ },
  },
  
  scale: {
    scaleIn: { /* scale in animation */ },
    scaleOut: { /* scale out animation */ },
    bounceScale: { /* bounce scale effect */ },
    gentleScale: { /* gentle scale effect */ },
  },
  // ... more variants
}
```

##### UI Component Variants

```typescript
export const MOTION_VARIANTS = {
  button: {
    primary: { /* primary button animations */ },
    secondary: { /* secondary button animations */ },
    ghost: { /* ghost button animations */ },
  },
  
  card: {
    standard: { /* standard card animations */ },
    compact: { /* compact card animations */ },
    featured: { /* featured card animations */ },
  },
  
  modal: {
    overlay: { /* modal overlay animations */ },
    content: { /* modal content animations */ },
    fullscreen: { /* fullscreen modal animations */ },
    slideUp: { /* slide up modal animations */ },
  },
  // ... more variants
}
```

#### Utility Functions

##### `getAccessibleVariant(variant: AnimationVariant, fallback: AnimationVariant): AnimationVariant`

Returns an accessible variant that respects reduced motion preferences.

```typescript
import { getAccessibleVariant, MOTION_VARIANTS } from '@/lib/motion-variants'

const safeAnimation = getAccessibleVariant(
  MOTION_VARIANTS.slide.slideInUp,
  MOTION_VARIANTS.reducedMotion.opacity
)
```

##### `createStaggeredVariant(variant: AnimationVariant, delay: number): AnimationVariant`

Creates a staggered variant with custom delay.

```typescript
const staggeredItem = createStaggeredVariant(
  MOTION_VARIANTS.list.staggered,
  100 // 100ms delay
)
```

##### `getThemeVariant(theme: 'light' | 'dark', variant: string): AnimationVariant`

Gets theme-specific variant.

```typescript
const darkVariant = getThemeVariant('dark', 'subtle')
```

## Lazy Loading System

### `lazy-motion.ts`

Lazy loading system for optimal bundle size and performance.

#### Types

```typescript
export interface LazyMotionConfig {
  features: MotionFeature[]
  preloadStrategy: 'none' | 'hover' | 'visible' | 'idle'
  timeout?: number
  fallback?: () => void
}

export type MotionFeature = 
  | 'animations'
  | 'variants'
  | 'transitions'
  | 'performance'

export interface LazyMotionState {
  isLoading: boolean
  isLoaded: boolean
  error: Error | null
  loadedFeatures: Set<MotionFeature>
  progress: number
}
```

#### Hook

##### `useLazyMotion(config: LazyMotionConfig)`

Main hook for lazy loading motion features.

```typescript
import { useLazyMotion } from '@/lib/lazy-motion'

const {
  state,           // Loading state
  loadedModules,   // Loaded modules
  preload,         // Preload function
  loadOnDemand,    // Load specific feature
  isFeatureLoaded, // Check if feature is loaded
  getFeature,      // Get loaded feature
  getTotalSize,    // Get total loaded size
} = useLazyMotion({
  features: ['animations', 'variants'],
  preloadStrategy: 'idle',
  timeout: 2000,
})
```

**Preload Strategies:**

- `none`: Only load when explicitly requested
- `hover`: Load on first user interaction
- `visible`: Load when page becomes visible
- `idle`: Load when browser is idle

#### Bundle Analysis

##### `analyzeBundleOptimization(features: MotionFeature[]): BundleOptimization`

Analyzes bundle optimization opportunities.

```typescript
import { analyzeBundleOptimization } from '@/lib/lazy-motion'

const analysis = analyzeBundleOptimization(['animations', 'variants'])
console.log(analysis.savingsPercentage) // e.g., 65.5
```

## Performance Monitoring

### `performance-monitor.ts`

Real-time performance monitoring for animations.

#### Types

```typescript
export interface PerformanceMetrics {
  frameRate: number
  frameDrops: number
  animationDuration: number
  animationCount: number
  memoryUsage: number
  memoryLimit: number
  memoryPressure: 'low' | 'medium' | 'high'
  bundleSize: number
  gzippedSize: number
  chunkCount: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
}
```

#### Hook

##### `usePerformanceMonitor(config?: Partial<PerformanceConfig>)`

Hook for performance monitoring.

```typescript
import { usePerformanceMonitor } from '@/lib/performance-monitor'

const {
  metrics,         // Current metrics
  isMonitoring,    // Monitoring status
  startAnimation,  // Start animation measurement
  measureLayout,   // Measure layout performance
  getEntries,      // Get performance entries
} = usePerformanceMonitor({
  enableMonitoring: true,
  sampleRate: 0.1, // Sample 10% of animations
  thresholds: {
    frameRate: 55, // Alert below 55fps
    memoryUsage: 50 * 1024 * 1024, // 50MB
    animationDuration: 1000, // 1 second
  }
})
```

#### Usage Examples

##### Animation Performance Measurement

```typescript
const { startAnimation } = usePerformanceMonitor()

// Measure animation performance
const endAnimation = startAnimation('card-hover')
// ... run animation ...
endAnimation() // Records duration and performance
```

##### Layout Performance Measurement

```typescript
const { measureLayout } = usePerformanceMonitor()

// Measure layout performance
measureLayout('grid-reflow', () => {
  // Layout changes
  setGridLayout(newLayout)
})
```

##### Performance Metrics

```typescript
const { metrics } = usePerformanceMonitor()

// Check current performance
const currentMetrics = metrics()
console.log(`Frame rate: ${currentMetrics.frameRate}fps`)
console.log(`Memory usage: ${currentMetrics.memoryUsage / 1024 / 1024}MB`)
console.log(`Memory pressure: ${currentMetrics.memoryPressure}`)
```

## React Hooks

### `useMotionAnimations.ts`

React hooks for motion features.

#### Hooks

##### `useThemeTransition()`

Hook for theme transition animations.

```typescript
import { useThemeTransition } from '@/hooks/useMotionAnimations'

const {
  isTransitioning,
  startTransition,
  transitionClasses,
  transitionStyles,
} = useThemeTransition()

// Start theme transition
startTransition('light', 'dark')
```

##### `useReducedMotion()`

Hook for reduced motion detection.

```typescript
import { useReducedMotion } from '@/hooks/useMotionAnimations'

const {
  prefersReduced,
  isEnabled,
  watchPreference,
} = useReducedMotion()

if (prefersReduced()) {
  // Use reduced motion
}
```

##### `useScrollAnimation(options?: ScrollAnimationOptions)`

Hook for scroll-triggered animations.

```typescript
import { useScrollAnimation } from '@/hooks/useMotionAnimations'

const {
  isVisible,
  animationClasses,
  animationStyles,
  elementRef,
} = useScrollAnimation({
  threshold: 0.1,
  rootMargin: '50px',
  animation: 'fade-in-up',
})

// Use in component
<div ref={elementRef} class={animationClasses()}>
  Content
</div>
```

##### `useModalAnimation()`

Hook for modal animations.

```typescript
import { useModalAnimation } from '@/hooks/useMotionAnimations'

const {
  isOpen,
  openModal,
  closeModal,
  modalProps,
  overlayProps,
} = useModalAnimation()

// Use in modal
<div {...modalProps()}>
  Modal content
</div>
```

## Component API

### Motion Components

#### MotionButton

Animated button component with accessibility support.

```typescript
interface MotionButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  children: JSX.Element
}
```

**Usage:**
```typescript
import { MotionButton } from '@/components/ui/MotionButton'

<MotionButton
  variant="primary"
  size="md"
  onClick={handleClick}
>
  Click me
</MotionButton>
```

#### MotionCard

Animated card component with hover effects.

```typescript
interface MotionCardProps {
  variant?: 'standard' | 'compact' | 'featured'
  clickable?: boolean
  loading?: boolean
  onClick?: () => void
  children: JSX.Element
  class?: string
}
```

**Usage:**
```typescript
import { MotionCard } from '@/components/ui/MotionCard'

<MotionCard
  variant="featured"
  clickable
  onClick={handleCardClick}
>
  Card content
</MotionCard>
```

#### MotionGrid

Animated grid layout component.

```typescript
interface MotionGridProps {
  columns?: number
  gap?: string
  stagger?: boolean
  staggerDelay?: number
  children: JSX.Element[]
}
```

**Usage:**
```typescript
import { MotionGrid } from '@/components/ui/MotionGrid'

<MotionGrid
  columns={3}
  gap="1rem"
  stagger
  staggerDelay={100}
>
  {items.map(item => (
    <div key={item.id}>{item.content}</div>
  ))}
</MotionGrid>
```

## TypeScript Types

### Core Types

```typescript
// Animation variant type
export interface AnimationVariant {
  initial?: Record<string, any>
  animate?: Record<string, any>
  exit?: Record<string, any>
  transition?: AnimationTransition
}

// Animation transition type
export interface AnimationTransition {
  duration?: number
  delay?: number
  easing?: string
  repeat?: number | 'infinite'
  reverse?: boolean
}

// Motion preset type
export interface MotionPreset {
  [key: string]: AnimationVariant
}

// Theme motion variant type
export interface ThemeMotionVariant {
  light: Record<string, AnimationVariant>
  dark: Record<string, AnimationVariant>
}
```

### Utility Types

```typescript
// Motion duration type
export type MotionDuration = keyof typeof MOTION_DURATIONS

// Motion easing type
export type MotionEasing = keyof typeof MOTION_EASING

// Motion delay type
export type MotionDelay = keyof typeof MOTION_DELAYS

// Motion feature type
export type MotionFeature = 
  | 'animations'
  | 'variants'
  | 'transitions'
  | 'performance'
```

---

*API documentation last updated: November 17, 2025*