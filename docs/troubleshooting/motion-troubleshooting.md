# Motion Integration Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting steps for common issues with the Motion.dev integration in Kogoro. It covers performance problems, accessibility issues, bundle size concerns, and debugging techniques.

## 🚨 Common Issues

### Animation Performance Issues

#### Problem: Animations are janky or laggy

**Symptoms:**
- Frame rate drops below 30fps
- Animations feel sluggish
- UI becomes unresponsive during animations

**Causes:**
- Animating layout properties (width, height, margin)
- Too many concurrent animations
- Complex CSS calculations
- Memory pressure

**Solutions:**

1. **Use GPU-Accelerated Properties**
```typescript
// ❌ Bad - Causes layout thrashing
const badAnimation = {
  animate: { 
    width: '100%', 
    height: '200px',
    marginLeft: '20px'
  }
}

// ✅ Good - GPU accelerated
const goodAnimation = {
  animate: { 
    transform: 'translateX(20px) scale(1.1)',
    opacity: 1
  }
}
```

2. **Reduce Concurrent Animations**
```typescript
import { usePerformanceMonitor } from '@/lib/performance-monitor'

const { metrics } = usePerformanceMonitor()

// Check if too many animations are running
if (metrics()?.animationCount > 10) {
  // Reduce animation complexity or delay some animations
}
```

3. **Optimize Animation Duration**
```typescript
// Keep animations under 300ms for better performance
const optimizedAnimation = {
  transition: { duration: 0.2 } // 200ms
}
```

#### Problem: Animations don't respect reduced motion

**Symptoms:**
- Animations still play when user prefers reduced motion
- Accessibility complaints from users

**Solutions:**

1. **Use Accessible Variants**
```typescript
import { getAccessibleVariant, MOTION_VARIANTS } from '@/lib/motion-variants'

// ❌ Bad - Ignores reduced motion
const animation = MOTION_VARIANTS.slide.slideInUp

// ✅ Good - Respects reduced motion
const animation = getAccessibleVariant(
  MOTION_VARIANTS.slide.slideInUp,
  MOTION_VARIANTS.reducedMotion.opacity
)
```

2. **Check Motion State**
```typescript
import { isMotionEnabled } from '@/lib/motion'

if (!isMotionEnabled()) {
  // Use instant transitions or skip animations
  return { transition: { duration: 0 } }
}
```

### Bundle Size Issues

#### Problem: Bundle size is too large

**Symptoms:**
- Slow initial load times
- Large JavaScript bundles (>200KB gzipped)
- Poor performance on slow networks

**Solutions:**

1. **Implement Lazy Loading**
```typescript
import { useLazyMotion } from '@/lib/lazy-motion'

// ❌ Bad - Loads everything upfront
import { MOTION_VARIANTS } from '@/lib/motion-variants'

// ✅ Good - Lazy loads features
const { getFeature, preload } = useLazyMotion({
  features: ['animations', 'variants'],
  preloadStrategy: 'idle'
})
```

2. **Use Tree Shaking**
```typescript
// ❌ Bad - Imports entire library
import * as Motion from '@/lib/motion'

// ✅ Good - Imports only what's needed
import { getDuration, getEasing, MOTION_PRESETS } from '@/lib/motion'
```

3. **Optimize Imports**
```typescript
// ❌ Bad - Unused imports
import { 
  MOTION_PRESETS,
  MOTION_VARIANTS,
  THEME_MOTION_VARIANTS,
  // ... many unused exports
} from '@/lib/motion'

// ✅ Good - Only import what you use
import { MOTION_PRESETS } from '@/lib/motion'
```

### Memory Issues

#### Problem: Memory usage increases over time

**Symptoms:**
- Memory usage grows continuously
- Page becomes slow after extended use
- Browser crashes on low-memory devices

**Solutions:**

1. **Clean Up Animations**
```typescript
import { onCleanup } from 'solid-js'

const MyComponent = () => {
  let animationRef: Animation | null = null

  onCleanup(() => {
    // Clean up animation on unmount
    if (animationRef) {
      animationRef.cancel()
      animationRef = null
    }
  })

  return <div ref={animationRef} />
}
```

