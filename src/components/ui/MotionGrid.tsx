import {
  type Component,
  splitProps,
  createSignal,
  onMount,
  For,
  Show,
  createMemo,
  onCleanup,
  onError,
  type JSX,
} from 'solid-js'
import { cn } from '../../lib/utils'
import { isMotionEnabled, getEasing } from '../../lib/motion'
import { MotionErrorBoundary } from './MotionErrorBoundary'
import type {
  AnimatedComponentProps,
  GridComponentProps,
  AnimationVariant,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced motion grid interface with comprehensive options
 */
export interface MotionGridProps
  extends AnimatedComponentProps,
    GridComponentProps,
    ErrorHandlingProps {
  /**
   * Grid children elements to animate
   */
  children: JSX.Element
  /**
   * Grid columns configuration
   * @default 'repeat(auto-fit, minmax(250px, 1fr))'
   */
  columns?: number | string
  /**
   * Gap between grid items
   * @default '1rem'
   */
  gap?: string
  /**
   * Stagger delay between items in seconds
   * @default 0.1
   */
  stagger?: number
  /**
   * Animation variant for grid items
   * @default 'fade'
   */
  variant?: AnimationVariant
  /**
   * Animation direction for slide animations
   * @default 'up'
   */
  direction?: 'up' | 'down' | 'left' | 'right'
  /**
   * Animation duration in seconds
   * @default 0.5
   */
  duration?: number
  /**
   * Initial animation delay in seconds
   * @default 0
   */
  delay?: number
  /**
   * Whether to animate grid items
   * @default true
   */
  animate?: boolean
  /**
   * Callback when animation starts
   */
  onAnimationStart?: () => void
  /**
   * Callback when animation completes
   */
  onAnimationComplete?: () => void
  /**
   * Easing function for animations
   * @default 'easeOut'
   */
  easing?: string
  /**
   * Whether to trigger animation on scroll
   * @default false
   */
  animateOnScroll?: boolean
  /**
   * Scroll threshold for triggering animations (0-1)
   * @default 0.1
   */
  scrollThreshold?: number
  /**
   * Whether to trigger animation only once
   * @default true
   */
  triggerOnce?: boolean
}

export const MotionGrid: Component<MotionGridProps> = (props) => {
  const [local, others] = splitProps(props, [
    'children',
    'class',
    'columns',
    'gap',
    'stagger',
    'variant',
    'direction',
    'duration',
    'delay',
    'animate',
    'onAnimationStart',
    'onAnimationComplete',
    'onError',
    'maxRetries',
    'retryDelay',
  ])

  const [items, setItems] = createSignal<JSX.Element[]>([])
  const [isAnimated, setIsAnimated] = createSignal(false)
  const [hasError, setHasError] = createSignal(false)
  const [failedItems, setFailedItems] = createSignal<Set<number>>(new Set())

  // Memoized calculation to avoid reactive dependencies in timeouts
  const totalDuration = createMemo(() => {
    const itemCount = items().length
    const duration = local.duration || 0.5
    const stagger = local.stagger || 0.1
    return duration + Math.max(0, itemCount - 1) * stagger
  })

  // Error boundary for grid component
  onError((error) => {
    console.error('MotionGrid component error:', error)
    setHasError(true)
    local.onError?.(error)
  })

  onMount(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = []

    // Cleanup function for timeouts
    const cleanupTimeouts = () => {
      timeoutIds.forEach((id) => {
        clearTimeout(id)
      })
      timeoutIds.length = 0
    }

    // Register cleanup on unmount
    onCleanup(cleanupTimeouts)

    try {
      // Convert children to array for staggered animation
      const childrenArray = Array.isArray(local.children)
        ? local.children
        : [local.children]

      // Filter and validate children
      const validChildren = childrenArray.filter((child, index) => {
        if (!child) {
          setFailedItems((prev) => new Set(prev).add(index))
          return false
        }
        return true
      })

      setItems(validChildren)

      // Trigger animation after mount with proper cleanup
      if (local.animate !== false && !hasError()) {
        const delay = local.delay || 0

        // Start animation after initial delay
        const animationTimeoutId = setTimeout(() => {
          try {
            local.onAnimationStart?.()
            setIsAnimated(true)

            // Schedule completion callback using memoized duration
            const completionTimeoutId = setTimeout(
              () => {
                try {
                  local.onAnimationComplete?.()
                } catch (error) {
                  console.error(
                    'Error in MotionGrid onAnimationComplete:',
                    error
                  )
                  local.onError?.(error as Error)
                }
              },
              totalDuration() * 1000 + delay
            )

            timeoutIds.push(completionTimeoutId)
          } catch (error) {
            console.error('Error starting MotionGrid animation:', error)
            setHasError(true)
            local.onError?.(error as Error)
          }
        }, delay)

        timeoutIds.push(animationTimeoutId)
      }
    } catch (error) {
      console.error('Error in MotionGrid onMount:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  })

  // Helper function to get base animation properties
  const getAnimationProps = (index: number) => {
    const baseDelay = local.delay || 0
    const staggerDelay = index * (local.stagger || 0.1)
    const totalDelay = baseDelay + staggerDelay
    const duration = local.duration || 0.5
    const easing = getEasing('easeOut')

    return { totalDelay, duration, easing }
  }

  // Helper function for slide animation
  const getSlideStyle = (index: number) => {
    const { totalDelay, duration, easing } = getAnimationProps(index)
    const slideOffset =
      local.direction === 'left' || local.direction === 'right' ? 50 : 30

    const getTranslateX = () => {
      switch (local.direction) {
        case 'left':
          return -slideOffset
        case 'right':
          return slideOffset
        default:
          return 0
      }
    }

    const getTranslateY = () => {
      switch (local.direction) {
        case 'up':
          return -slideOffset
        case 'down':
          return slideOffset
        default:
          return 0
      }
    }

    return {
      opacity: isAnimated() ? 1 : 0,
      transform: isAnimated()
        ? 'translate(0, 0)'
        : `translate(${getTranslateX()}px, ${getTranslateY()}px)`,
      transition: `all ${duration}s ${easing} ${totalDelay}s`,
    }
  }

  // Helper function for scale animation
  const getScaleStyle = (index: number) => {
    const { totalDelay, duration, easing } = getAnimationProps(index)
    return {
      opacity: isAnimated() ? 1 : 0,
      transform: isAnimated() ? 'scale(1)' : 'scale(0.8)',
      transition: `all ${duration}s ${easing} ${totalDelay}s`,
    }
  }

  // Helper function for flip animation
  const getFlipStyle = (index: number) => {
    const { totalDelay, duration, easing } = getAnimationProps(index)
    return {
      opacity: isAnimated() ? 1 : 0,
      transform: isAnimated() ? 'rotateY(0deg)' : 'rotateY(-90deg)',
      transition: `all ${duration}s ${easing} ${totalDelay}s`,
    }
  }

  // Helper function for fade animation
  const getFadeStyle = (index: number) => {
    const { totalDelay, duration, easing } = getAnimationProps(index)
    return {
      opacity: isAnimated() ? 1 : 0,
      transition: `opacity ${duration}s ${easing} ${totalDelay}s`,
    }
  }

  const getItemStyle = (index: number) => {
    if (!(isMotionEnabled() && isAnimated()) || hasError()) return {}

    // Skip animation for failed items
    if (failedItems().has(index)) {
      return { opacity: 0.5, filter: 'grayscale(100%)' }
    }

    try {
      switch (local.variant) {
        case 'slide':
          return getSlideStyle(index)
        case 'scale':
          return getScaleStyle(index)
        case 'flip':
          return getFlipStyle(index)
        default: // fade
          return getFadeStyle(index)
      }
    } catch (error) {
      console.error(`Error getting style for grid item ${index}:`, error)
      return { opacity: 0.5 }
    }
  }

  const gridStyle = () => ({
    display: 'grid',
    'grid-template-columns': local.columns
      ? typeof local.columns === 'number'
        ? `repeat(${local.columns}, 1fr)`
        : local.columns
      : 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: local.gap || '1rem',
  })

  const renderErrorFallback = () => {
    if (!hasError()) return null

    return (
      <div
        class={cn(
          'col-span-full p-4 rounded-lg border text-center',
          getBackgroundClasses('secondary'),
          getBorderClasses('tertiary')
        )}
      >
        <div class="flex flex-col items-center space-y-2">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>Grid Error</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p class="text-sm">Some items failed to load</p>
          <button
            type="button"
            onClick={() => {
              setHasError(false)
              setFailedItems(new Set())
              // Retry animation
              setIsAnimated(false)
              setTimeout(() => setIsAnimated(true), 100)
            }}
            class={cn(
              'px-3 py-1 text-xs rounded transition-colors',
              getStatusClasses('info', 'bg'),
              'hover:opacity-90',
              getTextClasses('primary')
            )}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <MotionErrorBoundary
      onError={(error) => {
        setHasError(true)
        local.onError?.(error)
      }}
    >
      <div
        class={cn(
          // Base layout classes
          'motion-grid',
          // Error state
          hasError() && 'opacity-75',
          // Props classes (always last)
          local.class
        )}
        style={gridStyle()}
        {...others}
      >
        <Show when={items().length > 0}>
          <For each={items()}>
            {(item, index) => (
              <div style={getItemStyle(index())}>
                <MotionErrorBoundary
                  onError={(error) => {
                    console.error(`Grid item ${index()} error:`, error)
                    setFailedItems((prev) => new Set(prev).add(index()))
                    local.onError?.(error)
                  }}
                  fallback={(_error, _reset) => (
                    <div
                      class={cn(
                        'w-full h-full min-h-[100px] flex items-center justify-center rounded border',
                        getBackgroundClasses('secondary'),
                        getBorderClasses('tertiary')
                      )}
                    >
                      <div class="text-center">
                        <svg
                          class="w-4 h-4 mx-auto mb-1 opacity-50"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <title>Item Error</title>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        <p class="text-xs opacity-50">Failed to load</p>
                      </div>
                    </div>
                  )}
                >
                  {item}
                </MotionErrorBoundary>
              </div>
            )}
          </For>
        </Show>

        {/* Error fallback */}
        {renderErrorFallback()}
      </div>
    </MotionErrorBoundary>
  )
}

export default MotionGrid
