/**
 * MotionButton - Animated button component with hover, tap, and loading states
 * Integrates with the motion system for smooth interactive animations
 * Perfect for anime collection actions like add, remove, favorite, etc.
 */

import {
  type Component,
  Show,
  splitProps,
  type JSX,
  createSignal,
  createMemo,
} from 'solid-js'
import {
  cn,
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
  getStatusClasses,
  getFocusClasses,
} from '../../lib/utils'
import {
  useInteractionAnimation,
  useLoadingAnimation,
} from '../../hooks/useMotionAnimations'
import { OptimizedMotion } from './OptimizedMotion'
import { MotionErrorBoundary } from './MotionErrorBoundary'
import {
  createTimeoutManager,
  throttle,
  safeFn,
  retry,
} from './performance-utils'
import type { MOTION_VARIANTS } from '../../lib/motion-variants'
import type {
  InteractiveComponentProps,
  LoadingComponentProps,
  SizeVariant,
  ButtonVariant,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced motion button interface with comprehensive options
 */
export interface MotionButtonProps
  extends InteractiveComponentProps,
    LoadingComponentProps,
    ErrorHandlingProps {
  /**
   * Button visual variant for styling
   * @default 'primary'
   */
  variant?: ButtonVariant
  /**
   * Button size variant
   * @default 'md'
   */
  size?: SizeVariant
  /**
   * HTML button type attribute
   * @default 'button'
   */
  type?: 'button' | 'submit' | 'reset'
  /**
   * Icon element to display
   */
  icon?: JSX.Element
  /**
   * Position of the icon relative to text
   * @default 'left'
   */
  iconPosition?: 'left' | 'right'
  /**
   * Whether button should take full width of container
   * @default false
   */
  fullWidth?: boolean
  /**
   * Custom animation variant from MOTION_VARIANTS
   */
  animationVariant?: keyof typeof MOTION_VARIANTS.button
  /**
   * Whether to show loading spinner
   * @default false
   */
  loading?: boolean
  /**
   * Text to display during loading state
   */
  loadingText?: string
  /**
   * Button href for link-like behavior (renders as <a> tag)
   */
  href?: string
  /**
   * Target attribute for link behavior
   */
  target?: string
  /**
   * Rel attribute for link behavior
   */
  rel?: string
  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string
  /**
   * ARIA describedby attribute
   */
  ariaDescribedBy?: string
  /**
   * Whether button should be auto-focused when rendered
   * @default false
   */
  autoFocus?: boolean
}

/**
 * MotionButton component with interactive animations and comprehensive theming
 *
 * Features smooth hover, tap, and loading animations with full accessibility support.
 * Integrates with the motion system for optimal performance and user experience.
 *
 * @example
 * ```tsx
 * <MotionButton
 *   variant="primary"
 *   size="md"
 *   loading={isLoading}
 *   loadingText="Adding..."
 *   onClick={handleAddAnime}
 *   icon={<PlusIcon />}
 * >
 *   Add to Collection
 * </MotionButton>
 * ```
 *
 * @example
 * ```tsx
 * // Link button
 * <MotionButton
 *   variant="ghost"
 *   href="/details"
 *   target="_blank"
 * >
 *   View Details
 * </MotionButton>
 * ```
 */
export const MotionButton: Component<MotionButtonProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'variant',
    'size',
    'disabled',
    'loading',
    'loadingText',
    'type',
    'onClick',
    'icon',
    'iconPosition',
    'fullWidth',
    'animationVariant',
    'children',
    'class',
    'onError',
    'maxRetries',
    'retryDelay',
  ])

  const [hasError, setHasError] = createSignal(false)
  const [retryCount, setRetryCount] = createSignal(0)

  // Performance optimization: Create timeout manager for retry logic
  const _timeoutManager = createTimeoutManager()

  // Performance optimization: Memoized disabled state
  const isDisabled = createMemo(() => local.disabled || local.loading)

  // Setup interaction animations
  const { eventHandlers, getAnimationStyles } = useInteractionAnimation({
    disabled: isDisabled(),
  })

  // Setup loading animation
  const { getLoadingProps } = useLoadingAnimation({
    type: 'spinner',
    size:
      local.size === 'sm' ? 'small' : local.size === 'lg' ? 'large' : 'medium',
    text: local.loadingText,
  })

  // Extract variant classes to reduce complexity
  const getVariantClasses = () => {
    const variantClasses = {
      primary: cn(
        getBackgroundClasses('accent'),
        'text-white border-accent hover:bg-accent-hover',
        getBorderClasses('primary')
      ),
      secondary: cn(
        getBackgroundClasses('secondary'),
        getTextClasses('primary'),
        getBorderClasses('secondary'),
        'hover:bg-muted'
      ),
      ghost: cn(
        'bg-transparent border-transparent',
        getTextClasses('primary'),
        'hover:bg-muted'
      ),
      danger: cn(
        getStatusClasses('error', 'bg'),
        'text-white border-red-600 hover:bg-red-700',
        getBorderClasses('primary')
      ),
    }
    return variantClasses[local.variant || 'primary']
  }

  const getSizeClasses = () => {
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm font-medium rounded-md',
      md: 'px-4 py-2 text-sm font-medium rounded-lg',
      lg: 'px-6 py-3 text-base font-medium rounded-lg',
    }
    return sizeClasses[local.size || 'md']
  }

  // Memoize base classes to prevent unnecessary recalculations
  const getBaseClasses = createMemo(() => {
    return cn(
      // Base layout classes
      'inline-flex items-center justify-center',
      // Theme-aware classes
      'border transition-colors',
      getFocusClasses('default'),
      // Size/variant classes
      getVariantClasses(),
      getSizeClasses(),
      // State classes
      'disabled:opacity-50 disabled:cursor-not-allowed',
      // Conditional classes
      local.fullWidth && 'w-full',
      // Props classes (always last)
      local.class
    )
  })

  // Performance optimization: Handle click with loading state, validation, and error handling
  const handleClick = async (event: Event | MouseEvent | KeyboardEvent) => {
    if (local.disabled || local.loading) return

    const maxRetries = local.maxRetries ?? 2
    const retryDelay = local.retryDelay ?? 1000

    // Use retry utility for better error handling
    // Add 1 to maxRetries to convert from "number of retries" to "number of attempts"
    await retry(
      async () => {
        if (typeof local.onClick === 'function') {
          const result = local.onClick(event)
          // Handle async onClick handlers
          if (result instanceof Promise) {
            await result
          }
        }
        setHasError(false)
        setRetryCount(0)
      },
      maxRetries + 1,
      retryDelay,
      (attempt, error) => {
        console.error(
          `Error in MotionButton onClick handler (attempt ${attempt}):`,
          error
        )
        setRetryCount(attempt)
        if (attempt >= maxRetries + 1) {
          setHasError(true)
          local.onError?.(error)
        }
      }
    )
  }

  // Performance optimization: Handle retry action
  const handleRetry = throttle(() => {
    safeFn(
      () => {
        setHasError(false)
        setRetryCount(0)
        // Trigger click again if there's an onClick handler
        if (local.onClick && !local.disabled && !local.loading) {
          const syntheticEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
          })
          handleClick(syntheticEvent)
        }
      },
      (error) => {
        console.error('Error in retry handler:', error)
        setHasError(true)
        local.onError?.(error)
      }
    )
  }, 300)

  // Extract button content rendering to reduce complexity
  const renderErrorContent = () => (
    <div class="flex items-center space-x-2">
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <title>Error</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span class="text-sm">Error</span>
    </div>
  )

  const renderLoadingContent = () => (
    <div class="flex items-center space-x-2">
      <div {...getLoadingProps()} />
      <Show when={local.loadingText}>
        <span>{local.loadingText}</span>
      </Show>
    </div>
  )

  const renderNormalContent = () => (
    <>
      {/* Left icon */}
      <Show when={local.icon && local.iconPosition !== 'right'}>
        <span class="mr-2 flex items-center">{local.icon}</span>
      </Show>

      {/* Button content */}
      {local.children}

      {/* Right icon */}
      <Show when={local.icon && local.iconPosition === 'right'}>
        <span class="ml-2 flex items-center">{local.icon}</span>
      </Show>
    </>
  )

  const renderRetryButton = () => (
    <button
      type="button"
      onClick={handleRetry}
      class={cn(
        'mt-2 px-3 py-1 text-xs rounded transition-colors flex items-center space-x-1',
        getStatusClasses('warning', 'bg'),
        'hover:opacity-90',
        getTextClasses('primary')
      )}
    >
      <svg
        class="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <title>Retry</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <span>Retry {retryCount() > 0 ? `(${retryCount()})` : ''}</span>
    </button>
  )

  const buttonContent = (
    <>
      {/* Error state */}
      <Show when={hasError() && !local.loading}>{renderErrorContent()}</Show>

      {/* Loading state */}
      <Show when={local.loading}>{renderLoadingContent()}</Show>

      {/* Normal state */}
      <Show when={!local.loading && !hasError()}>{renderNormalContent()}</Show>
    </>
  )

  const commonProps = {
    class: getBaseClasses(),
    disabled: local.disabled || local.loading,
    onClick: handleClick,
    style: getAnimationStyles(),
    'aria-busy': local.loading,
    'aria-label':
      local.ariaLabel ||
      (local.loading && local.loadingText ? local.loadingText : undefined),
    'aria-describedby': local.ariaDescribedBy,
    'data-testid': 'motion-button',
    ...eventHandlers,
    ...rest,
  }

  return (
    <MotionErrorBoundary
      onError={(error) => {
        setHasError(true)
        local.onError?.(error)
      }}
    >
      <OptimizedMotion
        features={['animations']}
        preloadStrategy="hover"
        disabled={local.disabled || local.loading || hasError()}
        respectReducedMotion
        performanceMonitoring={import.meta.env.DEV}
      >
        <Show
          when={local.href}
          fallback={
            <button type={local.type || 'button'} {...commonProps}>
              {buttonContent}
            </button>
          }
        >
          <a
            href={local.href}
            target={local.target}
            rel={local.rel}
            {...commonProps}
          >
            {buttonContent}
          </a>
        </Show>

        {/* Retry button for error state */}
        <Show when={hasError() && !local.disabled}>{renderRetryButton()}</Show>
      </OptimizedMotion>
    </MotionErrorBoundary>
  )
}

export default MotionButton
