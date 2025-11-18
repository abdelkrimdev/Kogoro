/**
 * Performance optimization utilities for UI components
 * Provides memory management, animation optimization, and bundle optimization helpers
 */

import { createMemo, onCleanup, type Accessor } from 'solid-js'

// ============================================================================
// MEMORY MANAGEMENT UTILITIES
// ============================================================================

/**
 * Timeout manager for proper cleanup and memory leak prevention
 */
export class TimeoutManager {
  private timeouts: Set<ReturnType<typeof setTimeout>> = new Set()

  /**
   * Set a timeout with automatic cleanup tracking
   */
  setTimeout(
    callback: () => void,
    delay: number
  ): ReturnType<typeof setTimeout> {
    const timeoutId = setTimeout(() => {
      this.timeouts.delete(timeoutId)
      callback()
    }, delay)

    this.timeouts.add(timeoutId)
    return timeoutId
  }

  /**
   * Clear a specific timeout
   */
  clearTimeout(timeoutId: ReturnType<typeof setTimeout>): void {
    clearTimeout(timeoutId)
    this.timeouts.delete(timeoutId)
  }

  /**
   * Clear all timeouts
   */
  clearAll(): void {
    this.timeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId)
    })
    this.timeouts.clear()
  }

  /**
   * Get current timeout count
   */
  get count(): number {
    return this.timeouts.size
  }

  /**
   * Cleanup all timeouts and reset manager
   */
  cleanup(): void {
    this.clearAll()
  }
}

/**
 * Event listener manager for proper cleanup
 */
export class EventListenerManager {
  private listeners: Array<{
    target: EventTarget
    type: string
    listener: EventListener
    options?: boolean | AddEventListenerOptions
  }> = []

  /**
   * Add event listener with automatic cleanup tracking
   */
  addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options)
    this.listeners.push({ target, type, listener, options })
  }

  /**
   * Remove specific event listener
   */
  removeEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.removeEventListener(type, listener, options)
    const index = this.listeners.findIndex(
      (l) => l.target === target && l.type === type && l.listener === listener
    )
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * Remove all event listeners
   */
  removeAll(): void {
    this.listeners.forEach(({ target, type, listener, options }) => {
      target.removeEventListener(type, listener, options)
    })
    this.listeners.length = 0
  }

  /**
   * Get current listener count
   */
  get count(): number {
    return this.listeners.length
  }

  /**
   * Cleanup all event listeners
   */
  cleanup(): void {
    this.removeAll()
  }
}

/**
 * Create a timeout manager that auto-cleans on component unmount
 */
export function createTimeoutManager(): TimeoutManager {
  const manager = new TimeoutManager()
  onCleanup(() => manager.cleanup())
  return manager
}

/**
 * Create an event listener manager that auto-cleans on component unmount
 */
export function createEventListenerManager(): EventListenerManager {
  const manager = new EventListenerManager()
  onCleanup(() => manager.cleanup())
  return manager
}

// ============================================================================
// ANIMATION PERFORMANCE UTILITIES
// ============================================================================

/**
 * Animation frame manager for optimized animations
 */
export class AnimationFrameManager {
  private frameId: number | null = null
  private callbacks: Set<FrameRequestCallback> = new Set()

  /**
   * Add callback to next animation frame
   */
  request(callback: FrameRequestCallback): void {
    this.callbacks.add(callback)

    if (!this.frameId) {
      this.frameId = requestAnimationFrame((time) => {
        this.callbacks.forEach((cb) => {
          try {
            cb(time)
          } catch (error) {
            console.error('Error in animation frame callback:', error)
          }
        })
        this.callbacks.clear()
        this.frameId = null
      })
    }
  }

  /**
   * Cancel all pending animation frames
   */
  cancel(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
    this.callbacks.clear()
  }

  /**
   * Cleanup animation frame manager
   */
  cleanup(): void {
    this.cancel()
  }
}

/**
 * Create an animation frame manager that auto-cleans on component unmount
 */
export function createAnimationFrameManager(): AnimationFrameManager {
  const manager = new AnimationFrameManager()
  onCleanup(() => manager.cleanup())
  return manager
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastExecTime = 0

  return (...args: Parameters<T>) => {
    const currentTime = Date.now()

    if (currentTime - lastExecTime > delay) {
      func(...args)
      lastExecTime = currentTime
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(
        () => {
          func(...args)
          lastExecTime = Date.now()
          timeoutId = null
        },
        delay - (currentTime - lastExecTime)
      )
    }
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, delay)
  }
}

// ============================================================================
// REACTIVITY OPTIMIZATION UTILITIES
// ============================================================================

/**
 * Create a memoized computation with dependency tracking
 */
