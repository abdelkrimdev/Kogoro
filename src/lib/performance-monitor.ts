/**
 * Performance monitoring utilities for Motion integration
 * Tracks animation performance, memory usage, and bundle impact
 */

import { createSignal, onCleanup, onMount } from 'solid-js'
import { isMotionEnabled } from './motion'

// ============================================================================
// PERFORMANCE METRICS TYPES
// ============================================================================

export interface PerformanceMetrics {
  // Animation performance
  frameRate: number
  frameDrops: number
  animationDuration: number
  animationCount: number

  // Memory usage
  memoryUsage: number
  memoryLimit: number
  memoryPressure: 'low' | 'medium' | 'high'

  // Bundle impact
  bundleSize: number
  gzippedSize: number
  chunkCount: number

  // User experience
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
}

export interface PerformanceEntry {
  timestamp: number
  type: 'animation' | 'memory' | 'layout' | 'network'
  name: string
  duration: number
  value: number
  metadata?: Record<string, unknown>
}

export interface PerformanceConfig {
  enableMonitoring: boolean
  sampleRate: number
  maxEntries: number
  reportInterval: number
  thresholds: {
    frameRate: number
    memoryUsage: number
    animationDuration: number
  }
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

class MotionPerformanceMonitor {
  private config: PerformanceConfig
  private entries: PerformanceEntry[] = []
  private observers: Map<
    string,
    IntersectionObserver | PerformanceObserver | ReturnType<typeof setInterval>
  > = new Map()
  private rafId: number | null = null
  private lastFrameTime: number = 0
  private frameCount: number = 0
  private droppedFrames: number = 0

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableMonitoring: true,
      sampleRate: 0.1, // Sample 10% of animations
      maxEntries: 1000,
      reportInterval: 5000, // Report every 5 seconds
      thresholds: {
        frameRate: 55, // Target 60fps, alert below 55fps
        memoryUsage: 50 * 1024 * 1024, // 50MB
        animationDuration: 1000, // 1 second
      },
      ...config,
    }

