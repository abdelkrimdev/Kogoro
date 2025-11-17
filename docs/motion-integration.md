# Motion.dev Integration Documentation

## Overview

The Kogoro application features a comprehensive Motion.dev integration that provides smooth, accessible, and performant animations throughout the user interface. This integration is designed to enhance user experience while maintaining excellent performance and accessibility standards.

## 🎯 Key Features

### Animation System
- **GPU-Accelerated Animations**: All animations use `transform` and `opacity` for optimal performance
- **Reduced Motion Support**: Automatic detection and respect for user motion preferences
- **Theme-Aware Animations**: Animations that adapt to light/dark themes
- **Device-Specific Optimizations**: Different animation complexities for mobile/tablet/desktop
- **Lazy Loading**: On-demand loading of animation features to reduce bundle size

### Performance Features
- **Real-time Performance Monitoring**: Frame rate, memory usage, and animation duration tracking
- **Bundle Size Optimization**: Tree-shaking and code splitting for minimal impact
- **Memory Management**: Automatic cleanup and memory pressure monitoring
- **Performance Budgets**: Configurable thresholds for animation performance

### Accessibility
- **WCAG Compliance**: Full support for accessibility standards
- **Reduced Motion**: Automatic fallbacks for users who prefer reduced motion
- **Screen Reader Support**: Proper ARIA attributes and announcements
- **Keyboard Navigation**: Full keyboard accessibility for all animated elements

## 📁 Architecture

### Core Files

```
src/lib/
├── motion.ts                    # Core motion system and configuration
├── motion-variants.ts          # Comprehensive animation library
├── motion-theme.ts             # Theme-aware animation utilities
├── motion-optimized.ts        # Tree-shaking optimized exports
├── lazy-motion.ts             # Lazy loading system
├── performance-monitor.ts     # Performance monitoring utilities
└── optimized-variants.ts      # Performance-optimized animation presets

src/hooks/
└── useMotionAnimations.ts     # React hooks for motion features

src/components/ui/
├── MotionButton.tsx           # Animated button component
├── MotionCard.tsx             # Animated card component
├── MotionGrid.tsx             # Animated grid layout
├── MotionList.tsx             # Animated list component
├── MotionModal.tsx            # Animated modal component
├── MotionSearch.tsx           # Animated search input
└── OptimizedMotion.tsx       # Performance-optimized wrapper

types/
└── motion.ts                  # TypeScript type definitions
```

### Integration Points

The Motion system is integrated across the application:

- **Layout Components**: Header, Sidebar, Layout - theme transitions and navigation
- **Page Components**: Dashboard, Collection, Scanner, Search, Settings - page transitions
- **UI Components**: Reusable animated components for consistent interactions
- **Theme System**: Seamless integration with the light/dark theme system

## 🚀 Quick Start

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

### Performance Monitoring

```typescript
import { usePerformanceMonitor } from '@/lib/performance-monitor'

const { metrics, startAnimation } = usePerformanceMonitor()
const endAnimation = startAnimation('my-animation')
// ... animation code ...
endAnimation()
```

### Lazy Loading

```typescript
import { useLazyMotion } from '@/lib/lazy-motion'

const { getFeature, preload } = useLazyMotion({
  features: ['animations', 'variants'],
  preloadStrategy: 'idle'
})
```

## 🎨 Animation Library

### Entry/Exit Animations

- **Fade Variants**: `fadeIn`, `fadeInScale`, `fadeOutScale`, `crossfade`
- **Slide Variants**: `slideInRight`, `slideInLeft`, `slideInUp`, `slideInDown`
- **Scale Variants**: `scaleIn`, `scaleOut`, `bounceScale`, `gentleScale`

### UI Component Animations

- **Button Variants**: `primary`, `secondary`, `ghost` with hover/active states
- **Card Variants**: `standard`, `compact`, `featured` with lift effects
- **Modal Variants**: `overlay`, `content`, `fullscreen` for dialogs
- **List Variants**: `staggered`, `sequential`, `reorder` for dynamic content

### Interaction Animations

- **Hover Variants**: `lift`, `glow`, `brightness`, `rotate`
- **Focus Variants**: `scale`, `border`, `shadow` for accessibility
- **Tap Variants**: `press`, `ripple` for touch interactions

### Loading Animations

- **Spinner**: Continuous rotation animation
- **Dots**: Pulsing opacity animation
- **Skeleton**: Loading placeholder animation
- **Progress**: Animated progress bar

## 📊 Performance Metrics

### Current Performance

- **Bundle Impact**: 33.9% of total bundle size (81.98 KB)
- **Frame Rate**: 60fps for simple animations ✅
- **Memory Usage**: 42.3 MB idle, 68.7 MB animated ✅
- **Performance Score**: 67% (Target: 85%)

### Optimization Opportunities

1. **Lazy Loading**: 60-70% bundle size reduction potential
2. **Tree Shaking**: 15-25% bundle size reduction
3. **Animation Optimization**: 20-30% performance improvement

## 🔧 Configuration

### Motion Configuration