export function createMemoWithDeps<T>(
  fn: () => T,
  deps: Accessor<unknown>[]
): Accessor<T> {
  return createMemo(() => {
    // Trigger dependency tracking
    deps.forEach((dep) => {
      dep()
    })
    return fn()
  })
}

/**
 * Create a memoized computation that only updates when value actually changes
 */
export function createStableMemo<T>(
  fn: () => T,
  areEqual: (prev: T, curr: T) => boolean = (prev, curr) => prev === curr
): Accessor<T> {
  let prev: T
  let initialized = false

  return createMemo(() => {
    const curr = fn()
    if (!initialized || !areEqual(prev, curr)) {
      prev = curr
      initialized = true
    }
    return prev
  })
}

/**
 * Batch multiple state updates together
 */
export function batchUpdates<_T>(updates: (() => void)[]): void {
  // SolidJS automatically batches updates during render
  // This is a placeholder for future optimization needs
  updates.forEach((update) => {
    update()
  })
}

// ============================================================================
// BUNDLE OPTIMIZATION UTILITIES
// ============================================================================

/**
 * Lazy load utility for code splitting
 */
export function lazyLoad<T>(loader: () => Promise<T>): () => Promise<T | null> {
  let cached: T | null = null
  let loading: Promise<T> | null = null

  return async (): Promise<T | null> => {
    if (cached) return cached

    if (loading) return loading

    try {
      loading = loader()
      cached = await loading
      return cached
    } catch (error) {
      console.error('Failed to lazy load module:', error)
      return null
    } finally {
      loading = null
    }
  }
}

/**
 * Tree-shaking friendly feature detection
 */
export const supports = {
  // Animation features
  webAnimations:
    typeof document !== 'undefined' && 'animate' in document.documentElement,
  intersectionObserver: typeof IntersectionObserver !== 'undefined',
  resizeObserver: typeof ResizeObserver !== 'undefined',
  mutationObserver: typeof MutationObserver !== 'undefined',

  // Performance features
  performance: typeof performance !== 'undefined',
  requestIdleCallback: typeof requestIdleCallback !== 'undefined',

  // Browser features
  passiveEvents: (() => {
    let supportsPassive = false
    try {
      const opts = Object.defineProperty({}, 'passive', {
        get: () => {
          supportsPassive = true
          return true
        },
      })
      // Test with a dummy event
      window.addEventListener('test', () => {}, opts)
      window.removeEventListener('test', () => {}, opts)
    } catch (_e) {
      // Ignore
    }
    return supportsPassive
  })(),
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  private observers: PerformanceObserver[] = []

  /**
   * Start monitoring a specific metric
   */
  startMonitoring(name: string): void {
    if (!supports.performance) return

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.name === name) {
            this.recordMetric(name, entry.duration)
          }
        })
      })

      observer.observe({ entryTypes: ['measure'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Performance monitoring not available:', error)
    }
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)
  }

  /**
   * Get statistics for a metric
   */
  getMetricStats(name: string): {
    min: number
    max: number
    avg: number
    count: number
  } | null {
    const values = this.metrics.get(name)
    if (!values || values.length === 0) return null

    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length

    return { min, max, avg, count: values.length }
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, ReturnType<typeof this.getMetricStats>> {
    const result: Record<string, ReturnType<typeof this.getMetricStats>> = {}
    this.metrics.forEach((_, name) => {
      result[name] = this.getMetricStats(name)
    })
    return result
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear()
  }

  /**
   * Cleanup performance monitoring
   */
  cleanup(): void {
    this.observers.forEach((observer) => {
      observer.disconnect()
    })
    this.observers = []
    this.clearMetrics()
  }
}

/**
 * Create a performance monitor that auto-cleans on component unmount
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  const monitor = new PerformanceMonitor()
  onCleanup(() => monitor.cleanup())
  return monitor
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Safe async function wrapper with error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  onError?: (error: Error) => void
): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('Async operation failed:', err)
    onError?.(err)
    return null
  }
}

/**
 * Safe function wrapper with error handling
 */
export function safeFn<T>(
  fn: () => T,
  onError?: (error: Error) => void,
  fallback?: T
): T | null {
  try {
    return fn()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('Function execution failed:', err)
    onError?.(err)
    return fallback ?? null
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  onError?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      onError?.(attempt, lastError)

      if (attempt < maxAttempts) {
        const delay = baseDelay * 2 ** (attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError!
}

export default {
  TimeoutManager,
  EventListenerManager,
  AnimationFrameManager,
  createTimeoutManager,
  createEventListenerManager,
  createAnimationFrameManager,
  throttle,
  debounce,
  createMemoWithDeps,
  createStableMemo,
  batchUpdates,
  lazyLoad,
  supports,
  PerformanceMonitor,
  createPerformanceMonitor,
  safeAsync,
  safeFn,
  retry,
}
