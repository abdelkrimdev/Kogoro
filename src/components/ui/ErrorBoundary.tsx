import {
  type Component,
  ErrorBoundary as SolidErrorBoundary,
  Show,
  type JSX,
} from 'solid-js'
import { TriangleAlert, RefreshCw } from 'lucide-solid'

interface ErrorBoundaryProps {
  children: JSX.Element
  fallback?: (error: Error, reset: () => void) => JSX.Element
}

export const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
  const defaultFallback = (err: Error, resetFn: () => void) => (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center space-x-3 mb-4">
          <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <TriangleAlert class="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
            Something went wrong
          </h1>
        </div>

        <div class="mb-6">
          <p class="text-gray-600 dark:text-gray-400 mb-2">
            An unexpected error occurred while rendering this page.
          </p>
          <Show when={import.meta.env.DEV}>
            <details class="mt-4">
              <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Error Details
              </summary>
              <pre class="text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-auto text-red-600 dark:text-red-400">
                {err.stack || err.message}
              </pre>
            </details>
          </Show>
        </div>

        <div class="flex space-x-3">
          <button
            type="button"
            onClick={resetFn}
            class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <RefreshCw class="w-4 h-4" />
            <span>Try Again</span>
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
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
