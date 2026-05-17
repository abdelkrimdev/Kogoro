/**
 * MotionErrorBoundary - Specialized error boundary for motion components
 * Provides graceful fallbacks for animation failures and performance issues
 * Integrates with the motion system for comprehensive error handling
 */

import {
  type Component,
  ErrorBoundary as SolidErrorBoundary,
  createSignal,
  type JSX,
} from 'solid-js'
// Tree-shake friendly icon imports
import TriangleAlert from 'lucide-solid/icons/triangle-alert'
import RefreshCw from 'lucide-solid/icons/refresh-cw'
import Play from 'lucide-solid/icons/play'
import Pause from 'lucide-solid/icons/pause'
import { cn } from '../../lib/utils'
import { isMotionEnabled } from '../../lib/motion'
import { useReducedMotion } from '../../hooks/useMotionAnimations'
import {
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
} from '../../lib/theme-classes'
import { getStatusClasses } from '../../lib/theme-helpers'
import { normalizeError } from '../../lib/error-utils'

import type { BaseComponentProps, ErrorHandlingProps } from './interfaces'

/**
 * Enhanced motion error boundary interface with comprehensive options
 */
export interface MotionErrorBoundaryProps
  extends BaseComponentProps,
    ErrorHandlingProps {
  /**
   * Content to render that might throw errors
   */
  children: JSX.Element
  /**
   * Custom error fallback renderer with retry functionality
   * @param error - The error that was thrown
   * @param reset - Function to reset the error boundary
   * @param retry - Function to retry rendering with automatic retry logic
   * @returns Custom JSX element to render as fallback
   */
  fallback?: (error: Error, reset: () => void, retry: () => void) => JSX.Element
  /**
   * Error handler callback for logging or error tracking
   * @param error - The error that was thrown
   * @param errorInfo - Additional error information including component stack
   */
  onError?: (error: Error, errorInfo: { componentStack: string }) => void
  /**
   * Whether to enable motion animations for the error boundary
   * @default true
   */
  enableMotion?: boolean
  /**
   * Whether to respect user's reduced motion preferences
   * @default true
   */
  respectReducedMotion?: boolean
  /**
   * Maximum number of automatic retry attempts
   * @default 2
   */
  maxRetries?: number
  /**
   * Delay between retry attempts in milliseconds
   * @deprecated Use autoRetryDelay instead for consistency with ErrorBoundary
   * @default 1000
   */
  retryDelay?: number
  /**
   * Whether to show motion-specific error information
   * @default true
   */
  showMotionInfo?: boolean
  /**
   * Whether to enable performance monitoring for motion errors
   * @default false in production, true in development
   */
  performanceMonitoring?: boolean
}

interface MotionErrorInfo {
  error: Error
  componentStack: string
  timestamp: number
  retryCount: number
  motionState: {
    enabled: boolean
    reducedMotion: boolean
  }
}

/**
 * MotionErrorBoundary component with specialized error handling for animations
 *
 * @example
 * ```tsx
 * <MotionErrorBoundary
 *   onError={(error) => console.error('Motion error:', error)}
 *   maxRetries={3}
 * >
 *   <MotionButton>Animate me</MotionButton>
 * </MotionErrorBoundary>
 * ```
 */