    this.initialize()
  }

  private initialize() {
    if (typeof window === 'undefined' || !this.config.enableMonitoring) return

    // Start frame rate monitoring
    this.startFrameRateMonitoring()

    // Start memory monitoring
    this.startMemoryMonitoring()

    // Start performance observer
    this.startPerformanceObserver()

    // Set up periodic reporting
    this.startPeriodicReporting()
  }

  private startFrameRateMonitoring() {
    const measureFrame = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const frameDuration = timestamp - this.lastFrameTime
        const frameRate = 1000 / frameDuration

        // Count dropped frames (below 30fps)
        if (frameRate < 30) {
          this.droppedFrames++
        }

        this.frameCount++

        // Log frame rate every 60 frames
        if (this.frameCount % 60 === 0) {
          this.addEntry({
            timestamp,
            type: 'animation',
            name: 'frame-rate',
            duration: frameDuration,
            value: frameRate,
            metadata: {
              droppedFrames: this.droppedFrames,
              totalFrames: this.frameCount,
            },
          })
        }
      }

      this.lastFrameTime = timestamp
      this.rafId = requestAnimationFrame(measureFrame)
    }

    this.rafId = requestAnimationFrame(measureFrame)
  }

  private startMemoryMonitoring() {
    if (!('memory' in performance)) return

    const checkMemory = () => {
      const memory = (
        performance as Performance & {
          memory?: {
            usedJSHeapSize: number
            jsHeapSizeLimit: number
            totalJSHeapSize: number
          }
        }
      ).memory
      if (memory) {
        const usage = memory.usedJSHeapSize
        const limit = memory.jsHeapSizeLimit
        const pressure = this.calculateMemoryPressure(usage, limit)

        this.addEntry({
          timestamp: Date.now(),
          type: 'memory',
          name: 'heap-usage',
          duration: 0,
          value: usage,
          metadata: {
            limit,
            pressure,
            total: memory.totalJSHeapSize,
          },
        })
      }
    }

    // Check memory every 2 seconds
    const interval = setInterval(checkMemory, 2000)
    this.observers.set('memory', interval)
  }

  private startPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return

    // Observe animation performance
    const animationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure' && entry.name.includes('motion-')) {
          this.addEntry({
            timestamp: entry.startTime,
            type: 'animation',
            name: entry.name,
            duration: entry.duration,
            value: entry.duration,
          })
        }
      }
    })

    animationObserver.observe({ entryTypes: ['measure'] })
    this.observers.set('animation', animationObserver)

    // Observe layout shifts
    const layoutObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift') {
          const layoutEntry = entry as unknown as PerformanceEntry & {
            value: number
          }
          this.addEntry({
            timestamp: entry.startTime,
            type: 'layout',
            name: 'layout-shift',
            duration: 0,
            value: layoutEntry.value,
          })
        }
      }
    })

    layoutObserver.observe({ entryTypes: ['layout-shift'] })
    this.observers.set('layout', layoutObserver)
  }

  private startPeriodicReporting() {
    const interval = setInterval(() => {
      this.generateReport()
    }, this.config.reportInterval)

    this.observers.set('reporting', interval)
  }

  private calculateMemoryPressure(
    usage: number,
    limit: number
  ): 'low' | 'medium' | 'high' {
    const ratio = usage / limit
    if (ratio < 0.5) return 'low'
    if (ratio < 0.8) return 'medium'
    return 'high'
  }

  private addEntry(entry: PerformanceEntry) {
    // Sample based on configured rate
    if (Math.random() > this.config.sampleRate) return

    this.entries.push(entry)

    // Maintain max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries)
    }
  }

  private generateReport(): PerformanceMetrics {
    const now = Date.now()
    const recentEntries = this.entries.filter(
      (entry) => now - entry.timestamp < 5000 // Last 5 seconds
    )

    // Calculate frame rate
    const frameEntries = recentEntries.filter((e) => e.name === 'frame-rate')
    const avgFrameRate =
      frameEntries.length > 0
        ? frameEntries.reduce((sum, e) => sum + e.value, 0) /
          frameEntries.length
        : 60

    // Calculate memory usage
    const memoryEntries = recentEntries.filter((e) => e.type === 'memory')
    const latestMemory =
      memoryEntries.length > 0
        ? memoryEntries[memoryEntries.length - 1].value
        : 0

    // Calculate animation performance
    const animationEntries = recentEntries.filter((e) => e.type === 'animation')
    const avgAnimationDuration =
      animationEntries.length > 0
        ? animationEntries.reduce((sum, e) => sum + e.duration, 0) /
          animationEntries.length
        : 0

    // Get Web Vitals
    const fcp = this.getMetric('first-contentful-paint')
    const lcp = this.getMetric('largest-contentful-paint')
    const cls = this.getCLS()

    const metrics: PerformanceMetrics = {
      frameRate: avgFrameRate,
      frameDrops: this.droppedFrames,
      animationDuration: avgAnimationDuration,
      animationCount: animationEntries.length,
      memoryUsage: latestMemory,
      memoryLimit: 0, // Not available in all browsers
      memoryPressure: this.calculateMemoryPressure(
        latestMemory,
        latestMemory * 1.5
      ),
      bundleSize: 0, // To be calculated separately
      gzippedSize: 0, // To be calculated separately
      chunkCount: 0, // To be calculated separately
      firstContentfulPaint: fcp,
      largestContentfulPaint: lcp,
      cumulativeLayoutShift: cls,
    }

    // Check thresholds and log warnings
    this.checkThresholds(metrics)

    return metrics
  }

  private getMetric(name: string): number {
    if (!('performance' in window && 'getEntriesByType' in performance))
      return 0

    const entries = performance.getEntriesByType(
      'navigation'
    ) as PerformanceNavigationTiming[]
    if (entries.length > 0) {
      const nav = entries[0]
      switch (name) {
        case 'first-contentful-paint':
          return nav.responseStart - nav.requestStart
        case 'largest-contentful-paint':
          return nav.loadEventEnd - nav.requestStart
        default:
          return 0
      }
    }

    return 0
  }

  private getCLS(): number {
    // Simplified CLS calculation
    const layoutEntries = this.entries.filter((e) => e.name === 'layout-shift')
    return layoutEntries.reduce((sum, e) => sum + e.value, 0)
  }

  private checkThresholds(metrics: PerformanceMetrics) {
    const { thresholds } = this.config

    if (metrics.frameRate < thresholds.frameRate) {
      console.warn(
        `⚠️ Low frame rate detected: ${metrics.frameRate.toFixed(1)}fps`
      )
    }

    if (metrics.memoryUsage > thresholds.memoryUsage) {
      console.warn(
        `⚠️ High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`
      )
    }

    if (metrics.animationDuration > thresholds.animationDuration) {
      console.warn(
        `⚠️ Long animation duration: ${metrics.animationDuration.toFixed(1)}ms`
      )
    }
  }

  // Public API
  public getMetrics(): PerformanceMetrics {
    return this.generateReport()
  }

  public getEntries(type?: PerformanceEntry['type']): PerformanceEntry[] {
    return type
      ? this.entries.filter((e) => e.type === type)
      : [...this.entries]
  }

  public startAnimation(name: string): () => void {
    if (!isMotionEnabled()) return () => {}

    const startTime = performance.now()
    const measureName = `motion-${name}`

    performance.mark(`${measureName}-start`)

    return () => {
      const endTime = performance.now()
      performance.mark(`${measureName}-end`)
      performance.measure(
        measureName,
        `${measureName}-start`,
        `${measureName}-end`
      )

      this.addEntry({
        timestamp: startTime,
        type: 'animation',
        name: measureName,
        duration: endTime - startTime,
        value: endTime - startTime,
      })
    }
  }

  public measureLayout(name: string, fn: () => void): void {
    const startTime = performance.now()
    fn()
    const endTime = performance.now()

    this.addEntry({
      timestamp: startTime,
      type: 'layout',
      name: `layout-${name}`,
      duration: endTime - startTime,
      value: endTime - startTime,
    })
  }

  public destroy() {
    // Clean up observers
    this.observers.forEach((observer, key) => {
      if (key === 'memory' || key === 'reporting') {
        clearInterval(observer as ReturnType<typeof setInterval>)
      } else if (
        observer &&
        typeof (observer as PerformanceObserver).disconnect === 'function'
      ) {
        ;(observer as PerformanceObserver).disconnect()
      }
    })
    this.observers.clear()

    // Cancel animation frame
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    // Clear entries
    this.entries.length = 0
  }
}

