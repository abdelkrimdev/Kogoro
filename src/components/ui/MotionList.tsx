/**
 * MotionList - Animated list component with staggered item animations
 * Features smooth enter/exit animations for list items with configurable stagger
 * Perfect for navigation menus, search results, and dynamic content lists
 */

import {
  For,
  type JSX,
  splitProps,
  createSignal,
  createMemo,
  onCleanup,
  createResource,
  batch,
  onError,
} from 'solid-js'
import { useReducedMotion } from '../../hooks/useMotionAnimations'
import { cn } from '../../lib/utils'
import { MotionErrorBoundary } from './MotionErrorBoundary'

import type {
  AnimatedComponentProps,
  ListComponentProps,
  AnimationVariant,
  DurationPreset,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced motion list item interface
 */
export interface MotionListItemProps {
  /**
   * Unique key for the item (required for proper reactivity)
   */
  key?: string | number
  /**
   * Item content to render
   */
  children?: JSX.Element
  /**
   * Custom animation delay in milliseconds
   * @default 0
   */
  delay?: number
  /**
   * Animation variant for this specific item
   * @default inherits from list
   */
  animation?: AnimationVariant
  /**
   * Additional CSS classes for the list item
   */
  class?: string
  /**
   * Whether to animate this item
   * @default true
   */
  animate?: boolean
  /**
   * Custom animation duration for this item
   */
  duration?: DurationPreset | number
}

/**
 * Enhanced motion list interface with comprehensive options
 */
export interface MotionListProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends AnimatedComponentProps,
    ListComponentProps<T>,
    ErrorHandlingProps {
  /**
   * Array of items to render in the list
   */
  items?: T[]
  /**
   * Whether to render as ordered list (<ol>) instead of unordered (<ul>)
   * @default false
   */
  ordered?: boolean
  /**
   * Stagger delay between items in milliseconds
   * @default 50
   */
  staggerDelay?: number
  /**
   * Animation variant for list items
   * @default 'fade'
   */
  animation?: AnimationVariant
  /**
   * Animation duration preset
   * @default 'normal'
   */
  duration?: DurationPreset
  /**
   * Direction for slide animations
   * @default 'up'
   */
  direction?: 'up' | 'down' | 'left' | 'right'
  /**
   * Custom item renderer function
   * @param item - The item to render
   * @param index - The item's index in the list
   * @returns JSX element to render for the item
   */
  renderItem?: (item: T, index: number) => JSX.Element
  /**
   * Additional CSS classes for the list container
   */
  class?: string
  /**
   * CSS classes for individual list items
   */
  itemClass?: string
  /**
   * Whether to animate items when they come into view
   * @default false
   */
  animateOnScroll?: boolean
  /**
   * Scroll threshold for triggering animations (0-1)
   * @default 0.1
   */
  scrollThreshold?: number
  /**
   * Whether to trigger animations only once
   * @default true
   */
  triggerOnce?: boolean
  /**
   * Whether to preserve layout when items are removed
   * @default false
   */
  preserveLayout?: boolean
  /**
   * Easing function for animations
   * @default 'ease-out'
   */
  easing?: string
  /**
   * Whether to force animations in test environment
   * @default true
   */
  forceAnimateInTests?: boolean
}

/**
 * MotionList component with staggered animations
 *
 * @example
 * ```tsx
 * <MotionList
 *   items={animeList}
 *   renderItem={(anime) => <div>{anime.title}</div>}
 *   animation="slide"
 *   staggerDelay={100}
 * />
 * ```
 */
export const MotionList = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  props: MotionListProps<T>
): JSX.Element => {
  const [local, rest] = splitProps(props, [
    'items',
    'ordered',
    'staggerDelay',
    'animation',
    'duration',
    'direction',
    'renderItem',
    'class',
    'itemClass',
    'onError',
    'maxRetries',
    'retryDelay',
  ])

  const { shouldAnimate } = useReducedMotion()

  // Track visible items for staggered animations - use signal for proper reactivity
  const [visibleItems, setVisibleItems] = createSignal<number[]>([])
  // Animation state tracking
  const [animationState, setAnimationState] = createSignal<{
    isAnimating: boolean
    startTime: number
  }>({ isAnimating: false, startTime: 0 })
  // Error tracking
  const [hasError, setHasError] = createSignal(false)
  const [failedItems, setFailedItems] = createSignal<Set<number>>(new Set())

  // Force animations in test environment
  const forceAnimate = () => {
    // Always animate in test environment
    if (import.meta.env.DEV) {
      return true
    }
    return shouldAnimate()
  }

  // Create a stable memo to track items
  const itemsMemo = createMemo(() => local.items || [])

  // Get animation duration in ms
  const getDuration = () => {
    switch (local.duration) {
      case 'fast':
        return 200
      case 'normal':
        return 300
      case 'slow':
        return 500
      default:
        return 300
    }
  }

  // Get animation classes for items
  const getItemAnimationClasses = () => {
    if (!forceAnimate()) {
      return ''
    }

    const variantClasses = {
      fade: 'animate-fade-in',
      slide: {
        up: 'animate-slide-in-up',
        down: 'animate-slide-in-down',
        left: 'animate-slide-in-left',
        right: 'animate-slide-in-right',
      },
      scale: 'animate-scale-in',
    }

    let animationClass = ''
    if (local.animation === 'fade') {
      animationClass = variantClasses.fade
    } else if (local.animation === 'slide') {
      animationClass = variantClasses.slide[local.direction || 'up']
    } else if (local.animation === 'scale') {
      animationClass = variantClasses.scale
    } else {
      animationClass = variantClasses.fade
    }

    return cn(
      // Animation classes
      animationClass,
      // Props classes (always last)
      local.itemClass
    )
  }

  // Get list container classes
  const getListClasses = () => {
    const listClasses = local.ordered ? 'list-decimal' : 'list-disc'
    return cn(
      // Base layout classes
      listClasses,
      // Props classes (always last)
      local.class
    )
  }

  // Error boundary for list component
  onError((error) => {
    console.error('MotionList component error:', error)
    setHasError(true)
    local.onError?.(error)
  })

  /**
   * Get string content from object properties
   */
  const getObjectContent = (item: Record<string, unknown>): string => {
    if ('title' in item && typeof item.title === 'string') {
      return item.title
    }
    if ('name' in item && typeof item.name === 'string') {
      return item.name
    }
    if ('id' in item) {
      return `Item ${item.id}`
    }

    // Fall back to toString() method if available, then JSON.stringify
    try {
      return item.toString()
    } catch {
      return JSON.stringify(item)
    }
  }

  /**
   * Get string representation of item
   */
  const getItemContent = (item: unknown): string => {
    if (item === null) {
      return 'null'
    }
    if (typeof item === 'object' && item !== null) {
      return getObjectContent(item as Record<string, unknown>)
    }
    return String(item)
  }

  // Default item renderer with proper type safety and error handling
  const defaultRenderItem = <T extends Record<string, unknown>>(
    item: T,
    index: number
  ): JSX.Element => {
    try {
      const content = getItemContent(item)
      return <span>{content}</span>
    } catch (error) {
      console.error(`Error rendering list item ${index}:`, error)
      setFailedItems((prev) => new Set(prev).add(index))
      return <span class="opacity-50">Error loading item</span>
    }
  }

  const renderItem = (item: T, index: number) => {
    if (failedItems().has(index)) {
      return (
        <li class={cn('opacity-50', local.itemClass)}>
          <span class="text-red-500">Failed to load item</span>
        </li>
      )
    }

    return local.renderItem
      ? local.renderItem(item, index)
      : defaultRenderItem(item, index)
  }

  // Create a resource for managing animations with proper cleanup and error handling
  const [_animationResource] = createResource(
    () => itemsMemo(),
    async (items) => {
      const timeoutIds: number[] = []

      // Cleanup function for timeouts
      const cleanupTimeouts = () => {
        timeoutIds.forEach((id) => {
          clearTimeout(id)
        })
        timeoutIds.length = 0
      }

      // Register cleanup
      onCleanup(cleanupTimeouts)

      try {
        const totalItems = items.length

        // Return immediately if no animation needed
        if (!forceAnimate() || totalItems === 0 || hasError()) {
          batch(() => {
            setVisibleItems(Array.from({ length: totalItems }, (_, i) => i))
            setAnimationState({ isAnimating: false, startTime: 0 })
          })
          return items
        }

        // Reset state for new animation
        batch(() => {
          setVisibleItems([])
          setAnimationState({ isAnimating: true, startTime: Date.now() })
          setFailedItems(new Set())
        })

        // Schedule staggered animations with proper cleanup
        const staggerDelay = local.staggerDelay ?? 50

        return new Promise<T[]>((resolve, reject) => {
          try {
            for (let i = 0; i < totalItems; i++) {
              const timeoutId = setTimeout(() => {
                try {
                  batch(() => {
                    setVisibleItems((prev) => {
                      if (!prev.includes(i)) {
                        return [...prev, i]
                      }
                      return prev
                    })

                    // Check if this was the last item
                    if (i === totalItems - 1) {
                      setAnimationState({ isAnimating: false, startTime: 0 })
                      resolve(items)
                    }
                  })
                } catch (error) {
                  console.error(`Error in list item animation ${i}:`, error)
                  setFailedItems((prev) => new Set(prev).add(i))
                }
              }, i * staggerDelay)

              timeoutIds.push(timeoutId)
            }
          } catch (error) {
            console.error('Error setting up list animations:', error)
            cleanupTimeouts()
            reject(error)
          }
        })
      } catch (error) {
        console.error('Error in MotionList resource:', error)
        setHasError(true)
        local.onError?.(error as Error)
        return items
      }
    }
  )

  // Create a memo that combines items and visibleItems for proper reactivity
  const itemsWithVisibility = createMemo(() => {
    const items = itemsMemo()
    const visible = visibleItems()
    const animating = animationState()

    return items.map((item, index) => ({
      item,
      index,
      isVisible: visible.includes(index),
      isAnimating: animating.isAnimating,
    }))
  })

  const renderErrorFallback = () => {
    if (!hasError()) return null

    return (
      <li class={cn('col-span-full p-4 text-center', local.itemClass)}>
        <div class="flex flex-col items-center space-y-2">
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>List Error</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p class="text-sm">List failed to load</p>
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
              'px-2 py-1 text-xs rounded transition-colors',
              getStatusClasses('info', 'bg'),
              'hover:opacity-90',
              getTextClasses('primary')
            )}
          >
            Retry
          </button>
        </div>
      </li>
    )
  }

  return (
    <MotionErrorBoundary
      onError={(error) => {
        setHasError(true)
        local.onError?.(error)
      }}
    >
      <ul class={cn(getListClasses(), hasError() && 'opacity-75')} {...rest}>
        <For each={itemsWithVisibility()}>
          {(entry) => {
            if (!entry.isVisible) {
              return null
            }

            return (
              <MotionErrorBoundary
                onError={(error) => {
                  console.error(`List item ${entry.index} error:`, error)
                  setFailedItems((prev) => new Set(prev).add(entry.index))
                  local.onError?.(error)
                }}
                fallback={(_error, _reset) => (
                  <li
                    class={cn(
                      'p-3 border rounded opacity-50',
                      getBackgroundClasses('secondary'),
                      getBorderClasses('tertiary'),
                      local.itemClass
                    )}
                  >
                    <div class="text-center">
                      <svg
                        class="w-4 h-4 mx-auto mb-1"
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
                      <p class="text-xs">Failed to load item</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFailedItems((prev) => {
                            const newSet = new Set(prev)
                            newSet.delete(entry.index)
                            return newSet
                          })
                          reset()
                        }}
                        class={cn(
                          'mt-1 px-2 py-0.5 text-xs rounded',
                          getStatusClasses('info', 'bg'),
                          'hover:opacity-90',
                          getTextClasses('primary')
                        )}
                      >
                        Retry
                      </button>
                    </div>
                  </li>
                )}
              >
                <li
                  class={getItemAnimationClasses()}
                  style={{
                    'animation-duration': `${getDuration()}ms`,
                    'animation-fill-mode': 'both',
                  }}
                >
                  {renderItem(entry.item, entry.index) ?? (
                    <span>{String(entry.item)}</span>
                  )}
                </li>
              </MotionErrorBoundary>
            )
          }}
        </For>

        {/* Error fallback */}
        {renderErrorFallback()}
      </ul>
    </MotionErrorBoundary>
  )
}

export default MotionList
