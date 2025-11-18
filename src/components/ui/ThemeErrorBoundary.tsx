import {
  type Component,
  ErrorBoundary as SolidErrorBoundary,
  Show,
  createSignal,
} from 'solid-js'
import { AlertTriangle, RefreshCw, X } from 'lucide-solid'
import {
  cn,
  getStatusClasses,
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
} from '../../lib/utils'
import { createTimeoutManager, safeFn } from './performance-utils'

import type { BaseComponentProps, ErrorHandlingProps } from './interfaces'

/**
 * Enhanced theme error boundary interface with comprehensive options
 */
export interface ThemeErrorBoundaryProps
  extends BaseComponentProps,
    ErrorHandlingProps {
  /**
   * Content to render that might throw theme-related errors
   */
  children: JSX.Element
  /**
   * Custom error fallback renderer for theme errors
   * @param error - The theme error that was thrown
   * @param reset - Function to reset error boundary and retry
   * @returns Custom JSX element to render as fallback
   */
  fallback?: (error: Error, reset: () => void) => JSX.Element
  /**
   * Error handler callback specifically for theme errors
   * @param error - The theme error that was thrown
   */
  onError?: (error: Error) => void
  /**
   * Whether to show detailed error information in development
   * @default true
   */
  showDetails?: boolean
  /**
   * Whether to automatically dismiss error after delay
   * @default false
   */
  autoDismiss?: boolean
  /**
   * Delay before auto-dismissing in milliseconds
   * @default 5000
   */
  autoDismissDelay?: number
  /**
   * Whether to show retry button
   * @default true
   */
  showRetry?: boolean
  /**
   * Whether to show dismiss button
   * @default true
   */
  showDismiss?: boolean
  /**
   * Custom error message for theme errors
   */
  errorMessage?: string
  /**
   * Position of error notification
   * @default 'top-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /**
   * Whether to animate error notification
   * @default true
   */
  animate?: boolean
  /**
   * Maximum number of errors to display
   * @default 3
   */
  maxErrors?: number
  /**
   * Whether to group similar errors
   * @default true
   */
  groupErrors?: boolean
}

export const ThemeErrorBoundary: Component<ThemeErrorBoundaryProps> = (
  props
) => {
  const [isVisible, setIsVisible] = createSignal(true)

  // Performance optimization: Create timeout manager for auto-dismiss
  const timeoutManager = createTimeoutManager()

  const defaultFallback = (err: Error, resetFn: () => void) => {
    // Performance optimization: Auto-dismiss if enabled
    if (props.autoDismiss && props.autoDismissDelay) {
      timeoutManager.setTimeout(() => {
        setIsVisible(false)
      }, props.autoDismissDelay)
    }

    return (
      <Show when={isVisible()}>
        <div
          class={cn(
            'fixed top-4 right-4 z-50 max-w-sm rounded-lg shadow-lg border p-4 animate-in slide-in-from-top-2 duration-300',
            getBackgroundClasses('primary'),
            getBorderClasses('secondary')
          )}
        >
          <div class="flex items-start space-x-3">
            <div
              class={cn('p-1 rounded-lg', getStatusClasses('warning', 'bg'))}
            >
              <AlertTriangle
                class={cn('w-4 h-4', getStatusClasses('warning', 'text'))}
              />
            </div>

            <div class="flex-1 min-w-0">
              <h3
                class={cn(
                  'text-sm font-medium mb-1',
                  getTextClasses('primary')
                )}
              >
                Theme Error
              </h3>
              <p class={cn('text-xs mb-2', getTextClasses('secondary'))}>
                {props.errorMessage ||
                  err.message ||
                  'An error occurred while switching themes'}
              </p>

              <Show when={props.showDetails !== false && import.meta.env.DEV}>
                <details class="mb-2">
                  <summary
                    class={cn(
                      'cursor-pointer text-xs font-medium',
                      getTextClasses('tertiary')
                    )}
                  >
                    Technical Details
                  </summary>
                  <pre
                    class={cn(
                      'text-xs p-2 rounded mt-1 overflow-auto max-h-32',
                      getBackgroundClasses('secondary'),
                      getStatusClasses('warning', 'text')
                    )}
                  >
                    {err.stack || err.message}
                  </pre>
                </details>
              </Show>

              <div class="flex items-center space-x-2">
                <Show when={props.showRetry !== false}>
                  <button
                    type="button"
                    onClick={() => {
                      safeFn(
                        () => {
                          resetFn()
                          setIsVisible(false)
                          // Re-show after a delay for subsequent errors
                          timeoutManager.setTimeout(
                            () => setIsVisible(true),
                            100
                          )
                        },
                        (error) => {
                          console.error('Error in retry handler:', error)
                        }
                      )
                    }}
                    class={cn(
                      'flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors',
                      getStatusClasses('info', 'bg'),
                      'hover:opacity-90',
                      getTextClasses('primary')
                    )}
                  >
                    <RefreshCw class="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                </Show>

                <Show when={props.showDismiss !== false}>
                  <button
                    type="button"
                    onClick={() => setIsVisible(false)}
                    class={cn(
                      'p-1 rounded text-xs transition-colors',
                      getBackgroundClasses('secondary'),
                      'hover:opacity-80',
                      getTextClasses('tertiary')
                    )}
                    title="Dismiss"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
    )
  }

  return (
    <SolidErrorBoundary
      fallback={(err: Error, reset: () => void) => {
        // Performance optimization: Safe error handler
        safeFn(
          () => {
            props.onError?.(err)
          },
          (handlerError) => {
            console.error(
              'Error in theme error boundary handler:',
              handlerError
            )
          }
        )

        if (props.fallback) {
          return props.fallback(err, reset)
        }
        return defaultFallback(err, reset)
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  )
}

export default ThemeErrorBoundary
