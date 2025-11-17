/**
 * MotionCard - Animated card component for anime items
 * Integrates with motion system for smooth hover and entry animations
 * Perfect for anime collection grid and list views
 */

import { type Component, Show, splitProps, type JSX } from 'solid-js'
import { cn } from '../../lib/utils'
import {
  useInteractionAnimation,
  useScrollAnimation,
} from '../../hooks/useMotionAnimations'

export interface MotionCardProps {
  /** Card variant for different display styles */
  variant?: 'standard' | 'compact' | 'featured'
  /** Card size */
  size?: 'sm' | 'md' | 'lg'
  /** Whether card is clickable */
  clickable?: boolean
  /** Card click handler */
  onClick?: (event: MouseEvent) => void
  /** Anime title */
  title?: string
  /** Anime image URL */
  image?: string
  /** Anime description */
  description?: string
  /** Additional metadata */
  metadata?: {
    year?: number
    episodes?: number
    rating?: number
    status?: 'watching' | 'completed' | 'planned' | 'dropped'
    genres?: string[]
  }
  /** Whether to animate on scroll */
  animateOnScroll?: boolean
  /** Custom CSS classes */
  class?: string
  /** Children content */
  children?: JSX.Element
}

/**
 * MotionCard component with hover and scroll animations
 *
 * @example
 * ```tsx
 * <MotionCard
 *   variant="standard"
 *   title="Attack on Titan"
 *   image="/path/to/image.jpg"
 *   metadata={{ year: 2013, rating: 9.0 }}
 *   onClick={handleCardClick}
 * >
 *   Card content
 * </MotionCard>
 * ```
 */
export const MotionCard: Component<MotionCardProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'variant',
    'size',
    'clickable',
    'onClick',
    'title',
    'image',
    'description',
    'metadata',
    'animateOnScroll',
    'children',
    'class',
  ])

  // Setup scroll animation if enabled
  const { elementRef, getAnimationStyles } = useScrollAnimation({
    threshold: 0.1,
    triggerOnce: true,
  })

  // Setup interaction animations for clickable cards
  const { eventHandlers, getAnimationStyles: getInteractionStyles } =
    useInteractionAnimation({
      disabled: !local.clickable,
    })

  // Get base classes based on variant and size
  const getBaseClasses = () => {
    const variantClasses = {
      standard:
        'bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700',
      compact:
        'bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700',
      featured:
        'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl border border-blue-200 dark:border-blue-800',
    }

    const sizeClasses = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    }

    return cn(
      'relative overflow-hidden transition-all duration-300',
      variantClasses[local.variant || 'standard'],
      sizeClasses[local.size || 'md'],
      local.clickable && 'cursor-pointer hover:shadow-xl',
      local.class
    )
  }

  // Get status color for metadata
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'watching':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'planned':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'dropped':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  // Handle card click
  const handleClick = (event: MouseEvent) => {
    if (!local.clickable) return
    local.onClick?.(event)
  }

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!local.clickable) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      // Create a synthetic mouse event for keyboard interaction
      const syntheticEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
      local.onClick?.(syntheticEvent)
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (!local.clickable) return
    if (event.key === ' ') {
      event.preventDefault()
    }
  }

  // Combine animation styles
  const getCombinedStyles = () => {
    const scrollStyles = local.animateOnScroll ? getAnimationStyles() : {}
    const interactionStyles = local.clickable ? getInteractionStyles() : {}

    return {
      ...scrollStyles,
      ...interactionStyles,
    }
  }

  // Create enhanced event handlers for accessibility
  const enhancedEventHandlers = local.clickable
    ? {
        ...eventHandlers,
        onKeyDown: (e: KeyboardEvent) => {
          // Handle Enter/Space for button behavior
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e as unknown as MouseEvent)
          }
          // Call original handler
          eventHandlers.onKeyDown?.(e)
        },
      }
    : {}

  return (
    <div
      ref={elementRef}
      class={getBaseClasses()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      style={getCombinedStyles()}
      role={local.clickable ? 'button' : undefined}
      tabIndex={local.clickable ? 0 : undefined}
      {...enhancedEventHandlers}
      {...rest}
    >
      {/* Card image */}
      <Show when={local.image}>
        <div class="relative aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-700">
          <img
            src={local.image}
            alt={local.title || 'Anime cover'}
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Overlay gradient */}
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Status badge */}
          <Show when={local.metadata?.status}>
            <div
              class={cn(
                'absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full',
                getStatusColor(local.metadata?.status)
              )}
            >
              {local.metadata?.status}
            </div>
          </Show>
        </div>
      </Show>

      {/* Card content */}
      <div class="p-4">
        {/* Title */}
        <Show when={local.title}>
          <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">
            {local.title}
          </h3>
        </Show>

        {/* Description */}
        <Show when={local.description}>
          <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-3">
            {local.description}
          </p>
        </Show>

        {/* Metadata */}
        <Show when={local.metadata}>
          <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <div class="flex items-center space-x-3">
              {/* Year */}
              <Show when={local.metadata?.year}>
                <span>{local.metadata?.year}</span>
              </Show>

              {/* Episodes */}
              <Show when={local.metadata?.episodes}>
                <span>{local.metadata?.episodes} eps</span>
              </Show>
            </div>

            {/* Rating */}
            <Show when={local.metadata?.rating}>
              <div class="flex items-center">
                <span class="text-yellow-500">★</span>
                <span class="ml-1">{local.metadata?.rating?.toFixed(1)}</span>
              </div>
            </Show>
          </div>

          {/* Genres */}
          <Show
            when={local.metadata?.genres && local.metadata.genres.length > 0}
          >
            <div class="flex flex-wrap gap-1 mt-2">
              {local.metadata?.genres?.slice(0, 3).map((genre) => (
                <span class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  {genre}
                </span>
              ))}
              <Show when={(local.metadata?.genres?.length || 0) > 3}>
                <span class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                  +{(local.metadata?.genres?.length || 0) - 3}
                </span>
              </Show>
            </div>
          </Show>
        </Show>

        {/* Custom children */}
        {local.children}
      </div>
    </div>
  )
}

export default MotionCard