2. **Limit Concurrent Animations**
```typescript
class AnimationManager {
  private activeAnimations = new Set<string>()
  private readonly maxConcurrent = 5

  startAnimation(name: string) {
    if (this.activeAnimations.size >= this.maxConcurrent) {
      console.warn('Too many concurrent animations')
      return false
    }
    
    this.activeAnimations.add(name)
    return true
  }

  stopAnimation(name: string) {
    this.activeAnimations.delete(name)
  }
}
```

3. **Monitor Memory Usage**
```typescript
import { usePerformanceMonitor } from '@/lib/performance-monitor'

const { metrics } = usePerformanceMonitor()

// Check memory pressure
if (metrics()?.memoryPressure === 'high') {
  // Reduce animation complexity or pause non-essential animations
}
```

## 🔧 Debugging Tools

### Performance Monitoring

#### Enable Debug Mode
```typescript
// Enable debug mode in development
if (import.meta.env.DEV) {
  localStorage.setItem('debug-motion', 'true')
}

// Check if debug mode is enabled
const isDebugMode = () => localStorage.getItem('debug-motion') === 'true'
```

#### Performance Overlay
```typescript
// src/components/PerformanceOverlay.tsx
import { createSignal, onMount } from 'solid-js'
import { usePerformanceMonitor } from '@/lib/performance-monitor'

export function PerformanceOverlay() {
  const [isVisible, setIsVisible] = createSignal(false)
  const { metrics, getEntries } = usePerformanceMonitor()

  onMount(() => {
    setIsVisible(localStorage.getItem('debug-motion') === 'true')
  })

  return (
    <Show when={isVisible()}>
      <div class="performance-overlay">
        <h3>Performance Metrics</h3>
        <div>Frame Rate: {metrics()?.frameRate?.toFixed(1)}fps</div>
        <div>Memory: {(metrics()?.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
        <div>Animations: {metrics()?.animationCount}</div>
        <div>Memory Pressure: {metrics()?.memoryPressure}</div>
        
        <details>
          <summary>Animation Entries</summary>
          {getEntries('animation').map(entry => (
            <div>
              {entry.name}: {entry.duration.toFixed(1)}ms
            </div>
          ))}
        </details>
      </div>
    </Show>
  )
}
```

#### Animation Profiler
```typescript
// src/lib/animation-profiler.ts
export class AnimationProfiler {
  private profiles = new Map<string, number[]>()

  startProfile(name: string) {
    if (!this.profiles.has(name)) {
      this.profiles.set(name, [])
    }
    return performance.now()
  }

  endProfile(name: string, startTime: number) {
    const duration = performance.now() - startTime
    const profiles = this.profiles.get(name)!
    profiles.push(duration)

    // Keep only last 10 measurements
    if (profiles.length > 10) {
      profiles.shift()
    }

    // Log warning if animation is slow
    const avgDuration = profiles.reduce((a, b) => a + b, 0) / profiles.length
    if (avgDuration > 16.67) { // 60fps threshold
      console.warn(`Slow animation detected: ${name} (${avgDuration.toFixed(1)}ms)`)
    }
  }

  getStats(name: string) {
    const profiles = this.profiles.get(name) || []
    if (profiles.length === 0) return null

    const avg = profiles.reduce((a, b) => a + b, 0) / profiles.length
    const min = Math.min(...profiles)
    const max = Math.max(...profiles)

    return { avg, min, max, count: profiles.length }
  }
}

export const animationProfiler = new AnimationProfiler()
```

### Bundle Analysis

#### Bundle Analyzer
```bash
# Analyze bundle size
bun run build
npx vite-bundle-analyzer dist

# Or use the built-in analyzer
bun run analyze
```

#### Motion Impact Analysis
```typescript
// scripts/analyze-motion-impact.js
import { analyzeBundleOptimization } from '../src/lib/lazy-motion.js'

const analysis = analyzeBundleOptimization([
  'animations',
  'variants', 
  'transitions',
  'performance'
])

console.log('Motion Bundle Impact:')
console.log(`Original size: ${(analysis.originalSize / 1024).toFixed(1)}KB`)
console.log(`Optimized size: ${(analysis.optimizedSize / 1024).toFixed(1)}KB`)
console.log(`Savings: ${analysis.savingsPercentage.toFixed(1)}%`)

analysis.features.forEach(feature => {
  console.log(`${feature.name}: ${feature.size / 1024}KB (${feature.lazy ? 'lazy' : 'eager'})`)
})
```

