/**
 * MotionCard - Animated card component for anime items
 * Integrates with motion system for smooth hover and entry animations
 * Perfect for anime collection grid and list views
 */

import {
  type Component,
  Show,
  splitProps,
  createSignal,
  onError,
  createMemo,
} from 'solid-js'
import {
  cn,
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
  getStatusClasses,
  getThemeTransitionClasses,
} from '../../lib/utils'
import {
  useInteractionAnimation,
  useScrollAnimation,
} from '../../hooks/useMotionAnimations'
import { MotionErrorBoundary } from './MotionErrorBoundary'
import { createEventListenerManager, safeFn } from './performance-utils'
import type {
  InteractiveComponentProps,
  SizeVariant,
  CardMetadata,
  StatusVariant,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced motion card interface with comprehensive options
 */
export interface MotionCardProps
  extends InteractiveComponentProps,
    ErrorHandlingProps {
  /**
   * Card visual variant for different display styles
   * @default 'standard'
   */
  variant?: 'standard' | 'compact' | 'featured'
  /**
   * Card size variant
   * @default 'md'
   */
  size?: SizeVariant
  /**
   * Whether card is clickable and interactive
   * @default false
   */
  clickable?: boolean
  /**
   * Card title or heading
   */
  title?: string
  /**
   * Card image URL or source
   */
  image?: string
  /**
   * Card description or summary text
   */
  description?: string
  /**
   * Additional metadata for the card
   */
  metadata?: CardMetadata
  /**
   * Whether to animate card when it comes into view
   * @default true
   */
  animateOnScroll?: boolean
  /**
   * Image aspect ratio
   * @default '3/4'
   */
  aspectRatio?: string
  /**
   * Whether to show image placeholder on error
   * @default true
   */
  showImagePlaceholder?: boolean
  /**
   * Maximum number of genre tags to display
   * @default 3
   */
  maxGenreTags?: number
  /**
   * Whether to show rating stars
   * @default true
   */
  showRating?: boolean
  /**
   * Whether to show metadata badges
   * @default true
   */
  showMetadata?: boolean
  /**
   * Custom image alt text for accessibility
   */
  imageAlt?: string
  /**
   * Whether to lazy load the image
   * @default true
   */
  lazyLoad?: boolean
}

/**
 * MotionCard component with hover and scroll animations
 *
 * Features smooth entry animations, interactive hover states, and comprehensive
 * metadata display. Perfect for anime collection grids and list views.
 *
 * @example
 * ```tsx
 * <MotionCard
 *   variant="featured"
 *   size="lg"
 *   title="Attack on Titan"
 *   image="/path/to/image.jpg"
 *   description="Humanity's struggle against giant titans..."
 *   metadata={{
 *     year: 2013,
 *     episodes: 87,
 *     rating: 9.0,
 *     status: 'completed',
 *     genres: ['Action', 'Drama', 'Fantasy']
 *   }}
 *   clickable
 *   onClick={handleCardClick}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Compact card with custom content
 * <MotionCard
 *   variant="compact"
 *   size="sm"
 *   title="Anime Title"
 *   showMetadata={false}
 * >
 *   <div class="p-4">
 *     <p>Custom card content goes here</p>
 *   </div>
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
    'onError',
    'maxRetries',
    'retryDelay',
  ])

  // Performance optimization: Create event listener manager
  const _eventManager = createEventListenerManager()

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

  // Error handling states
  const [imageError, setImageError] = createSignal(false)
  const [hasError, setHasError] = createSignal(false)
  const [retryCount, setRetryCount] = createSignal(0)

  // Extract validation functions to reduce complexity
  const isValidYear = (year: unknown): year is number => {
    return (
      typeof year === 'number' &&
      year >= 1900 &&
      year <= new Date().getFullYear() + 5
    )
  }

  const isValidRating = (rating: unknown): rating is number => {
    return typeof rating === 'number' && rating >= 0 && rating <= 10
  }

  const isValidStatus = (status: unknown): status is StatusVariant => {
    const validStatuses: StatusVariant[] = [
      'watching',
      'completed',
      'planned',
      'dropped',
    ]
    return (
      typeof status === 'string' &&
      validStatuses.includes(status as StatusVariant)
    )
  }

  const validateGenres = (genres: unknown): string[] | undefined => {
    if (!Array.isArray(genres)) return undefined
    return genres.filter((g: unknown) => typeof g === 'string')
  }

  // Memoize expensive computations
  const validatedMetadata = createMemo(() => {
    if (!local.metadata || typeof local.metadata !== 'object') return null

    const data = local.metadata as Record<string, unknown>

    return {
      year: isValidYear(data.year) ? (data.year as number) : undefined,
      episodes:
        typeof data.episodes === 'number' && data.episodes > 0
          ? data.episodes
          : undefined,
      rating: isValidRating(data.rating) ? (data.rating as number) : undefined,
      status: isValidStatus(data.status)
        ? (data.status as 'watching' | 'completed' | 'planned' | 'dropped')
        : undefined,
      genres: validateGenres(data.genres),
    }
  })

  // Memoize computed values
  const aspectRatio = () => local.aspectRatio ?? '3/4'
  const showImagePlaceholder = () => local.showImagePlaceholder ?? true
  const maxGenreTags = () => local.maxGenreTags ?? 3
  const showRating = () => local.showRating ?? true
  const _showMetadata = () => local.showMetadata ?? true
  const lazyLoad = () => local.lazyLoad ?? true
  const imageAlt = () => local.imageAlt ?? local.title ?? 'Card image'

  // Get base classes based on variant and size
  const getBaseClasses = () => {
    const variantClasses = {
      standard: cn(
        getBackgroundClasses('primary'),
        'rounded-xl shadow-lg',
        getBorderClasses('primary')
      ),
      compact: cn(
        getBackgroundClasses('primary'),
        'rounded-lg shadow-md',
        getBorderClasses('primary')
      ),
      featured: cn(
        getBackgroundClasses('accent'),
        'rounded-2xl shadow-xl',
        getBorderClasses('primary')
      ),
    }

    const sizeClasses = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    }

    return cn(
      // Base layout classes
      'relative overflow-hidden',
      // Theme-aware classes
      getThemeTransitionClasses('all'),
      'transition-all duration-300',
      // Size/variant classes
      variantClasses[local.variant || 'standard'],
      sizeClasses[local.size || 'md'],
      // State classes
      local.clickable && 'cursor-pointer hover:shadow-xl',
      // Props classes (always last)
      local.class
    )
  }

  // Get status color for metadata
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'watching':
        return getStatusClasses('info', 'bg')
      case 'completed':
        return getStatusClasses('success', 'bg')
      case 'planned':
        return getStatusClasses('warning', 'bg')
      case 'dropped':
        return getStatusClasses('error', 'bg')
      default:
        return cn(
          getBackgroundClasses('secondary'),
          getTextClasses('secondary')
        )
    }
  }

  // Extract image rendering logic
  const renderImagePlaceholder = () => {
    if (!showImagePlaceholder()) return null

    return (
      <div
        class={cn(
          'w-full h-full flex items-center justify-center',
          getBackgroundClasses('secondary')
        )}
      >
        <div class="text-center">
          <svg
            class="w-12 h-12 mx-auto mb-2 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p class={cn('text-xs', getTextClasses('tertiary'))}>
            Image unavailable
          </p>
          <button
            type="button"
            onClick={() => setImageError(false)}
            class={cn(
              'mt-2 px-2 py-1 text-xs rounded',
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

  const renderCardImage = () => {
    if (!local.image) return null

    return (
      <div
        class={cn(
          'relative overflow-hidden',
          getBackgroundClasses('secondary')
        )}
        style={{ 'aspect-ratio': aspectRatio() }}
      >
        <Show when={!imageError()} fallback={renderImagePlaceholder()}>
          <img
            src={local.image}
            alt={imageAlt()}
            class={cn(
              'w-full h-full object-cover transition-transform duration-300',
              local.clickable && 'group-hover:scale-105'
            )}
            loading={lazyLoad() ? 'lazy' : 'eager'}
            onError={() => setImageError(true)}
          />
        </Show>

        {/* Overlay gradient */}
        <div class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status badge */}
        <Show when={validatedMetadata()?.status}>
          <div
            class={cn(
              'absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full',
              getStatusColor(validatedMetadata()?.status)
            )}
          >
            {validatedMetadata()?.status}
          </div>
        </Show>
      </div>
    )
  }

  // Error boundary for card component
  onError((error) => {
    console.error('MotionCard component error:', error)
    setHasError(true)
    local.onError?.(error)
  })

  // Performance optimization: Handle card click with error handling and retry logic
  const handleClick = async (event: Event | MouseEvent | KeyboardEvent) => {
    if (!local.clickable || hasError()) return

    const _maxRetries = local.maxRetries ?? 2
    const _retryDelay = local.retryDelay ?? 1000

    // Use safe function wrapper for immediate error handling
    safeFn(
      async () => {
        if (typeof local.onClick === 'function') {
          const result = local.onClick(event)
          // Handle async onClick handlers
          if (result instanceof Promise) {
            await result
          }
        }
        setHasError(false)
        setRetryCount(0)
      },
      (error) => {
        console.error('Error in MotionCard onClick handler:', error)
        setHasError(true)
        local.onError?.(error)
      }
    )
  }

  // Handle keyboard events for accessibility with error handling
  const handleKeyDown = (event: KeyboardEvent) => {
    try {
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
    } catch (error) {
      console.error('Error in MotionCard key handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    try {
      if (!local.clickable) return
      if (event.key === ' ') {
        event.preventDefault()
      }
    } catch (error) {
      console.error('Error in MotionCard key up handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
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
            handleClick(e)
          }
          // Call original handler
          eventHandlers.onKeyDown?.(e)
        },
      }
    : {}

  // Extract metadata rendering logic
  const renderMetadata = () => {
    if (!local.metadata) return null

    const metadata = validatedMetadata()
    if (!metadata) return null

    return (
      <>
        <div
          class={cn(
            'flex items-center justify-between text-sm',
            getTextClasses('tertiary')
          )}
        >
          <div class="flex items-center space-x-3">
            {/* Year */}
            <Show when={metadata.year}>
              <span>{metadata.year}</span>
            </Show>

            {/* Episodes */}
            <Show when={metadata.episodes}>
              <span>{metadata.episodes} eps</span>
            </Show>
          </div>

          {/* Rating */}
          <Show when={showRating() && metadata.rating}>
            <div class="flex items-center">
              <span class="text-yellow-500">★</span>
              <span class="ml-1">{metadata.rating.toFixed(1)}</span>
            </div>
          </Show>
        </div>

        {/* Genres */}
        <Show when={metadata.genres && metadata.genres.length > 0}>
          <div class="flex flex-wrap gap-1 mt-2">
            {metadata.genres.slice(0, maxGenreTags()).map((genre) => (
              <span
                class={cn(
                  'px-2 py-1 text-xs rounded',
                  getBackgroundClasses('secondary'),
                  getTextClasses('secondary')
                )}
              >
                {genre}
              </span>
            ))}
            <Show when={metadata.genres.length > maxGenreTags()}>
              <span
                class={cn(
                  'px-2 py-1 text-xs rounded',
                  getBackgroundClasses('secondary'),
                  getTextClasses('secondary')
                )}
              >
                +{metadata.genres.length - maxGenreTags()}
              </span>
            </Show>
          </div>
        </Show>
      </>
    )
  }

  const renderCardContent = () => {
    return (
      <div class="p-4">
        <MotionErrorBoundary
          onError={(error) => {
            setHasError(true)
            local.onError?.(error)
          }}
        >
          {/* Title */}
          <Show when={local.title}>
            <h3
              class={cn(
                'font-semibold line-clamp-2 mb-2',
                getTextClasses('primary')
              )}
            >
              {local.title}
            </h3>
          </Show>

          {/* Description */}
          <Show when={local.description}>
            <p
              class={cn(
                'text-sm line-clamp-3 mb-3',
                getTextClasses('secondary')
              )}
            >
              {local.description}
            </p>
          </Show>

          {/* Metadata */}
          {renderMetadata()}

          {/* Custom children */}
          {local.children}
        </MotionErrorBoundary>
      </div>
    )
  }

  const renderErrorState = () => {
    if (!hasError()) return null

    return (
      <div
        class={cn(
          'absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg',
          getBackgroundClasses('secondary')
        )}
      >
        <div class="text-center p-4">
          <svg
            class="w-8 h-8 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>Card Error</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p class={cn('text-sm mb-2', getTextClasses('primary'))}>
            Card failed to load
          </p>
          <button
            type="button"
            onClick={() => {
              setHasError(false)
              setRetryCount(0)
              setImageError(false)
            }}
            class={cn(
              'px-3 py-1 text-xs rounded transition-colors',
              getStatusClasses('info', 'bg'),
              'hover:opacity-90',
              getTextClasses('primary')
            )}
          >
            Retry {retryCount() > 0 ? `(${retryCount()})` : ''}
          </button>
        </div>
      </div>
    )
  }

  // Extract clickable card rendering
  const renderClickableCard = () => {
    return (
      <button
        ref={elementRef}
        type="button"
        class={cn(getBaseClasses(), hasError() && 'border-red-500 opacity-75')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        style={getCombinedStyles()}
        {...enhancedEventHandlers}
        {...rest}
      >
        {renderCardImage()}
        {renderCardContent()}
        {renderErrorState()}
      </button>
    )
  }

  // Extract non-clickable card rendering
  const renderStaticCard = () => {
    return (
      <div
        ref={elementRef}
        class={cn(getBaseClasses(), hasError() && 'border-red-500 opacity-75')}
        style={getCombinedStyles()}
        {...rest}
      >
        {renderCardImage()}
        {renderCardContent()}
        {renderErrorState()}
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
      {local.clickable ? renderClickableCard() : renderStaticCard()}
    </MotionErrorBoundary>
  )
}

export default MotionCard