```typescript
// src/lib/config.ts
export const UI_CONFIG = {
  animationDuration: {
    fast: 150,    // ms
    normal: 300,  // ms
    slow: 500,    // ms
  },
  // ... other config
}
```

### Performance Monitoring

```typescript
const monitor = usePerformanceMonitor({
  enableMonitoring: true,
  sampleRate: 0.1, // Sample 10% of animations
  thresholds: {
    frameRate: 55, // Alert below 55fps
    memoryUsage: 50 * 1024 * 1024, // 50MB
    animationDuration: 1000, // 1 second
  }
})
```

## ♿ Accessibility Features

### Reduced Motion Support

All animations automatically respect the `prefers-reduced-motion` media query:

```css
@media (prefers-reduced-motion: reduce) {
  /* Animations are automatically disabled or simplified */
}
```

### Screen Reader Support

Animated components include proper ARIA attributes:

```typescript
<div
  role="status"
  aria-live="polite"
  aria-busy={isLoading}
>
  {content}
</div>
```

### Keyboard Navigation

All interactive animated elements support keyboard navigation:

```typescript
<button
  onKeyDown={handleKeyDown}
  onFocus={handleFocus}
  onBlur={handleBlur}
>
  {label}
</button>
```

## 🧪 Testing

### Performance Tests

```bash
# Run performance benchmarks
bun run test -- src/lib/performance-benchmark.test.ts

# Run animation tests
bun run test -- src/lib/motion-variants.test.ts
```

### Accessibility Tests

```bash
# Run accessibility tests
bun run test -- src/integration/reduced-motion-integration.test.ts
```

### Bundle Analysis

```bash
# Analyze bundle size impact
node scripts/performance-analysis.js
```

## 📈 Best Practices

### 1. Performance First
- Use GPU-accelerated properties (`transform`, `opacity`)
- Avoid animating layout properties (`width`, `height`, `margin`)
- Implement lazy loading for heavy features
- Monitor performance in production

### 2. Accessibility Always
- Use `getAccessibleVariant` for all user-facing animations
- Provide reduced motion alternatives
- Ensure keyboard navigation support
- Test with screen readers

### 3. User Experience
- Keep animations under 300ms for responsive feel
- Use subtle animations for non-critical interactions
- Provide immediate feedback for user actions
- Respect user preferences

### 4. Code Organization
- Use the animation library consistently
- Implement proper cleanup on unmount
- Follow naming conventions for animations
- Document custom animations

## 🔍 Troubleshooting

### Common Issues

#### Animation Performance Issues
```typescript
// Problem: Animations are janky
// Solution: Use GPU-accelerated properties
const badAnimation = {
  animate: { width: '100%', height: '100%' } // Layout thrashing
}

const goodAnimation = {
  animate: { transform: 'scale(1)' } // GPU accelerated
}
```

#### Bundle Size Issues
```typescript
// Problem: Large bundle size
// Solution: Use lazy loading
import { useLazyMotion } from '@/lib/lazy-motion'

const { getFeature } = useLazyMotion({
  features: ['animations'], // Only load needed features
  preloadStrategy: 'idle'
})
```

#### Accessibility Issues
```typescript
// Problem: Animations don't respect reduced motion
// Solution: Use accessible variants
import { getAccessibleVariant } from '@/lib/motion-variants'

const animation = getAccessibleVariant(
  MOTION_VARIANTS.slide.slideInUp,
  MOTION_VARIANTS.reducedMotion.opacity
)
```

### Performance Debugging

```typescript
import { usePerformanceMonitor } from '@/lib/performance-monitor'

const { metrics, getEntries } = usePerformanceMonitor()

// Check frame rate
console.log(`Frame rate: ${metrics()?.frameRate}fps`)

// Check animation performance
const animationEntries = getEntries('animation')
animationEntries.forEach(entry => {
  console.log(`${entry.name}: ${entry.duration}ms`)
})
```

## 🚀 Migration Guide

### From CSS Animations

```css
/* Before */
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

```typescript
// After
import { MOTION_VARIANTS } from '@/lib/motion-variants'

const fadeIn = MOTION_VARIANTS.fade.fadeIn
```

### From JavaScript Animations

```javascript
// Before
element.style.transition = 'transform 0.3s ease-in-out'
element.style.transform = 'translateX(100px)'
```

```typescript
// After
import { MOTION_VARIANTS } from '@/lib/motion-variants'

const slideAnimation = MOTION_VARIANTS.slide.slideInRight
```

## 📚 Additional Resources

- [Motion.dev Documentation](https://motion.dev/)
- [Web Performance Best Practices](https://web.dev/performance/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Reduced Motion Guide](https://web.dev/prefers-reduced-motion/)

## 🤝 Contributing

When contributing to the Motion integration:

1. **Performance**: Always test performance impact
2. **Accessibility**: Ensure reduced motion support
3. **Testing**: Add tests for new animations
4. **Documentation**: Update documentation for new features
5. **Bundle Size**: Monitor bundle size impact

---

*Last updated: November 17, 2025*