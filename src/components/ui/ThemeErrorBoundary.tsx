import {
  type Component,
  ErrorBoundary as SolidErrorBoundary,
  Show,
  createSignal,
  type JSX,
} from 'solid-js'
import { AlertTriangle, RefreshCw, X } from 'lucide-solid'
import {
  cn,
  getStatusClasses,
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
} from '../../lib/utils'

interface ThemeErrorBoundaryProps {
  children: JSX.Element
  fallback?: (error: Error, reset: () => void) => JSX.Element
  onError?: (error: Error) => void
}

export const ThemeErrorBoundary: Component<ThemeErrorBoundaryProps> = (
  props
) => {
  const [isVisible, setIsVisible] = createSignal(true)

  const defaultFallback = (err: Error, resetFn: () => void) => (
    <Show when={isVisible()}>
      <div
        class={cn(
          'fixed top-4 right-4 z-50 max-w-sm rounded-lg shadow-lg border p-4 animate-in slide-in-from-top-2 duration-300',
          getBackgroundClasses('primary'),
          getBorderClasses('secondary')
        )}
      >
        <div class="flex items-start space-x-3">
          <div class={cn('p-1 rounded-lg', getStatusClasses('warning', 'bg'))}>
            <AlertTriangle
              class={cn('w-4 h-4', getStatusClasses('warning', 'text'))}
            />
          </div>

          <div class="flex-1 min-w-0">
            <h3
              class={cn('text-sm font-medium mb-1', getTextClasses('primary'))}
            >
              Theme Error
            </h3>
            <p class={cn('text-xs mb-2', getTextClasses('secondary'))}>
              {err.message || 'An error occurred while switching themes'}
            </p>

            <Show when={import.meta.env.DEV}>
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
              <button
                type="button"
                onClick={() => {
                  resetFn()
                  setIsVisible(false)
                  // Re-show after a delay for subsequent errors
                  setTimeout(() => setIsVisible(true), 100)
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
            </div>
          </div>
        </div>
      </div>
    </Show>
  )

  return (
    <SolidErrorBoundary
      fallback={(err: Error, reset: () => void) => {
        // Call error handler if provided
        if (props.onError) {
          try {
            props.onError(err)
          } catch (handlerError) {
            console.error(
              'Error in theme error boundary handler:',
              handlerError
            )
          }
        }

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
