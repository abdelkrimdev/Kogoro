/**
 * MotionSidebar - Animated sidebar component with slide/collapse animations
 * Features smooth expand/collapse transitions and responsive behavior
 * Perfect for navigation menus, filters, and secondary content panels
 */

import {
  type Component,
  splitProps,
  Show,
  onMount,
  createSignal,
  onError,
  createMemo,
  type JSX,
} from 'solid-js'
import {
  cn,
  getBackgroundClasses,
  getBorderClasses,
  getThemeTransitionClasses,
  getStatusClasses,
  getTextClasses,
} from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useMotionAnimations'
import { MotionErrorBoundary } from './MotionErrorBoundary'
import {
  createEventListenerManager,
  createTimeoutManager,
  throttle,
  safeFn,
} from './performance-utils'

import type {
  SidebarLikeProps,
  AnimatedComponentProps,
  SizeVariant,
  DurationPreset,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced motion sidebar interface with comprehensive options
 */
export interface MotionSidebarProps
  extends SidebarLikeProps,
    AnimatedComponentProps,
    ErrorHandlingProps {
  /**
   * Whether sidebar is open and visible
   * @default false
   */
  isOpen?: boolean
  /**
   * Sidebar position relative to content
   * @default 'left'
   */
  position?: 'left' | 'right'
  /**
   * Sidebar behavior variant
   * @default 'overlay'
   */
  variant?: 'overlay' | 'push' | 'static'
  /**
   * Sidebar width variant
   * @default 'md'
   */
  width?: SizeVariant
  /**
   * Whether to show backdrop overlay
   * @default true for overlay variant
   */
  showBackdrop?: boolean
  /**
   * Whether clicking backdrop closes sidebar
   * @default true
   */
  closeOnBackdropClick?: boolean
  /**
   * Sidebar content to render
   */
  children?: JSX.Element
  /**
   * Animation duration preset
   * @default 'normal'
   */
  duration?: DurationPreset
  /**
   * Whether sidebar can be collapsed
   * @default false
   */
  collapsible?: boolean
  /**
   * Whether sidebar is collapsed (controlled state)
   * @default false
   */
  isCollapsed?: boolean
  /**
   * Whether to show close button in overlay mode
   * @default true
   */
  showCloseButton?: boolean
  /**
   * Whether to trap focus within sidebar when open
   * @default true
   */
  trapFocus?: boolean
  /**
   * Whether to prevent body scroll when overlay is open
   * @default true
   */
  preventBodyScroll?: boolean
  /**
   * Custom z-index for sidebar
   * @default 40
   */
  zIndex?: number
  /**
   * Whether to close on escape key
   * @default true
   */
  closeOnEscape?: boolean
  /**
   * Custom sidebar ID for accessibility
   */
  id?: string
  /**
   * ARIA label for sidebar
   */
  ariaLabel?: string
  /**
   * Whether to animate on mount
   * @default true
   */
  animateOnMount?: boolean
  /**
   * Custom collapsed width in pixels
   * @default 60
   */
  collapsedWidth?: number
  /**
   * Whether to show resize handle
   * @default false
   */
  resizable?: boolean
  /**
   * Minimum width when resizable
   * @default 200
   */
  minWidth?: number
  /**
   * Maximum width when resizable
   * @default 400
   */
  maxWidth?: number
}

/**
 * MotionSidebar component with slide and collapse animations
 *
 * @example
 * ```tsx
 * <MotionSidebar
 *   isOpen={isSidebarOpen}
 *   position="left"
 *   variant="overlay"
 *   onClose={handleClose}
 * >
 *   <nav>Navigation content</nav>
 * </MotionSidebar>
 * ```
 */
export const MotionSidebar: Component<MotionSidebarProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'isOpen',
    'position',
    'variant',
    'width',
    'showBackdrop',
    'closeOnBackdropClick',
    'onClose',
    'children',
    'class',
    'duration',
    'collapsible',
    'isCollapsed',
    'onError',
    'maxRetries',
    'retryDelay',
  ])

  const { shouldAnimate } = useReducedMotion()
  const [hasError, setHasError] = createSignal(false)

  // Performance optimization: Create managers for cleanup
  const eventManager = createEventListenerManager()
  const _timeoutManager = createTimeoutManager()

  // Error boundary for sidebar component
  onError((error) => {
    console.error('MotionSidebar component error:', error)
    setHasError(true)
    local.onError?.(error)
  })

  // Performance optimization: Throttled backdrop click handler
  const handleBackdropClick = throttle(() => {
    safeFn(
      () => local.onClose?.(),
      (error) => {
        console.error('Error in sidebar backdrop click handler:', error)
        setHasError(true)
        local.onError?.(error)
      }
    )
  }, 100)

  // Performance optimization: Safe keydown handler
  const handleBackdropKeyDown = (e: KeyboardEvent) => {
    safeFn(
      () => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          local.onClose?.()
        }
      },
      (error) => {
        console.error('Error in sidebar backdrop key handler:', error)
        setHasError(true)
        local.onError?.(error)
      }
    )
  }

  // Performance optimization: Setup document-level event listeners with proper cleanup
  onMount(() => {
    const handleEscape = (e: KeyboardEvent) => {
      safeFn(
        () => {
          if (e.key === 'Escape' && local.isOpen) {
            e.preventDefault()
            local.onClose?.()
          }
        },
        (error) => {
          console.error('Error in sidebar escape handler:', error)
          setHasError(true)
          local.onError?.(error)
        }
      )
    }

    // Use event manager for automatic cleanup
    eventManager.addEventListener(document, 'keydown', handleEscape)
  })

  // Performance optimization: Memoized expensive computations
  const sidebarWidthClasses = createMemo(() => {
    const widthClasses = {
      sm: 'w-64', // 256px
      md: 'w-[17.5rem]', // 280px - matches UI_CONFIG.sidebarWidth
      lg: 'w-96', // 384px
      xl: 'w-[28rem]', // 448px
    }
    return widthClasses[local.width || 'md']
  })

  const animationDuration = createMemo(() => {
    switch (local.duration) {
      case 'fast':
        return '200ms'
      case 'normal':
        return '300ms'
      case 'slow':
        return '500ms'
      default:
        return '300ms'
    }
  })

  // Performance optimization: Memoized class computations
  const baseSidebarClasses = createMemo(() => {
    const isStatic = local.variant === 'static'
    return cn(
      // Base layout classes
      `${isStatic ? 'relative' : 'fixed'} top-0 h-full shadow-lg z-40`,
      // Theme-aware classes
      'transform transition-transform ease-in-out',
      getThemeTransitionClasses('all'),
      getBackgroundClasses('primary'),
      getBorderClasses('primary'),
      // Size/variant classes
      sidebarWidthClasses(),
      // State classes
      local.collapsible && local.isCollapsed && 'w-[3.75rem]', // 60px - matches UI_CONFIG.sidebarCollapsedWidth
      // Props classes (always last)
      local.class
    )
  })

  const positionClasses = createMemo(() => {
    const isLeft = (local.position || 'left') === 'left'
    return isLeft ? 'left-0' : 'right-0'
  })

  const animatedTransformClasses = createMemo(() => {
    const isLeft = (local.position || 'left') === 'left'

    if (local.variant === 'overlay' || local.variant === 'push') {
      return local.isOpen
        ? 'translate-x-0'
        : isLeft
          ? '-translate-x-full'
          : 'translate-x-full'
    }

    return local.isOpen ? 'translate-x-0' : 'translate-x-full'
  })

  const staticTransformClasses = createMemo(() => {
    return local.isOpen ? 'translate-x-0' : 'translate-x-full'
  })

  const transformClasses = createMemo(() => {
    if (shouldAnimate()) {
      return animatedTransformClasses()
    } else {
      return staticTransformClasses()
    }
  })

  const sidebarClasses = createMemo(() => {
    return cn(baseSidebarClasses(), positionClasses(), transformClasses())
  })

  const backdropClasses = createMemo(() => {
    return cn(
      // Base layout classes
      'fixed inset-0 bg-black/50 z-30',
      // Theme-aware classes
      'transition-opacity',
      getThemeTransitionClasses('all'),
      // State classes
      local.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
    )
  })

  // Performance optimization: Memoized error state
  const renderErrorState = () => {
    if (!hasError()) return null

    return (
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          class={cn(
            'rounded-lg shadow-lg p-6 max-w-sm w-full',
            getBackgroundClasses('primary'),
            getBorderClasses('error')
          )}
        >
          <div class="text-center">
            <svg
              class="w-8 h-8 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>Sidebar Error</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3
              class={cn(
                'text-lg font-semibold mb-2',
                getTextClasses('primary')
              )}
            >
              Sidebar Error
            </h3>
            <p class={cn('text-sm mb-4', getTextClasses('secondary'))}>
              An error occurred while displaying the sidebar.
            </p>
            <div class="flex space-x-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setHasError(false)
                }}
                class={cn(
                  'px-4 py-2 text-sm rounded transition-colors',
                  getStatusClasses('info', 'bg'),
                  'hover:opacity-90',
                  getTextClasses('primary')
                )}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  safeFn(
                    () => local.onClose?.(),
                    (error) => console.error('Error closing sidebar:', error)
                  )
                }}
                class={cn(
                  'px-4 py-2 text-sm rounded transition-colors',
                  getBackgroundClasses('secondary'),
                  'hover:opacity-80',
                  getTextClasses('secondary')
                )}
              >
                Close
              </button>
            </div>
          </div>
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
      {/* Backdrop for overlay variant */}
      <Show when={local.variant === 'overlay' && local.showBackdrop}>
        <button
          type="button"
          tabIndex={0}
          class={backdropClasses()}
          onClick={handleBackdropClick}
          onKeyDown={handleBackdropKeyDown}
          aria-label="Close sidebar"
        />
      </Show>

      {/* Sidebar */}
      <Show when={local.isOpen || local.variant === 'static'}>
        <aside
          class={cn(sidebarClasses(), hasError() && 'border-red-500')}
          style={{
            'transition-duration': animationDuration(),
          }}
          tabIndex={local.isOpen ? 0 : -1}
          {...rest}
        >
          {/* Close button for overlay variant */}
          <Show when={local.variant === 'overlay' && !local.collapsible}>
            <button
              type="button"
              class={cn(
                // Base layout classes
                'absolute top-4 right-4 p-2 rounded-md',
                // Theme-aware classes
                'transition-colors',
                getThemeTransitionClasses('text'),
                // Size/variant classes
                getBackgroundClasses('secondary'),
                getBorderClasses('secondary')
              )}
              onClick={() => {
                safeFn(
                  () => local.onClose?.(),
                  (error) => {
                    console.error('Error closing sidebar:', error)
                    setHasError(true)
                    local.onError?.(error)
                  }
                )
              }}
              aria-label="Close sidebar"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Close sidebar</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Show>

          {/* Sidebar Content */}
          <div class="h-full overflow-y-auto">
            {/* Always render children to ensure collapse button is accessible */}
            <div class="p-4">
              <MotionErrorBoundary
                onError={(error) => {
                  setHasError(true)
                  local.onError?.(error)
                }}
              >
                {local.children}
              </MotionErrorBoundary>
            </div>
          </div>
        </aside>
      </Show>

      {/* Error state */}
      {renderErrorState()}
    </MotionErrorBoundary>
  )
}

export default MotionSidebar