## 🐛 Specific Error Scenarios

### TypeScript Errors

#### Error: Type 'number' is not assignable to type '0'

**Problem:** TypeScript strict typing in motion presets

**Solution:**
```typescript
// ❌ Problematic code
const fadeIn = {
  initial: { opacity: 0 }, // Type 'number' not assignable to '0'
  animate: { opacity: 1 }, // Type 'number' not assignable to '1'
}

// ✅ Fixed code
const fadeIn = {
  initial: { opacity: 0 as const },
  animate: { opacity: 1 as const },
}

// Or use type assertion
const fadeIn = {
  initial: { opacity: 0 } as { opacity: 0 },
  animate: { opacity: 1 } as { opacity: 1 },
}
```

#### Error: Cannot find module './motion-features/animations'

**Problem:** Missing feature modules in lazy loading system

**Solution:**
```typescript
// Create the missing feature modules
// src/lib/motion-features/animations.ts
export const animations = {
  fadeIn: { /* animation definition */ },
  slideIn: { /* animation definition */ },
  // ... other animations
}

// Update lazy-motion.ts to use correct imports
registry.register({
  name: 'animations',
  size: 15000,
  loader: () => import('./motion-features/animations'),
})
```

### Runtime Errors

#### Error: Animation target not found

**Problem:** Trying to animate element that doesn't exist

**Solution:**
```typescript
// Add null checks
const animateElement = (element: HTMLElement | null) => {
  if (!element) {
    console.warn('Animation target not found')
    return
  }
  
  // Animate the element
  element.animate(keyframes, options)
}
```

#### Error: Performance observer not supported

**Problem:** Browser doesn't support PerformanceObserver API

**Solution:**
```typescript
// Add feature detection
if ('PerformanceObserver' in window) {
  const observer = new PerformanceObserver(callback)
  observer.observe({ entryTypes: ['measure'] })
} else {
  console.warn('PerformanceObserver not supported, using fallback')
  // Use fallback timing
}
```

## 📊 Performance Optimization Checklist

### Animation Performance

- [ ] Use `transform` and `opacity` for animations
- [ ] Avoid animating layout properties
- [ ] Keep animation duration under 300ms
- [ ] Limit concurrent animations to <10
- [ ] Use `will-change` sparingly
- [ ] Test on low-end devices

### Bundle Optimization

- [ ] Implement lazy loading for motion features
- [ ] Use tree-shaking for unused variants
- [ ] Split animations into separate chunks
- [ ] Optimize imports to only include used features
- [ ] Monitor bundle size regularly

### Memory Management

- [ ] Clean up animations on component unmount
- [ ] Limit animation object creation
- [ ] Use object pooling for frequent animations
- [ ] Monitor memory usage
- [ ] Implement memory pressure detection

### Accessibility

- [ ] Use `getAccessibleVariant` for all animations
- [ ] Test with `prefers-reduced-motion`
- [ ] Provide keyboard navigation support
- [ ] Add proper ARIA attributes
- [ ] Test with screen readers

## 🔍 Debugging Techniques

### Console Debugging

#### Animation State Logging
```typescript
// Log animation state changes
const debugAnimation = (name: string, state: string) => {
  if (localStorage.getItem('debug-motion') === 'true') {
    console.log(`[Motion] ${name}: ${state}`)
  }
}

debugAnimation('card-hover', 'start')
// ... animation code ...
debugAnimation('card-hover', 'complete')
```

#### Performance Timing
```typescript
// Measure animation performance
const measureAnimation = (name: string, fn: () => void) => {
  const start = performance.now()
  fn()
  const end = performance.now()
  
  console.log(`[Motion] ${name}: ${(end - start).toFixed(2)}ms`)
}
```

### Visual Debugging

