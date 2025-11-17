import {
  type Component,
  splitProps,
  createSignal,
  onMount,
  Show,
  For,
} from 'solid-js'
import { cn } from '../../lib/utils'
import { isMotionEnabled, getEasing } from '../../lib/motion'

export interface MotionSearchProps {
  class?: string
  placeholder?: string
  value?: string
  onInput?: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onClear?: () => void
  variant?: 'fade' | 'slide' | 'scale'
  duration?: number
  delay?: number
  disabled?: boolean
  results?: Array<{ id: string; title: string; description?: string }>
  onSelectResult?: (result: {
    id: string
    title: string
    description?: string
  }) => void
  showResults?: boolean
  animate?: boolean
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
  ])

  const [isFocused, setIsFocused] = createSignal(false)
  const [isAnimated, setIsAnimated] = createSignal(false)
  const [inputValue, setInputValue] = createSignal(local.value || '')

  onMount(() => {
    if (local.animate !== false) {
      setTimeout(() => setIsAnimated(true), local.delay || 0)
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
    const target = e.target as HTMLInputElement
    const value = target.value
    setInputValue(value)
    local.onInput?.(value)
  }

  const handleFocus = () => {
    setIsFocused(true)
    local.onFocus?.()
  }

  const handleBlur = () => {
    // Delay blur to allow result selection
    setTimeout(() => setIsFocused(false), 200)
    local.onBlur?.()
  }

  const handleClear = () => {
    setInputValue('')
    local.onClear?.()
    local.onInput?.('')
  }

  const handleResultClick = (result: {
    id: string
    title: string
    description?: string
  }) => {
    setInputValue(result.title)
    setIsFocused(false)
    local.onSelectResult?.(result)
  }

  const hasValue = () => inputValue().length > 0
  const hasResults = () => local.results && local.results.length > 0
  const shouldShowResults = () =>
    local.showResults !== false && isFocused() && hasResults()

  return (
    <div class={cn('motion-search-container', local.class)} {...others}>
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
            'w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
            local.disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={getInputStyle()}
        />

        {/* Clear Button */}
        <Show when={hasValue() && !local.disabled}>
          <button
            onClick={handleClear}
            class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
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
        <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <For each={local.results || []}>
            {(result, index) => (
              <button
                type="button"
                onClick={() => handleResultClick(result)}
                class="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-left w-full"
                style={getResultsStyle(index())}
              >
                <div class="font-medium text-gray-900">{result.title}</div>
                <Show when={result.description}>
                  <div class="text-sm text-gray-500 mt-1">
                    {result.description}
                  </div>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
