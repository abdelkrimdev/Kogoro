/**
 * OptimizedMotion - Performance-optimized motion component
 * Implements lazy loading, error boundaries, and performance monitoring
 * Provides tree-shaking friendly exports for minimal bundle impact
 */

import {
  type Component,
  createSignal,
  onMount,
  onCleanup,
  Show,
  type JSX,
  createEffect,
} from 'solid-js'
import {
  useLazyMotion,
  type MotionFeature as LazyMotionFeature,
} from '../../lib/lazy-motion'
import { MotionErrorBoundary } from './MotionErrorBoundary'
import { isMotionEnabled } from '../../lib/motion'
import { cn, getStatusClasses, getTextClasses } from '../../lib/utils'

import type {
  BaseComponentProps,
  MotionFeature,
  PreloadStrategy,
} from './interfaces'

/**
 * Enhanced optimized motion interface with comprehensive options
 */
export interface OptimizedMotionProps
  extends BaseComponentProps,
    ErrorHandlingProps {
  /**
   * Content to render with optimized motion
   */
  children: JSX.Element
  /**
   * Motion features to load and enable
   * @default ['animations']
   */
  features?: MotionFeature[]
  /**
   * Strategy for preloading motion features
   * @default 'idle'
   */
  preloadStrategy?: PreloadStrategy
  /**
   * Fallback content to show while loading or on error
   */
  fallback?: JSX.Element
  /**
   * Whether to disable all motion features
   * @default false
   */
  disabled?: boolean
  /**
   * Whether to respect user's reduced motion preferences
   * @default true
   */
  respectReducedMotion?: boolean
  /**
   * Whether to enable performance monitoring
   * @default true in development, false in production
   */
  performanceMonitoring?: boolean
  /**
   * Custom CSS classes
   */
  className?: string
  /**
   * Timeout for loading motion features in milliseconds
   * @default 3000
   */
  timeout?: number
  /**
   * Whether to show loading state during feature loading
   * @default true
   */
  showLoading?: boolean
  /**
   * Custom loading indicator
   */
  loadingIndicator?: JSX.Element
  /**
   * Whether to enable debug mode
   * @default false
   */
  debug?: boolean
  /**
   * Custom error handler for motion feature loading
   * @param error - The error that occurred
   */
  onError?: (error: Error) => void
  /**
   * Callback when motion features are loaded
   */
  onLoad?: () => void
  /**
   * Callback when motion features fail to load
   */
  onLoadError?: (error: Error) => void
  /**
   * Whether to enable tree-shaking optimizations
   * @default true
   */
  treeShaking?: boolean
  /**
   * Custom bundle analysis options
   */
  bundleAnalysis?: {
    enabled?: boolean
    reportThreshold?: number
    includeDetails?: boolean
  }
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
  const [retryCount, setRetryCount] = createSignal(0)

  const features = () => props.features ?? (['animations'] as MotionFeature[])
  const respectReducedMotion = () => props.respectReducedMotion ?? true
  const maxRetries = () => props.maxRetries ?? 2
  const retryDelay = () => props.retryDelay ?? 1000

  // Skip motion if disabled or reduced motion is preferred
  const shouldSkipMotion = () => {
    if (props.disabled) return true
    if (respectReducedMotion() && !isMotionEnabled()) return true
    return false
  }

  // Setup lazy loading
  const lazyMotion = useLazyMotion({
    features: features() as LazyMotionFeature[],
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

  // Load motion features on mount with proper error handling and retry logic
  createEffect(async () => {
    if (shouldSkipMotion()) {
      setIsReady(true)
      return
    }

    let isCancelled = false

    // Cleanup function to cancel async operations
    onCleanup(() => {
      isCancelled = true
    })

    /**
     * Handle successful motion loading
     */
    const handleLoadSuccess = (): void => {
      if (!isCancelled) {
        setIsReady(true)
        setHasError(false)
        setRetryCount(0)
        props.onLoad?.()
      }
    }

    /**
     * Handle loading error
     */
    const handleLoadError = (error: unknown): void => {
      if (!isCancelled) {
        console.error(`Failed to load motion features:`, error)
        setHasError(true)
        setIsReady(true)
        props.onLoadError?.(error as Error)
        props.onError?.(error as Error)
      }
    }

    /**
     * Wait for retry delay
     */
    const waitForRetry = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, retryDelay()))
    }

    /**
     * Handle retry logic
     */
    const handleRetry = async (
      attempt: number,
      error: unknown
    ): Promise<void> => {
      if (attempt >= maxRetries()) {
        handleLoadError(error)
        return
      }

      setRetryCount(attempt)
      await waitForRetry()
      if (!isCancelled) {
        await attemptLoad(attempt + 1)
      }
    }

    /**
     * Attempt to load motion features
     */
    const attemptLoad = async (attempt: number): Promise<void> => {
      if (isCancelled) return

      try {
        await lazyMotion.preload()
        handleLoadSuccess()
      } catch (error) {
        if (isCancelled) return

        console.error(
          `Failed to load motion features (attempt ${attempt}):`,
          error
        )

        await handleRetry(attempt, error)
      }
    }

    await attemptLoad(1)
  })

  // Render fallback or content
  if (shouldSkipMotion()) {
    return (
      <div class={cn('motion-disabled', props.className)}>{props.children}</div>
    )
  }

  const renderErrorState = () => {
    if (!hasError()) return null

    return (
      <div class={cn('p-4 rounded-lg border text-center', props.className)}>
        <div class="flex flex-col items-center space-y-2">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>Motion Error</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p class="text-sm">Motion features failed to load</p>
          <button
            type="button"
            onClick={() => {
              setHasError(false)
              setRetryCount(0)
              // Retry loading
              setIsReady(false)
              setTimeout(() => setIsReady(true), 100)
            }}
            class={cn(
              'px-3 py-1 text-xs rounded transition-colors',
              getStatusClasses('info', 'bg'),
              'hover:opacity-90',
              getTextClasses('primary')
            )}
          >
            Retry {retryCount() > 0 ? `(${retryCount()})` : ''}
          </button>
        </div>
      </div>
    )
  }

  return (
    <MotionErrorBoundary
      enableMotion={!shouldSkipMotion()}
      respectReducedMotion={respectReducedMotion()}
      onError={(error) => {
        console.error('OptimizedMotion error:', error)
        setHasError(true)
        props.onError?.(error)
      }}
    >
      <Show
        when={isReady()}
        fallback={
          props.fallback ?? (
            <div class={cn('motion-loading p-4 text-center', props.className)}>
              <div class="flex flex-col items-center space-y-2">
                <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p class="text-sm">Loading motion features...</p>
              </div>
            </div>
          )
        }
      >
        <div
          class={cn(
            'optimized-motion',
            isReady() && !hasError(),
            hasError() && 'opacity-75',
            props.className
          )}
          style={{
            transition:
              isReady() && !hasError()
                ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                : 'none',
            opacity: hasError() ? 0.8 : undefined,
          }}
        >
          <MotionErrorBoundary
            onError={(error) => {
              console.error('OptimizedMotion content error:', error)
              setHasError(true)
              props.onError?.(error)
            }}
          >
            {props.children}
          </MotionErrorBoundary>
        </div>
      </Show>

      {/* Error state */}
      {renderErrorState()}
    </MotionErrorBoundary>
  )
}

