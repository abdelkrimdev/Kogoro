import {
  type Component,
  splitProps,
  createSignal,
  onMount,
  onCleanup,
  Show,
  For,
  onError,
} from 'solid-js'
import {
  cn,
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
  getFocusClasses,
  getThemeTransitionClasses,
  getStatusClasses,
} from '../../lib/utils'
import { isMotionEnabled, getEasing } from '../../lib/motion'
import { MotionErrorBoundary } from './MotionErrorBoundary'

import type {
  InteractiveComponentProps,
  SearchComponentProps,
  AnimationVariant,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced motion search interface with comprehensive options
 */
export interface MotionSearchProps
  extends InteractiveComponentProps,
    SearchComponentProps,
    ErrorHandlingProps {
  /**
   * Input placeholder text
   * @default 'Search...'
   */
  placeholder?: string
  /**
   * Current input value (controlled component)
   */
  value?: string
  /**
   * Input change handler
   * @param value - Current input value
   */
  onInput?: (value: string) => void
  /**
   * Focus event handler
   */
  onFocus?: () => void
  /**
   * Blur event handler
   */
  onBlur?: () => void
  /**
   * Clear button click handler
   */
  onClear?: () => void
  /**
   * Animation variant for search input
   * @default 'fade'
   */
  variant?: AnimationVariant
  /**
   * Animation duration in seconds
   * @default 0.3
   */
  duration?: number
  /**
   * Animation delay in seconds
   * @default 0
   */
  delay?: number
  /**
   * Whether to animate search component
   * @default true
   */
  animate?: boolean
  /**
   * Whether to show search results dropdown
   * @default true
   */
  showResults?: boolean
  /**
   * Minimum characters to trigger search
   * @default 1
   */
  minQueryLength?: number
  /**
   * Debounce delay for search input in milliseconds
   * @default 300
   */
  debounceDelay?: number
  /**
   * Maximum number of results to display
   * @default 10
   */
  maxResults?: number
  /**
   * Whether to show clear button
   * @default true
   */
  showClearButton?: boolean
  /**
   * Whether to show loading indicator
   * @default false
   */
  showLoading?: boolean
  /**
   * Loading state
   * @default false
   */
  loading?: boolean
  /**
   * Whether to highlight matching text in results
   * @default true
   */
  highlightMatches?: boolean
  /**
   * Custom result renderer
   * @param result - Search result item
   * @param index - Result index
   * @param query - Current search query
   * @returns Custom JSX element for result
   */
  renderResult?: (
    result: SearchResult,
    index: number,
    query: string
  ) => JSX.Element
  /**
   * Whether to show no results message
   * @default true
   */
  showNoResults?: boolean
  /**
   * Custom no results message
   * @default 'No results found'
   */
  noResultsMessage?: string
  /**
   * Whether to close results on selection
   * @default true
   */
  closeOnSelect?: boolean
  /**
   * Whether to navigate results with keyboard
   * @default true
   */
  keyboardNavigation?: boolean
  /**
   * Custom result ID prefix for accessibility
   * @default 'search-result'
   */
  resultIdPrefix?: string
}

export const MotionSearch: Component<MotionSearchProps> = (props) => {
  const [local, others] = splitProps(props, [
    'class',
    'placeholder',
    'value',
    'onInput',
    'onFocus',
    'onBlur',
    'onClear',
    'variant',
    'duration',
    'delay',
    'disabled',
    'results',
    'onSelectResult',
    'showResults',
    'animate',
    'onError',
    'maxRetries',
    'retryDelay',
  ])

  const [isFocused, setIsFocused] = createSignal(false)
  const [isAnimated, setIsAnimated] = createSignal(false)
  const [inputValue, setInputValue] = createSignal(local.value || '')
  const [hasError, setHasError] = createSignal(false)
  const [failedResults, setFailedResults] = createSignal<Set<number>>(new Set())
  let blurTimeoutId: ReturnType<typeof setTimeout> | undefined

  // Error boundary for search component
  onError((error) => {
    console.error('MotionSearch component error:', error)
    setHasError(true)
    local.onError?.(error)
  })

  onMount(() => {
    try {
      if (local.animate !== false) {
        setTimeout(() => setIsAnimated(true), local.delay || 0)
      }
    } catch (error) {
      console.error('Error in MotionSearch onMount:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  })

  onCleanup(() => {
    // Clear any pending blur timeout to prevent memory leaks
    if (blurTimeoutId !== undefined) {
      clearTimeout(blurTimeoutId)
      blurTimeoutId = undefined
    }
  })

  // Helper function to get base animation properties
  const getAnimationProps = () => {
    const duration = local.duration || 0.3
    const easing = getEasing('easeOut')
    return { duration, easing }
  }

  // Helper function for slide animation
  const getSlideStyle = () => {
    const { duration, easing } = getAnimationProps()
    return {
      opacity: isAnimated() ? 1 : 0,
      transform: isAnimated() ? 'translateY(0)' : 'translateY(-10px)',
      transition: `all ${duration}s ${easing}`,
    }
  }

  // Helper function for scale animation
  const getScaleStyle = () => {
    const { duration, easing } = getAnimationProps()
    return {
      opacity: isAnimated() ? 1 : 0,
      transform: isAnimated() ? 'scale(1)' : 'scale(0.95)',
      transition: `all ${duration}s ${easing}`,
    }
  }

  // Helper function for fade animation
  const getFadeStyle = () => {
    const { duration, easing } = getAnimationProps()
    return {
      opacity: isAnimated() ? 1 : 0,
      transition: `opacity ${duration}s ${easing}`,
    }
  }

  const getInputStyle = () => {
    if (!(isMotionEnabled() && isAnimated())) return {}

    switch (local.variant) {
      case 'slide':
        return getSlideStyle()
      case 'scale':
        return getScaleStyle()
      default: // fade
        return getFadeStyle()
    }
  }

  const getResultsStyle = (index: number) => {
    if (!(isMotionEnabled() && isFocused())) return {}

    const duration = local.duration || 0.2
    const easing = getEasing('easeOut')
    const staggerDelay = index * 0.05

    return {
      opacity: isFocused() ? 1 : 0,
      transform: isFocused() ? 'translateY(0)' : 'translateY(-5px)',
      transition: `all ${duration}s ${easing} ${staggerDelay}s`,
    }
  }

  const handleInput = (e: Event) => {
    try {
      const target = e.target as HTMLInputElement
      if (!target) return

      const value = target.value
      setInputValue(value)
      local.onInput?.(value)
    } catch (error) {
      console.error('Error in search input handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  const handleFocus = () => {
    try {
      setIsFocused(true)
      local.onFocus?.()
    } catch (error) {
      console.error('Error in search focus handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  const handleBlur = () => {
    try {
      // Clear any existing blur timeout
      if (blurTimeoutId !== undefined) {
        clearTimeout(blurTimeoutId)
      }

      // Delay blur to allow result selection
      blurTimeoutId = setTimeout(() => setIsFocused(false), 200)
      local.onBlur?.()
    } catch (error) {
      console.error('Error in search blur handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  const handleClear = () => {
    try {
      setInputValue('')
      local.onClear?.()
      local.onInput?.('')
    } catch (error) {
      console.error('Error in search clear handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  const handleResultClick = (result: SearchResult, index: number) => {
    try {
      if (!result || typeof result.title !== 'string') {
        console.warn('Invalid search result clicked:', result)
        setFailedResults((prev) => new Set(prev).add(index))
        return
      }

      setInputValue(result.title)
      setIsFocused(false)
      local.onSelectResult?.(result)
    } catch (error) {
      console.error('Error in search result click handler:', error)
      setFailedResults((prev) => new Set(prev).add(index))
      local.onError?.(error as Error)
    }
  }

  const hasValue = () => inputValue().length > 0
  const hasResults = () => local.results && local.results.length > 0
  const shouldShowResults = () =>
    local.showResults !== false && isFocused() && hasResults()

  const renderErrorState = () => {
    if (!hasError()) return null

    return (
      <div
        class={cn(
          'absolute z-10 w-full mt-1 rounded-lg shadow-lg p-4',
          getBackgroundClasses('primary'),
          getBorderClasses('error')
        )}
      >
        <div class="flex items-center space-x-2">
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>Search Error</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class={cn('text-sm', getTextClasses('secondary'))}>
            Search failed
          </span>
          <button
            type="button"
            onClick={() => {
              setHasError(false)
              setFailedResults(new Set())
            }}
            class={cn(
              'ml-auto px-2 py-1 text-xs rounded transition-colors',
              getStatusClasses('info', 'bg'),
              'hover:opacity-90',
              getTextClasses('primary')
            )}
          >
            Retry
          </button>
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
      <div
        class={cn(
          'motion-search-container',
          hasError() && 'opacity-75',
          local.class
        )}
        {...others}
      >
        {/* Search Input */}
        <div class="relative">
          <input
            type="text"
            placeholder={local.placeholder || 'Search...'}
            value={inputValue()}
            onInput={handleInput}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={local.disabled}
            class={cn(
              // Base layout classes
              'w-full px-4 py-2 pr-10 rounded-lg focus:outline-none',
              // Theme-aware classes
              'transition-colors',
              getThemeTransitionClasses('all'),
              // Size/variant classes
              getBorderClasses('primary'),
              getBackgroundClasses('primary'),
              getTextClasses('primary'),
              getFocusClasses('default'),
              // Error state
              hasError() && 'border-red-500',
              // State classes
              local.disabled && 'opacity-50 cursor-not-allowed'
            )}
            style={getInputStyle()}
          />

          {/* Clear Button */}
          <Show when={hasValue() && !local.disabled}>
            <button
              onClick={handleClear}
              class={cn(
                // Base layout classes
                'absolute right-2 top-1/2 transform -translate-y-1/2 focus:outline-none',
                // Theme-aware classes
                'transition-colors',
                getThemeTransitionClasses('text'),
                // State classes
                getTextClasses('tertiary'),
                `hover:${getTextClasses('secondary')}`
              )}
              type="button"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Clear search</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Show>
        </div>

        {/* Search Results */}
        <Show when={shouldShowResults()}>
          <div
            class={cn(
              // Base layout classes
              'absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto',
              // Theme-aware classes
              getBackgroundClasses('primary'),
              getBorderClasses('primary')
            )}
          >
            <For each={local.results || []}>
              {(result, index) => (
                <MotionErrorBoundary
                  onError={(error) => {
                    console.error(`Search result ${index()} error:`, error)
                    setFailedResults((prev) => new Set(prev).add(index()))
                    local.onError?.(error)
                  }}
                  fallback={(_error, _reset) => (
                    <div
                      class={cn(
                        'px-4 py-3 border-b last:border-b-0 opacity-50',
                        getBorderClasses('tertiary')
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
                          <title>Result Error</title>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        <p class="text-xs">Failed to load result</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFailedResults((prev) => {
                              const newSet = new Set(prev)
                              newSet.delete(index())
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
                    </div>
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleResultClick(result, index())}
                    disabled={failedResults().has(index())}
                    class={cn(
                      // Base layout classes
                      'px-4 py-3 cursor-pointer border-b last:border-b-0 text-left w-full',
                      // Theme-aware classes
                      'transition-colors',
                      getThemeTransitionClasses('bg'),
                      // State classes
                      getBorderClasses('tertiary'),
                      `hover:${getBackgroundClasses('secondary')}`,
                      // Failed state
                      failedResults().has(index()) &&
                        'opacity-50 cursor-not-allowed'
                    )}
                    style={getResultsStyle(index())}
                  >
                    <div class={cn('font-medium', getTextClasses('primary'))}>
                      {result.title}
                    </div>
                    <Show when={result.description}>
                      <div
                        class={cn('text-sm mt-1', getTextClasses('secondary'))}
                      >
                        {result.description}
                      </div>
                    </Show>
                  </button>
                </MotionErrorBoundary>
              )}
            </For>
          </div>
        </Show>

        {/* Error state */}
        {renderErrorState()}
      </div>
    </MotionErrorBoundary>
  )
}