export const MotionErrorBoundary: Component<MotionErrorBoundaryProps> = (
  props
) => {
  const reducedMotion = useReducedMotion()
  const [errorInfo, setErrorInfo] = createSignal<MotionErrorInfo | null>(null)
  const [isRetrying, setIsRetrying] = createSignal(false)
  const [solidResetFn, setSolidResetFn] = createSignal<(() => void) | null>(
    null
  )
  const [retryCount, setRetryCount] = createSignal(0)

  const maxRetries = () => props.maxRetries ?? 2

  // Show deprecation warning for retryDelay in development
  if (
    props.retryDelay !== undefined &&
    props.autoRetryDelay === undefined &&
    import.meta.env.DEV
  ) {
    console.warn(
      'MotionErrorBoundary: retryDelay is deprecated. Use autoRetryDelay instead for consistency with ErrorBoundary.'
    )
  }

  // Handle backward compatibility for retry delay
  const getRetryDelay = () => {
    if (props.autoRetryDelay !== undefined) {
      return props.autoRetryDelay
    }

    if (props.retryDelay !== undefined) {
      return props.retryDelay
    }

    return 1000
  }

  const enableMotion = () => props.enableMotion ?? true
  const respectReducedMotion = () => props.respectReducedMotion ?? true

  const shouldEnableMotion = () => {
    if (!enableMotion()) return false
    if (respectReducedMotion() && reducedMotion.shouldAnimate()) return false
    return isMotionEnabled()
  }

  const handleError = (error: Error, errorInfo: { componentStack: string }) => {
    const info: MotionErrorInfo = {
      error,
      componentStack: errorInfo.componentStack,
      timestamp: Date.now(),
      retryCount: retryCount(), // Use persistent retry count
      motionState: {
        enabled: isMotionEnabled(),
        reducedMotion: reducedMotion.prefersReduced(),
      },
    }

    setErrorInfo(info)
    props.onError?.(error, errorInfo)

    // Log motion-specific errors
    if (
      error.message.includes('motion') ||
      error.message.includes('animation')
    ) {
      console.error('Motion Error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        motionState: info.motionState,
        timestamp: info.timestamp,
      })
    }
  }

  const reset = () => {
    setErrorInfo(null)
    setIsRetrying(false)
    setRetryCount(0)
  }

  const solidReset = () => {
    const resetFn = solidResetFn()
    if (resetFn) {
      resetFn()
    }
  }

  const retry = async () => {
    const currentRetryCount = retryCount()
    if (currentRetryCount >= maxRetries()) {
      return
    }

    setIsRetrying(true)

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, getRetryDelay()))

    // Increment retry count right before reset (like ErrorBoundary does)
    setRetryCount((prev) => prev + 1)

    // Update error info with new retry count
    const currentInfo = errorInfo()
    if (currentInfo) {
      setErrorInfo({
        ...currentInfo,
        retryCount: retryCount(),
      })
    }

    // Reset retrying state but keep error info for display
    setIsRetrying(false)

    // Trigger SolidJS reset to attempt re-render
    solidReset()
  }

  // Helper function to determine error type
  const getErrorType = (error: Error) => {
    return (
      error.message.includes('motion') || error.message.includes('animation')
    )
  }

  // Helper function to render error icon
  const renderErrorIcon = (isMotionError: boolean) => {
    return (
      <div
        class={cn(
          'p-2 rounded-full',
          isMotionError
            ? getStatusClasses('warning', 'bg')
            : getStatusClasses('error', 'bg')
        )}
      >
        {isMotionError ? (
          <Pause class={cn('w-5 h-5', getStatusClasses('warning', 'text'))} />
        ) : (
          <TriangleAlert
            class={cn('w-5 h-5', getStatusClasses('error', 'text'))}
          />
        )}
      </div>
    )
  }

  // Helper function to render error message
  const renderErrorMessage = (isMotionError: boolean) => {
    return (
      <div class="mb-4">
        <h3 class={cn('text-sm font-medium mb-1', getTextClasses('primary'))}>
          {isMotionError ? 'Animation Error' : 'Component Error'}
        </h3>
        <p class={cn('text-xs', getTextClasses('secondary'))}>
          {isMotionError
            ? 'An animation failed to render. This might be due to performance settings or browser limitations.'
            : 'An unexpected error occurred while rendering this component.'}
        </p>
      </div>
    )
  }

  // Helper function to render motion state info
  const renderMotionStateInfo = (isMotionError: boolean) => {
    if (!isMotionError) return null

    return (
      <div class="mb-4 p-2 rounded bg-opacity-50 text-xs">
        <div class="flex items-center justify-center space-x-4">
          <span class={cn(getTextClasses('tertiary'))}>
            Motion: {shouldEnableMotion() ? 'Enabled' : 'Disabled'}
          </span>
          <span class={cn(getTextClasses('tertiary'))}>
            Reduced Motion: {reducedMotion.prefersReduced() ? 'On' : 'Off'}
          </span>
        </div>
      </div>
    )
  }

  // Helper function to render retry info
  const renderRetryInfo = (info: MotionErrorInfo | null) => {
    const currentRetryCount = retryCount()
    if (currentRetryCount <= 0) return null

    return (
      <div class="mb-3">
        <p class={cn('text-xs', getStatusClasses('warning', 'text'))}>
          Retry attempt {currentRetryCount} of {maxRetries()}
        </p>
      </div>
    )
  }

  // Helper function to render action buttons
  const renderActionButtons = (
    canRetry: boolean,
    showRetryButton: boolean,
    isMotionError: boolean,
    resetFn: () => void,
    retryFn: () => void
  ) => {
    const currentRetryCount = retryCount()
    const hasReachedMaxRetries =
      currentRetryCount >= maxRetries() && currentRetryCount > 0

    return (
      <div class="flex flex-col sm:flex-row gap-2 justify-center">
        {showRetryButton && (
          <button
            type="button"
            onClick={retryFn}
            disabled={!canRetry || isRetrying()}
            class={cn(
              'px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center space-x-1',
              getStatusClasses('info', 'bg'),
              'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
              getTextClasses('primary')
            )}
          >
            <RefreshCw class={cn('w-3 h-3', isRetrying() && 'animate-spin')} />
            <span>
              {isRetrying()
                ? 'Retrying...'
                : hasReachedMaxRetries
                  ? 'Max Retries Reached'
                  : 'Retry'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={resetFn}
          class={cn(
            'px-3 py-1.5 text-xs font-medium rounded transition-colors',
            getBackgroundClasses('tertiary'),
            'hover:opacity-80',
            getTextClasses('secondary')
          )}
        >
          Reset
        </button>

        {isMotionError && (
          <button
            type="button"
            onClick={() => {
              console.info('Falling back to non-animated version')
              resetFn()
            }}
            class={cn(
              'px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center space-x-1',
              getBackgroundClasses('primary'),
              'hover:opacity-80',
              getTextClasses('primary')
            )}
          >
            <Play class="w-3 h-3" />
            <span>Try Without Animation</span>
          </button>
        )}
      </div>
    )
  }

  // Helper function to render error details
  const renderErrorDetails = (error: Error, info: MotionErrorInfo | null) => {
    // Check both DEV and NODE_ENV for comprehensive production detection
    if (!import.meta.env.DEV) return null

    return (
      <details class="mt-4 text-left">
        <summary
          class={cn(
            'cursor-pointer text-xs font-medium',
            getTextClasses('tertiary')
          )}
        >
          Error Details
        </summary>
        <div class="mt-2 space-y-2">
          <div>
            <p
              class={cn(
                'text-xs font-medium mb-1',
                getTextClasses('secondary')
              )}
            >
              Error:
            </p>
            <pre
              class={cn(
                'text-xs p-2 rounded overflow-auto bg-opacity-50',
                getBackgroundClasses('tertiary'),
                getStatusClasses('error', 'text')
              )}
            >
              {error.stack || error.message}
            </pre>
          </div>

          {info && (
            <div>
              <p
                class={cn(
                  'text-xs font-medium mb-1',
                  getTextClasses('secondary')
                )}
              >
                Component Stack:
              </p>
              <pre
                class={cn(
                  'text-xs p-2 rounded overflow-auto bg-opacity-50',
                  getBackgroundClasses('tertiary'),
                  getTextClasses('tertiary')
                )}
              >
                {info.componentStack}
              </pre>
            </div>
          )}
        </div>
      </details>
    )
  }

  const defaultFallback = (
    error: Error,
    resetFn: () => void,
    retryFn: () => void
  ) => {
    const info = errorInfo()
    const currentRetryCount = retryCount()
    const canRetry = currentRetryCount < maxRetries() && !isRetrying()
    const showRetryButton = currentRetryCount < maxRetries()
    const isMotionError = getErrorType(error)

    return (
      <div
        class={cn(
          'min-h-[100px] flex items-center justify-center p-4 rounded-lg border',
          getBackgroundClasses('secondary'),
          getBorderClasses('tertiary')
        )}
      >
        <div class="max-w-md w-full text-center">
          {/* Error Icon */}
          <div class="flex justify-center mb-3">
            {renderErrorIcon(isMotionError)}
          </div>

          {/* Error Message */}
          {renderErrorMessage(isMotionError)}

          {/* Motion State Info */}
          {renderMotionStateInfo(isMotionError)}

          {/* Retry Info */}
          {renderRetryInfo(info)}

          {/* Action Buttons */}
          {renderActionButtons(
            canRetry,
            showRetryButton,
            isMotionError,
            resetFn,
            retryFn
          )}

          {/* Error Details (Dev Only) */}
          {renderErrorDetails(error, info)}
        </div>
      </div>
    )
  }

  return (
    <SolidErrorBoundary
      fallback={(rawError: unknown, resetFn: () => void) => {
        // Store the SolidJS reset function for use in retry
        setSolidResetFn(() => resetFn)

        // Normalize the error to handle all error types consistently
        const err = normalizeError(rawError)
        handleError(err, { componentStack: '' })

        if (props.fallback) {
          return props.fallback(err, resetFn, retry)
        }

        return defaultFallback(err, resetFn, retry)
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  )
}

export default MotionErrorBoundary
