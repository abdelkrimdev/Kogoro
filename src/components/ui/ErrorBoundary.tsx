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

interface ErrorBoundaryProps {
  children: JSX.Element
  fallback?: (error: Error, reset: () => void) => JSX.Element
}

export const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
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
            An unexpected error occurred while rendering this page.
          </p>
          <Show when={import.meta.env.DEV}>
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

  return (
    <SolidErrorBoundary
      fallback={(err: Error, reset: () => void) => {
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