// ============================================================================
// HOOK FOR PERFORMANCE MONITORING
// ============================================================================

export function usePerformanceMonitor(config?: Partial<PerformanceConfig>) {
  const [metrics, setMetrics] = createSignal<PerformanceMetrics | null>(null)
  const [isMonitoring, setIsMonitoring] = createSignal(false)
  let monitor: MotionPerformanceMonitor | null = null

  onMount(() => {
    if (typeof window === 'undefined') return

    monitor = new MotionPerformanceMonitor(config)
    setIsMonitoring(true)

    // Update metrics periodically
    const interval = setInterval(() => {
      if (monitor) {
        setMetrics(monitor.getMetrics())
      }
    }, 1000)

    onCleanup(() => {
      clearInterval(interval)
      if (monitor) {
        monitor.destroy()
        monitor = null
      }
      setIsMonitoring(false)
    })
  })

  const startAnimation = (name: string) => {
    return monitor?.startAnimation(name) || (() => {})
  }

  const measureLayout = (name: string, fn: () => void) => {
    monitor?.measureLayout(name, fn)
  }

  const getEntries = (type?: PerformanceEntry['type']) => {
    return monitor?.getEntries(type) || []
  }

  return {
    metrics,
    isMonitoring,
    startAnimation,
    measureLayout,
    getEntries,
  }
}

// ============================================================================
// BUNDLE ANALYSIS UTILITIES
// ============================================================================

export interface BundleAnalysis {
  totalSize: number
  gzippedSize: number
  chunks: Array<{
    name: string
    size: number
    gzippedSize: number
    modules: string[]
  }>
  motionImpact: {
    size: number
    gzippedSize: number
    percentage: number
  }
}

export async function analyzeBundle(): Promise<BundleAnalysis> {
  // This would typically be done at build time
  // For now, return a mock analysis
  return {
    totalSize: 185791, // From current build
    gzippedSize: 54400,
    chunks: [
      {
        name: 'index',
        size: 185791,
        gzippedSize: 54400,
        modules: ['motion', 'solid-js', 'tailwindcss'],
      },
    ],
    motionImpact: {
      size: 45000, // Estimated
      gzippedSize: 15000,
      percentage: 24.2,
    },
  }
}

// ============================================================================
// PERFORMANCE RECOMMENDATIONS
// ============================================================================

export interface PerformanceRecommendation {
  type: 'optimization' | 'warning' | 'error'
  category: 'animation' | 'memory' | 'bundle' | 'layout'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  action: string
}

export function generateRecommendations(
  metrics: PerformanceMetrics
): PerformanceRecommendation[] {
  const recommendations: PerformanceRecommendation[] = []

  // Frame rate recommendations
  if (metrics.frameRate < 55) {
    recommendations.push({
      type: 'warning',
      category: 'animation',
      title: 'Low Frame Rate Detected',
      description: `Average frame rate is ${metrics.frameRate.toFixed(1)}fps, below the target of 60fps.`,
      impact: 'high',
      action:
        'Reduce animation complexity, use CSS transforms instead of layout properties, or enable reduced motion.',
    })
  }

  // Memory recommendations
  if (metrics.memoryPressure === 'high') {
    recommendations.push({
      type: 'error',
      category: 'memory',
      title: 'High Memory Usage',
      description: `Memory usage is ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB with high pressure.`,
      impact: 'high',
      action:
        'Implement lazy loading for motion features, clean up unused animations, and reduce concurrent animations.',
    })
  }

  // Animation duration recommendations
  if (metrics.animationDuration > 500) {
    recommendations.push({
      type: 'optimization',
      category: 'animation',
      title: 'Long Animation Durations',
      description: `Average animation duration is ${metrics.animationDuration.toFixed(1)}ms.`,
      impact: 'medium',
      action:
        'Consider shorter animation durations (200-500ms) for better perceived performance.',
    })
  }

  // Layout shift recommendations
  if (metrics.cumulativeLayoutShift > 0.1) {
    recommendations.push({
      type: 'warning',
      category: 'layout',
      title: 'Layout Shift Detected',
      description: `Cumulative Layout Shift is ${metrics.cumulativeLayoutShift.toFixed(3)}.`,
      impact: 'medium',
      action:
        'Use transform and opacity for animations, avoid animating layout properties like width/height.',
    })
  }

  return recommendations
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MotionPerformanceMonitor as default }
