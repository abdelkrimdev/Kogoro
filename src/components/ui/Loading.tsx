import { type Component, Show, createSignal, onError } from 'solid-js'
import { Loader, AlertTriangle } from 'lucide-solid'
import { cn } from '../../lib/class-utils'
import { getStatusClasses } from '../../lib/theme-helpers'
import {
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
} from '../../lib/theme-classes'
import { MotionErrorBoundary } from './MotionErrorBoundary'
import type {
  BaseComponentProps,
  SizeVariant,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced loading component interface with comprehensive options
 */
export interface LoadingProps extends BaseComponentProps, ErrorHandlingProps {
  /**
   * Loading spinner size
   * @default 'md'
   */
  size?: SizeVariant
  /**
   * Optional text to display below the spinner
   */
  text?: string
  /**
   * Whether to render as an overlay with backdrop
   * @default false
   */
  overlay?: boolean
  /**
   * Whether to show a backdrop blur effect
   * @default true when overlay is true
   */
  backdropBlur?: boolean
  /**
   * Custom spinner component to use instead of default
   */
  customSpinner?: JSX.Element
  /**
   * Whether to center the loading indicator
   * @default true
   */
  centered?: boolean
  /**
   * Custom color for the spinner (theme color name)
   */
  color?:
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
  /**
   * Whether to show error state if loading fails
   * @default true
   */
  showErrorFallback?: boolean
  /**
   * Custom error message for loading failures
   */
  errorMessage?: string
  /**
   * Timeout for loading operation in milliseconds
   * @default 10000
   */
  timeout?: number
  /**
   * Callback when loading times out
   */
  onTimeout?: () => void
}

/**
 * Loading component with customizable spinner and overlay options
 *
 * Provides a consistent loading experience across the application with
 * theme integration, accessibility support, and comprehensive error handling.
 *
 * @example
 * ```tsx
 * <Loading
 *   size="lg"
 *   text="Loading data..."
 *   overlay
 *   color="primary"
 *   onError={(error) => console.error('Loading error:', error)}
 *   timeout={5000}
 * />
 * ```
 */
export const Loading: Component<LoadingProps> = (props) => {
  const [hasError, setHasError] = createSignal(false)
  const [hasTimedOut, setHasTimedOut] = createSignal(false)

  // Error boundary for loading component
  onError((error) => {
    console.error('Loading component error:', error)
    setHasError(true)
    props.onError?.(error)
  })

  // Setup timeout handling
  const setupTimeout = () => {
    const timeout = props.timeout ?? 10000
    if (timeout > 0) {
      const timeoutId = setTimeout(() => {
        setHasTimedOut(true)
        props.onTimeout?.()
        console.warn(`Loading timed out after ${timeout}ms`)
      }, timeout)

      return () => clearTimeout(timeoutId)
    }
    return () => {}
  }

  // Cleanup timeout on unmount
  const _cleanup = setupTimeout()
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  }

  const getColorClasses = () => {
    if (!props.color) return getStatusClasses('info', 'text')

    switch (props.color) {
      case 'primary':
        return getTextClasses('primary')
      case 'secondary':
        return getTextClasses('secondary')
      case 'accent':
        return getStatusClasses('accent', 'text')
      case 'info':
        return getStatusClasses('info', 'text')
      case 'success':
        return getStatusClasses('success', 'text')
      case 'warning':
        return getStatusClasses('warning', 'text')
      case 'error':
        return getStatusClasses('error', 'text')
      default:
        return getStatusClasses('info', 'text')
    }
  }

  const centered = () => props.centered ?? true
  const backdropBlur = () => props.backdropBlur ?? true

  const renderSpinner = () =>
    props.customSpinner || (
      <Loader
        data-testid="loading-spinner"
        class={cn(
          sizeClasses[props.size || 'md'],
          'animate-spin',
          getColorClasses()
        )}
      />
    )

  const renderText = () => (
    <Show when={props.text}>
      <span
        class={cn(
          textSizeClasses[props.size || 'md'],
          props.overlay
            ? getTextClasses('primary')
            : getTextClasses('secondary')
        )}
      >
        {props.text}
      </span>
    </Show>
  )

  const renderErrorState = () => {
    if (!props.showErrorFallback && !props.fallback) return null

    if (props.fallback) {
      return props.fallback(new Error('Loading failed'), () => {
        setHasError(false)
        setHasTimedOut(false)
      })
    }

    return (
      <div
        class={cn(
          'flex flex-col items-center space-y-3 p-4 rounded-lg border',
          getBackgroundClasses('secondary'),
          getBorderClasses('tertiary')
        )}
      >
        <AlertTriangle
          class={cn('w-6 h-6', getStatusClasses('error', 'text'))}
        />
        <p class={cn('text-sm text-center', getTextClasses('secondary'))}>
          {props.errorMessage ||
            (hasTimedOut()
              ? 'Loading is taking longer than expected'
              : 'Failed to load')}
        </p>
        <button
          type="button"
          onClick={() => {
            setHasError(false)
            setHasTimedOut(false)
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
    )
  }

  const renderContent = () => {
    if ((hasError() || hasTimedOut()) && props.showErrorFallback !== false) {
      return renderErrorState()
    }

    return (
      <div
        class={cn(
          'flex flex-col items-center space-y-3',
          centered() && 'justify-center'
        )}
      >
        {renderSpinner()}
        {renderText()}
      </div>
    )
  }

  return (
    <MotionErrorBoundary
      onError={(error) => {
        setHasError(true)
        props.onError?.(error)
      }}
    >
      <Show when={props.overlay} fallback={renderContent()}>
        <div
          class={cn(
            'fixed inset-0 flex items-center justify-center z-50 bg-black/50',
            backdropBlur() && 'backdrop-blur-sm',
            props.class
          )}
        >
          <div class={cn('rounded-lg p-6', getBackgroundClasses('primary'))}>
            {renderContent()}
          </div>
        </div>
      </Show>
    </MotionErrorBoundary>
  )
}