#### Animation Highlighting
```css
/* Highlight animated elements during debug */
.debug-mode [data-motion] {
  outline: 2px solid #ff0000;
  outline-offset: 2px;
}

.debug-mode [data-motion]:hover {
  outline-color: #00ff00;
}
```

#### Performance Visualization
```typescript
// Visualize frame rate
const createFrameRateVisualizer = () => {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 100px;
    height: 50px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #fff;
    z-index: 9999;
  `
  
  const ctx = canvas.getContext('2d')!
  const frameRates: number[] = []
  
  const update = () => {
    const fps = 1000 / (performance.now() - lastTime)
    frameRates.push(fps)
    
    if (frameRates.length > 50) frameRates.shift()
    
    // Draw frame rate graph
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 100, 50)
    
    ctx.strokeStyle = '#0f0'
    ctx.beginPath()
    frameRates.forEach((rate, i) => {
      const x = (i / 50) * 100
      const y = 50 - (rate / 60) * 50
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    
    requestAnimationFrame(update)
  }
  
  document.body.appendChild(canvas)
  update()
}
```

## 📋 Maintenance Procedures

### Regular Monitoring

#### Daily Checks
- [ ] Check performance metrics
- [ ] Monitor error rates
- [ ] Verify bundle size
- [ ] Review user feedback

#### Weekly Reviews
- [ ] Analyze animation performance trends
- [ ] Review bundle size changes
- [ ] Update performance budgets
- [ ] Check for new optimization opportunities

#### Monthly Audits
- [ ] Full performance audit
- [ ] Accessibility testing
- [ ] Cross-browser compatibility check
- [ ] Mobile device testing

### Performance Budgets

#### Set Budgets
```typescript
// src/lib/performance-budgets.ts
export const PERFORMANCE_BUDGETS = {
  bundleSize: {
    js: 200 * 1024, // 200KB
    css: 50 * 1024,  // 50KB
    total: 250 * 1024, // 250KB
  },
  animation: {
    duration: 300, // 300ms max
    frameRate: 55,  // 55fps min
    concurrent: 10, // 10 max
  },
  memory: {
    idle: 50 * 1024 * 1024,   // 50MB
    animated: 75 * 1024 * 1024, // 75MB
    pressure: 'medium' as const,
  }
}
```

#### Monitor Budgets
```typescript
// Check if budgets are exceeded
const checkBudgets = (metrics: PerformanceMetrics) => {
  const budgets = PERFORMANCE_BUDGETS
  
  if (metrics.frameRate < budgets.animation.frameRate) {
    console.warn(`Frame rate budget exceeded: ${metrics.frameRate}fps < ${budgets.animation.frameRate}fps`)
  }
  
  if (metrics.animationDuration > budgets.animation.duration) {
    console.warn(`Animation duration budget exceeded: ${metrics.animationDuration}ms > ${budgets.animation.duration}ms`)
  }
  
  if (metrics.memoryUsage > budgets.memory.animated) {
    console.warn(`Memory budget exceeded: ${metrics.memoryUsage / 1024 / 1024}MB > ${budgets.memory.animated / 1024 / 1024}MB`)
  }
}
```

## 🆘 Getting Help

### Resources

- **Motion.dev Documentation**: https://motion.dev/
- **Web Performance Best Practices**: https://web.dev/performance/
- **Accessibility Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/

### Community Support

- **GitHub Issues**: Report bugs and request features
- **Stack Overflow**: Tag questions with `motion-dev` and `kogoro`
- **Discord**: Join the community for real-time help

### Emergency Procedures

#### Production Issues
1. **Disable animations temporarily**
```typescript
// Emergency disable
localStorage.setItem('disable-motion', 'true')

// Check in motion.ts
export function isMotionEnabled(): boolean {
  if (typeof window !== 'undefined' && localStorage.getItem('disable-motion') === 'true') {
    return false
  }
  return state.enabled && !state.reducedMotion
}
```

2. **Roll back to previous version**
3. **Monitor error rates**
4. **Communicate with users**

#### Performance Degradation
1. **Enable performance monitoring**
2. **Identify bottlenecks**
3. **Implement quick fixes**
4. **Schedule comprehensive optimization**

---

*Troubleshooting guide last updated: November 17, 2025*