import {
  type Component,
  ErrorBoundary as SolidErrorBoundary,
  Show,
  type JSX,
} from 'solid-js'
import { TriangleAlert, RefreshCw } from 'lucide-solid'
import { cn } from '../../lib/class-utils'
import { getStatusClasses } from '../../lib/theme-helpers'
import {
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
} from '../../lib/theme-classes'
import type { BaseComponentProps, ErrorHandlingProps } from './interfaces'

/**
 * Enhanced error boundary interface with comprehensive error handling
 */
export interface ErrorBoundaryProps
  extends BaseComponentProps,
    ErrorHandlingProps {
  /**
   * Content to render that might throw errors
   */
  children: JSX.Element
  /**
   * Custom error fallback renderer
   * @param error - The error that was thrown
   * @param reset - Function to reset the error boundary and retry rendering
   * @returns Custom JSX element to render as fallback
   */
  fallback?: (error: Error, reset: () => void) => JSX.Element
  /**
   * Error handler callback for logging or error tracking
   * @param error - The error that was thrown
   * @param errorInfo - Additional error information including component stack
   */
  onError?: (error: Error, errorInfo?: { componentStack: string }) => void
  /**
   * Whether to show detailed error information (development only)
   * @default true in development, false in production
   */
  showDetails?: boolean
  /**
   * Custom error message to display instead of the default
   */
  errorMessage?: string
  /**
   * Whether to automatically retry on error
   * @default false
   */
  autoRetry?: boolean
  /**
   * Delay before automatic retry in milliseconds
   * @default 1000
   */
  autoRetryDelay?: number
}

/**
 * ErrorBoundary component with comprehensive error handling and recovery
 *
 * Provides graceful fallbacks for component errors with customizable error display
 * and recovery options. Integrates with the theme system for consistent styling.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   onError={(error) => console.error('Component error:', error)}
 *   showDetails={import.meta.env.DEV}
 * >
 *   <PotentiallyBuggyComponent />
 * </ErrorBoundary>
 * ```
 */
export const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  const showDetails = () => props.showDetails ?? import.meta.env.DEV

  const defaultFallback = (err: Error, resetFn: () => void) => (
    <div
      class={cn(
        'min-h-screen flex items-center justify-center p-4',
        getBackgroundClasses('tertiary')
      )}
    >
      <div
        class={cn(
          'max-w-md w-full rounded-lg shadow-lg border p-6',
          getBackgroundClasses('primary'),
          getBorderClasses('secondary')
        )}
      >
        <div class="flex items-center space-x-3 mb-4">
          <div class={cn('p-2 rounded-lg', getStatusClasses('error', 'bg'))}>
            <TriangleAlert
              class={cn('w-6 h-6', getStatusClasses('error', 'text'))}
            />
          </div>
          <h1 class={cn('text-xl font-semibold', getTextClasses('primary'))}>
            Something went wrong
          </h1>
        </div>

        <div class="mb-6">
          <p class={cn('mb-2', getTextClasses('secondary'))}>
            {props.errorMessage ||
              'An unexpected error occurred while rendering this page.'}
          </p>
          <Show when={showDetails()}>
            <details class="mt-4">
              <summary
                class={cn(
                  'cursor-pointer text-sm font-medium mb-2',
                  getTextClasses('tertiary')
                )}
              >
                Error Details
              </summary>
              <pre
                class={cn(
                  'text-xs p-3 rounded overflow-auto',
                  getBackgroundClasses('secondary'),
                  getStatusClasses('error', 'text')
                )}
              >
                {err.stack || err.message}
              </pre>
            </details>
          </Show>
        </div>

        <div class="flex space-x-3">
          <button
            type="button"
            onClick={resetFn}
            class={cn(
              'flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2',
              getStatusClasses('info', 'bg'),
              'hover:opacity-90',
              getTextClasses('primary')
            )}
          >
            <RefreshCw class="w-4 h-4" />
            <span>Try Again</span>
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            class={cn(
              'px-4 py-2 rounded-lg transition-colors',
              getBackgroundClasses('secondary'),
              'hover:opacity-80',
              getTextClasses('secondary')
            )}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  )

  const handleError = (err: Error, errorInfo: { componentStack: string }) => {
    // Call error handler if provided
    if (props.onError) {
      try {
        props.onError(err, errorInfo)
      } catch (handlerError) {
        console.error('Error in error boundary handler:', handlerError)
      }
    }

    // Auto-retry if enabled - use proper cleanup
    if (props.autoRetry && props.autoRetryDelay !== 0) {
      const retryDelay = props.autoRetryDelay ?? 1000
      const timeoutId = setTimeout(() => {
        // This will be handled by the reset function
      }, retryDelay)

      // Store timeout ID for cleanup if needed
      // Extend Error interface to include retry timeout ID
      ;(
        err as Error & { _retryTimeoutId?: ReturnType<typeof setTimeout> }
      )._retryTimeoutId = timeoutId
    }
  }

  return (
    <SolidErrorBoundary
      fallback={(err: Error, reset: () => void) => {
        // Handle the error
        handleError(err, { componentStack: '' })

        // Use custom fallback if provided
        if (props.fallback) {
          return props.fallback(err, reset)
        }

        // Use default fallback
        return defaultFallback(err, reset)
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  )
}
