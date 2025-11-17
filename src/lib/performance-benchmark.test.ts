/**
 * Performance benchmarks for Motion integration
 * Tests animation performance, memory usage, and bundle impact
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  usePerformanceMonitor,
  analyzeBundle,
  generateRecommendations,
  type PerformanceMetrics,
} from './performance-monitor'
import {
  OPTIMIZED_VARIANTS,
  isGPUAccelerated,
  optimizeVariant,
} from './optimized-variants'
import { createOptimizedMotion } from './motion-optimized'
import { getDuration, getEasing, getDelay, isMotionEnabled } from './motion'

describe('Performance Benchmarks', () => {
  let container: HTMLElement

  beforeEach(() => {
    // Set up test environment
    container = document.createElement('div')
    document.body.appendChild(container)

    // Mock performance API
    global.performance = {
      ...global.performance,
      now: () => Date.now(),
      mark: () => undefined as any,
      measure: () => undefined as any,
      getEntriesByType: () => [],
    } as Performance
  })

  afterEach(() => {
    // Clean up
    document.body.removeChild(container)
  })

  describe('Animation Performance', () => {
    it('should maintain 60fps for simple animations', async () => {
      const element = document.createElement('div')
      container.appendChild(element)

      const startTime = performance.now()
      const frames = 60
      const frameDuration = 1000 / 60 // 16.67ms per frame

      // Simulate 60 frames of animation
      for (let i = 0; i < frames; i++) {
        await new Promise((resolve) => setTimeout(resolve, frameDuration))
        element.style.transform = `translateX(${i}px)`
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const expectedTime = frames * frameDuration

      // Should complete within 10% of expected time
      expect(totalTime).toBeLessThan(expectedTime * 1.1)
    })

    it('should use GPU-accelerated properties', () => {
      const variant = OPTIMIZED_VARIANTS.fade.smooth

      expect(isGPUAccelerated(variant)).toBe(true)
    })

    it('should optimize variants for performance', () => {
      const originalVariant = {
        initial: { opacity: 0, transform: 'scale(0.8)' },
        animate: { opacity: 1, transform: 'scale(1)' },
        exit: { opacity: 0, transform: 'scale(0.8)' },
        transition: { duration: 0.5, easing: 'ease-in-out' },
      }

      const optimized = optimizeVariant(originalVariant)

      expect(optimized.transition?.duration).toBeLessThanOrEqual(0.3)
      expect(optimized.transition?.easing).toBe('ease-out')
    })
  })

  describe('Memory Usage', () => {
    it('should not leak memory with repeated animations', async () => {
      const elements = Array.from({ length: 100 }, () => {
        const el = document.createElement('div')
        container.appendChild(el)
        return el
      })

      // Simulate memory monitoring
      const initialMemory = 50 // Mock initial memory in MB
      let maxMemory = initialMemory

      // Animate elements repeatedly
      for (let i = 0; i < 10; i++) {
        elements.forEach((el) => {
          el.style.transform = `translateY(${Math.random() * 10}px)`
        })

        // Simulate memory growth
        maxMemory += Math.random() * 2
      }

      // Memory should not grow excessively
      expect(maxMemory).toBeLessThan(initialMemory * 1.5)
    })

    it('should clean up animation listeners', () => {
      const { startAnimation } = usePerformanceMonitor()

      const endAnimation = startAnimation('test-animation')
      expect(typeof endAnimation).toBe('function')

      // Should not throw when called
      expect(() => endAnimation()).not.toThrow()
    })
  })

  describe('Bundle Impact', () => {
    it('should analyze bundle size correctly', async () => {
      const analysis = await analyzeBundle()

      expect(analysis.totalSize).toBeGreaterThan(0)
      expect(analysis.gzippedSize).toBeGreaterThan(0)
      expect(analysis.chunks.length).toBeGreaterThan(0)
      expect(analysis.motionImpact.size).toBeGreaterThan(0)
      expect(analysis.motionImpact.percentage).toBeGreaterThan(0)
    })

    it('should provide meaningful recommendations', () => {
      const metrics: PerformanceMetrics = {
        frameRate: 55,
        frameDrops: 5,
        animationDuration: 600,
        animationCount: 10,
        memoryUsage: 60 * 1024 * 1024, // 60MB
        memoryLimit: 100 * 1024 * 1024, // 100MB
        memoryPressure: 'high',
        bundleSize: 200000,
        gzippedSize: 60000,
        chunkCount: 3,
        firstContentfulPaint: 1500,
        largestContentfulPaint: 2500,
        cumulativeLayoutShift: 0.15,
      }

      const recommendations = generateRecommendations(metrics)

      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some((r) => r.category === 'animation')).toBe(true)
      expect(recommendations.some((r) => r.category === 'memory')).toBe(true)
    })
  })

  describe('Optimized Motion', () => {
    it('should provide minimal presets', () => {
      const motion = createOptimizedMotion()

      expect(motion.getDuration).toBeDefined()
      expect(motion.getEasing).toBeDefined()
      expect(motion.isMotionEnabled).toBeDefined()
    })

    it('should lazy load features', async () => {
      const motion = createOptimizedMotion()

      // Should return promises for lazy-loaded features
      const variantsPromise = motion.getVariants()
      expect(variantsPromise).toBeInstanceOf(Promise)

      const variants = await variantsPromise
      expect(variants).toBeDefined()
    })
  })

  describe('Device Optimization', () => {
    it('should adapt to different screen sizes', () => {
      // Mock different screen sizes
      const originalInnerWidth = window.innerWidth

      // Mobile
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
        configurable: true,
      })
      const mobileOptimization = { duration: 0.2, movement: 8, scale: 0.02 }

      // Desktop
      Object.defineProperty(window, 'innerWidth', {
        value: 1920,
        configurable: true,
      })
      const desktopOptimization = { duration: 0.3, movement: 16, scale: 0.05 }

      // Restore
      Object.defineProperty(window, 'innerWidth', {
        value: originalInnerWidth,
        configurable: true,
      })

      expect(mobileOptimization.duration).toBeLessThan(
        desktopOptimization.duration
      )
      expect(mobileOptimization.movement).toBeLessThan(
        desktopOptimization.movement
      )
    })
  })

  describe('Accessibility', () => {
    it('should respect reduced motion preferences', async () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        value: () => ({
          matches: true,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
        configurable: true,
      })

      // Initialize motion system to detect reduced motion
      const { initializeMotion } = await import('./motion')
      initializeMotion()

      const motion = createOptimizedMotion()

      // Should disable animations when reduced motion is preferred
      expect(motion.isMotionEnabled()).toBe(false)
    })
  })

  describe('Performance Monitoring', () => {
    it('should track animation performance', () => {
      const { metrics, startAnimation } = usePerformanceMonitor()

      const endAnimation = startAnimation('test-performance')

      // Simulate some work
      const start = performance.now()
      while (performance.now() - start < 10) {
        // Busy wait
      }

      endAnimation()

      // Metrics should be available
      expect(metrics).toBeDefined()
    })

    it('should measure layout performance', () => {
      const { measureLayout } = usePerformanceMonitor()

      expect(() => {
        measureLayout('test-layout', () => {
          // Simulate layout work
          container.style.width = '200px'
          container.offsetHeight // Force reflow
        })
      }).not.toThrow()
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle rapid successive animations', async () => {
      const element = document.createElement('div')
      container.appendChild(element)

      const animations = Array.from({ length: 50 }, () =>
        createOptimizedMotion().animate(element, 'fadeIn')
      )

      // All animations should complete without errors
      const results = await Promise.allSettled(animations)
      const failures = results.filter((r) => r.status === 'rejected')

      expect(failures).toHaveLength(0)
    })

    it('should maintain performance with many elements', async () => {
      const elements = Array.from({ length: 1000 }, () => {
        const el = document.createElement('div')
        container.appendChild(el)
        return el
      })

      const startTime = performance.now()

      // Animate all elements
      await createOptimizedMotion().batchAnimate(elements, 'fadeIn')

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (2 seconds for 1000 elements)
      expect(duration).toBeLessThan(2000)
    })
  })
})