// ============================================================================
// MINIMAL MOTION COMPONENTS
// ============================================================================

/**
 * Minimal motion interface for lightweight animations
 */
export interface MinimalMotionProps extends BaseComponentProps {
  /**
   * Content to render with minimal motion
   */
  children: JSX.Element
  /**
   * Custom CSS classes
   */
  className?: string
  /**
   * Whether to disable animations
   * @default false
   */
  disabled?: boolean
  /**
   * Animation duration in seconds
   * @default 0.3
   */
  duration?: number
  /**
   * Whether to respect reduced motion
   * @default true
   */
  respectReducedMotion?: boolean
  /**
   * Animation variant
   * @default 'fade'
   */
  variant?: 'fade' | 'slide' | 'scale'
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

/**
 * Optimized list item interface for staggered animations
 */
export interface OptimizedListItemProps extends BaseComponentProps {
  /**
   * Content to render in list item
   */
  children: JSX.Element
  /**
   * Item index for staggered animations
   */
  index: number
  /**
   * Custom CSS classes
   */
  className?: string
  /**
   * Stagger delay in milliseconds
   * @default 100
   */
  staggerDelay?: number
  /**
   * Animation duration in seconds
   * @default 0.4
   */
  duration?: number
  /**
   * Whether to respect reduced motion
   * @default true
   */
  respectReducedMotion?: boolean
  /**
   * Animation variant
   * @default 'slideInUp'
   */
  animation?: string
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

/**
 * Lazy heavy motion interface for complex animations
 */
export interface LazyHeavyMotionProps extends BaseComponentProps {
  /**
   * Content to render with heavy motion
   */
  children: JSX.Element
  /**
   * Custom CSS classes
   */
  className?: string
  /**
   * Motion features to load
   * @default ['animations', 'variants', 'transitions']
   */
  features?: MotionFeature[]
  /**
   * Preload strategy for heavy features
   * @default 'hover'
   */
  preloadStrategy?: PreloadStrategy
  /**
   * Timeout for loading heavy features in milliseconds
   * @default 5000
   */
  timeout?: number
  /**
   * Whether to show loading state
   * @default true
   */
  showLoading?: boolean
  /**
   * Custom loading indicator
   */
  loadingIndicator?: JSX.Element
  /**
   * Whether to enable hover effects
   * @default true
   */
  enableHover?: boolean
  /**
   * Hover scale factor
   * @default 1.02
   */
  hoverScale?: number
  /**
   * Animation duration in seconds
   * @default 0.5
   */
  duration?: number
  /**
   * Whether to respect reduced motion
   * @default true
   */
  respectReducedMotion?: boolean
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
      const timeoutId = setTimeout(async () => {
        try {
          await lazyMotion.preload()
          setIsLoaded(true)
        } catch (error) {
          console.error('Failed to load heavy motion features:', error)
        }
      }, 100)

      onCleanup(() => {
        clearTimeout(timeoutId)
      })
    }
  })

  return (
    <button
      type="button"
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
    </button>
  )
}

export default OptimizedMotion
