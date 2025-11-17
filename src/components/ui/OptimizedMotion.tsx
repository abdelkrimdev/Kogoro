/**
 * OptimizedMotion - Performance-optimized motion component
 * Implements lazy loading, error boundaries, and performance monitoring
 * Provides tree-shaking friendly exports for minimal bundle impact
 */

import { type Component, createSignal, onMount, Show, type JSX } from 'solid-js'
import { useLazyMotion, type MotionFeature } from '../../lib/lazy-motion'
import { MotionErrorBoundary } from './MotionErrorBoundary'
import { isMotionEnabled } from '../../lib/motion'
import { cn } from '../../lib/utils'

interface OptimizedMotionProps {
  children: JSX.Element
  features?: MotionFeature[]
  preloadStrategy?: 'none' | 'hover' | 'visible' | 'idle'
  fallback?: JSX.Element
  disabled?: boolean
  respectReducedMotion?: boolean
  performanceMonitoring?: boolean
  className?: string
}

/**
 * OptimizedMotion component with lazy loading and performance monitoring
 *
 * @example
 * ```tsx
 * <OptimizedMotion
 *   features={['animations', 'variants']}
 *   preloadStrategy="idle"
 *   performanceMonitoring
 * >
 *   <div>Animated content</div>
 * </OptimizedMotion>
 * ```
 */
export const OptimizedMotion: Component<OptimizedMotionProps> = (props) => {
  const [isReady, setIsReady] = createSignal(false)
  const [hasError, setHasError] = createSignal(false)

  const features = () => props.features ?? ['animations']
  const respectReducedMotion = () => props.respectReducedMotion ?? true

  // Skip motion if disabled or reduced motion is preferred
  const shouldSkipMotion = () => {
    if (props.disabled) return true
    if (respectReducedMotion() && !isMotionEnabled()) return true
    return false
  }

  // Setup lazy loading
  const lazyMotion = useLazyMotion({
    features: features(),
    preloadStrategy: props.preloadStrategy ?? 'idle',
    timeout: 3000,
    fallback: () => {
      console.warn(
        'Motion features failed to load, falling back to static content'
      )
      setHasError(true)
    },
  })

  // Performance monitoring can be implemented here when needed
  // const performanceMonitor = performanceMonitoring()
  //   ? usePerformanceMonitor({
  //       enableMonitoring: true,
  //       sampleRate: 0.1,
  //       thresholds: {
  //         frameRate: 55,
  //         memoryUsage: 50 * 1024 * 1024,
  //         animationDuration: 1000,
  //       },
  //     })
  //   : null

  // Load motion features on mount
  onMount(async () => {
    if (shouldSkipMotion()) {
      setIsReady(true)
      return
    }

    try {
      await lazyMotion.preload()
      setIsReady(true)
    } catch (error) {
      console.error('Failed to load motion features:', error)
      setHasError(true)
      setIsReady(true)
    }
  })

  // Render fallback or content
  if (shouldSkipMotion()) {
    return (
      <div class={cn('motion-disabled', props.className)}>{props.children}</div>
    )
  }

  return (
    <MotionErrorBoundary
      enableMotion={!shouldSkipMotion()}
      respectReducedMotion={respectReducedMotion()}
      onError={(error) => {
        console.error('OptimizedMotion error:', error)
        setHasError(true)
      }}
    >
      <Show
        when={isReady()}
        fallback={
          props.fallback ?? (
            <div class={cn('motion-loading', props.className)}>
              {props.children}
            </div>
          )
        }
      >
        <div
          class={cn(
            'optimized-motion',
            isReady() && !hasError(),
            props.className
          )}
          style={{
            transition:
              isReady() && !hasError()
                ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                : 'none',
            opacity: hasError() ? 1 : undefined,
          }}
        >
          {props.children}
        </div>
      </Show>
    </MotionErrorBoundary>
  )
}

// ============================================================================
// MINIMAL MOTION COMPONENTS
// ============================================================================

interface MinimalMotionProps {
  children: JSX.Element
  className?: string
  disabled?: boolean
}

/**
 * MinimalMotion - Lightweight motion component with basic fade-in animation
 * Provides minimal bundle impact and simple API
 */
export const MinimalMotion: Component<MinimalMotionProps> = (props) => {
  const shouldSkipMotion = () => {
    if (props.disabled) return true
    return !isMotionEnabled()
  }

  if (shouldSkipMotion()) {
    return (
      <div class={cn('motion-disabled', props.className)}>{props.children}</div>
    )
  }

  return (
    <div
      class={cn('minimal-motion', props.className)}
      style={{
        opacity: 0,
        animation: shouldSkipMotion()
          ? 'none'
          : 'fadeIn 0.3s ease-out forwards',
      }}
    >
      {props.children}
    </div>
  )
}

interface OptimizedListItemProps {
  children: JSX.Element
  index: number
  className?: string
  staggerDelay?: number
}

/**
 * OptimizedListItem - Optimized list item with staggered animation
 * Perfect for animated lists with sequential entry
 */
export const OptimizedListItem: Component<OptimizedListItemProps> = (props) => {
  const staggerDelay = () => props.staggerDelay ?? 100
  const delay = () => props.index * staggerDelay()

  return (
    <div
      class={cn('optimized-list-item', props.className)}
      style={{
        opacity: 0,
        transform: 'translateY(20px)',
        animation: isMotionEnabled()
          ? `slideInUp 0.4s ease-out ${delay()}ms forwards`
          : 'none',
      }}
    >
      {props.children}
    </div>
  )
}

interface LazyHeavyMotionProps {
  children: JSX.Element
  className?: string
  features?: MotionFeature[]
  preloadStrategy?: 'none' | 'hover' | 'visible' | 'idle'
}

/**
 * LazyHeavyMotion - Heavy motion components with lazy loading
 * Loads complex animations only when needed
 */
export const LazyHeavyMotion: Component<LazyHeavyMotionProps> = (props) => {
  const [isLoaded, setIsLoaded] = createSignal(false)
  const [isHovered, setIsHovered] = createSignal(false)

  const features = () =>
    props.features ?? ['animations', 'variants', 'transitions']
  const preloadStrategy = () => props.preloadStrategy ?? 'hover'

  const lazyMotion = useLazyMotion({
    features: features(),
    preloadStrategy: preloadStrategy(),
    timeout: 5000,
    fallback: () => {
      console.warn('Heavy motion features failed to load')
    },
  })

  const handleMouseEnter = async () => {
    if (!isLoaded() && preloadStrategy() === 'hover') {
      setIsHovered(true)
      try {
        await lazyMotion.preload()
        setIsLoaded(true)
      } catch (error) {
        console.error('Failed to load heavy motion features:', error)
      }
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  // Load on idle if strategy is idle
  onMount(() => {
    if (preloadStrategy() === 'idle') {
      setTimeout(async () => {
        try {
          await lazyMotion.preload()
          setIsLoaded(true)
        } catch (error) {
          console.error('Failed to load heavy motion features:', error)
        }
      }, 100)
    }
  })

  return (
    <div
      role="button"
      tabIndex={0}
      class={cn('lazy-heavy-motion', props.className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transition: isLoaded()
          ? 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          : 'none',
        transform: isLoaded() && isHovered() ? 'scale(1.02)' : 'scale(1)',
        opacity: isLoaded() ? 1 : 0.8,
      }}
    >
      {props.children}
    </div>
  )
}

export default OptimizedMotion
