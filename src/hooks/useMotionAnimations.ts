/**
 * Custom motion hooks for Kogoro anime collection management app
 * Provides comprehensive animation utilities that integrate with the existing motion system
 * Each hook is optimized for SolidJS reactivity and follows best practices
 */

import { createSignal, onCleanup, onMount } from 'solid-js'
import {
  createMotion,
  getDuration,
  getEasing,
  isMotionEnabled,
  MOTION_PRESETS,
  MOTION_CSS,
  MOTION_KEYFRAMES,
  type MotionPreset,
  type MotionDuration,
  type MotionEasing,
} from '../lib/motion'
import {
  createThemeMotion,
  createThemeTransition,
  type ThemeTransitionConfig,
} from '../lib/motion-theme'
import { MOTION_VARIANTS, createStaggeredVariant } from '../lib/motion-variants'
import { prefersReducedMotion } from '../lib/theme-transitions'
import type {
  AnimationEvents,
  ReducedMotionPreference,
  ModalMotionProps,
} from '../types/motion'

// ============================================================================
// 1. THEME TRANSITION HOOK
// ============================================================================

/**
 * Hook for animated theme switching with progress tracking
 * Provides smooth transitions between light and dark themes
 *
 * @param config - Theme transition configuration
 * @returns Theme transition state and controls
 *
 * @example
 * ```tsx
 * const { isTransitioning, progress, startTransition } = useThemeTransition({
 *   duration: 'normal',
 *   onTransitionEnd: () => console.log('Theme changed')
 * })
 * ```
 */
export function useThemeTransition(config: ThemeTransitionConfig = {}) {
  const [isTransitioning, setIsTransitioning] = createSignal(false)
  const [progress, setProgress] = createSignal(0)
  const [currentTheme, setCurrentTheme] = createSignal<'light' | 'dark'>(
    'light'
  )

  // Initialize theme motion system
  onMount(() => {
    createThemeMotion()

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const html = document.documentElement
      const newTheme = html.classList.contains('dark') ? 'dark' : 'light'
      setCurrentTheme(newTheme)
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    onCleanup(() => observer.disconnect())
  })

  /**
   * Start theme transition animation
   */
  const startTransition = async (newTheme: 'light' | 'dark') => {
    if (isTransitioning() || newTheme === currentTheme()) return

    setIsTransitioning(true)
    setProgress(0)

    try {
      await createThemeTransition({
        ...config,
        onProgress: setProgress,
        onTransitionEnd: () => {
          setIsTransitioning(false)
          setProgress(1)
          config.onTransitionEnd?.()
        },
      })

      // Apply theme change
      const html = document.documentElement
      if (newTheme === 'dark') {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }

      setCurrentTheme(newTheme)
    } catch (error) {
      console.error('Theme transition failed:', error)
      setIsTransitioning(false)
    }
  }

  /**
   * Toggle between themes
   */
  const toggleTheme = async () => {
    await startTransition(currentTheme() === 'light' ? 'dark' : 'light')
  }

  return {
    // State
    isTransitioning,
    progress,
    currentTheme,

    // Actions
    startTransition,
    toggleTheme,

    // Utilities
    isLightTheme: () => currentTheme() === 'light',
    isDarkTheme: () => currentTheme() === 'dark',
  }
}

// ============================================================================
// 2. REDUCED MOTION HOOK
// ============================================================================

/**
 * Hook for detecting and responding to reduced motion preferences
 * Automatically adapts animations based on user accessibility settings
 *
 * @returns Reduced motion state and utilities
 *
 * @example
 * ```tsx
 * const { prefersReduced, shouldAnimate } = useReducedMotion()
 *
 * // Use in components
 * <div class={shouldAnimate() ? 'animated' : 'no-animation'}>
 *   Content
 * </div>
 * ```
 */
export function useReducedMotion(): ReducedMotionPreference {
  const [prefersReduced, setPrefersReduced] = createSignal(false)
  const [mediaQuery, setMediaQuery] = createSignal<MediaQueryList | null>(null)

  onMount(() => {
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setMediaQuery(query)
    setPrefersReduced(query.matches)

    const handleChange = () => setPrefersReduced(query.matches)
    query.addEventListener('change', handleChange)

    onCleanup(() => {
      query.removeEventListener('change', handleChange)
    })
  })

  /**
   * Watch for reduced motion changes
   */
  const watch = (callback: (prefersReduced: boolean) => void) => {
    if (typeof window === 'undefined') return () => {}

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => callback(query.matches)

    query.addEventListener('change', handleChange)

    return () => {
      query.removeEventListener('change', handleChange)
    }
  }

  /**
   * Check if animations should be enabled
   */
  const shouldAnimate = () => !prefersReduced() && isMotionEnabled()

  return {
    prefersReduced,
    mediaQuery,
    watch,
    shouldAnimate,
  }
}

// ============================================================================
// 3. STAGGER ANIMATION HOOK
// ============================================================================

/**
 * Hook for creating staggered animations for lists and grids
 * Perfect for anime collections, episode lists, and search results
 *
 * @param options - Stagger animation configuration
 * @returns Stagger animation utilities
 *
 * @example
 * ```tsx
 * const { getStaggerDelay, getStaggerProps } = useStaggerAnimation({
 *   baseDelay: 50,
 *   maxDelay: 500
 * })
 *
 * // In a list
 * <For each={items}>
 *   {(item, index) => (
 *     <div {...getStaggerProps(index())}>
 *       {item.name}
 *     </div>
 *   )}
 * </For>
 * ```
 */
export function useStaggerAnimation(
  options: {
    baseDelay?: number
    maxDelay?: number
    variant?: MotionPreset
    direction?: 'vertical' | 'horizontal'
  } = {}
) {
  const {
    baseDelay = 50,
    maxDelay = 500,
    variant: _variant = MOTION_VARIANTS.list.staggered,
    direction = 'vertical',
  } = options

  /**
   * Calculate stagger delay for a given index
   */
  const getStaggerDelay = (index: number): number => {
    const delay = index * baseDelay
    return Math.min(delay, maxDelay)
  }

  /**
   * Get staggered animation variant for a specific index
   */
  const getStaggerVariant = (index: number): MotionPreset => {
    return createStaggeredVariant(_variant, getStaggerDelay(index))
  }

  /**
   * Get animation props for a list item
   */
  const getStaggerProps = (index: number) => {
    const delay = getStaggerDelay(index)

    return {
      style: {
        'animation-delay': `${delay}ms`,
        'transition-delay': `${delay}ms`,
      },
      class: 'stagger-item',
      'data-stagger-index': index,
    }
  }

  /**
   * Get CSS for stagger animations
   */
  const getStaggerCSS = () => {
    return `
      .stagger-item {
        opacity: 0;
        transform: ${direction === 'vertical' ? 'translateY(20px)' : 'translateX(20px)'};
        animation: staggerIn ${getDuration('fast')}ms ${getEasing('easeOut')} forwards;
      }
      
      @keyframes staggerIn {
        to {
          opacity: 1;
          transform: translate(0, 0);
        }
      }
    `
  }

  return {
    getStaggerDelay,
    getStaggerVariant,
    getStaggerProps,
    getStaggerCSS,
  }
}

// ============================================================================
// 4. SCROLL ANIMATION HOOK
// ============================================================================

/**
 * Hook for scroll-triggered animations
 * Animates elements when they come into viewport
 * Perfect for lazy loading and progressive disclosure
 *
 * @param options - Scroll animation configuration
 * @returns Scroll animation utilities
 *
 * @example
 * ```tsx
 * const { isVisible, elementRef } = useScrollAnimation({
 *   threshold: 0.1,
 *   rootMargin: '50px'
 * })
 *
 * <div ref={elementRef} class={isVisible() ? 'animate-in' : 'animate-out'}>
 *   Content that animates on scroll
 * </div>
 * ```
 */
export function useScrollAnimation(
  options: {
    threshold?: number
    rootMargin?: string
    triggerOnce?: boolean
    variant?: MotionPreset
  } = {}
) {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true,
    variant: _variant = MOTION_VARIANTS.fade.fadeIn,
  } = options

  const [isVisible, setIsVisible] = createSignal(false)
  const [hasAnimated, setHasAnimated] = createSignal(false)
  let elementRef: HTMLElement | undefined
  let observer: IntersectionObserver | undefined

  onMount(() => {
    if (typeof window === 'undefined' || !elementRef) return

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!(triggerOnce && hasAnimated())) {
              setIsVisible(true)
              setHasAnimated(true)
            }
          } else if (!triggerOnce) {
            setIsVisible(false)
          }
        })
      },
      {
        threshold,
        rootMargin,
      }
    )

    observer.observe(elementRef)
  })

  onCleanup(() => {
    if (observer) {
      observer.disconnect()
      observer = undefined
    }
  })

  /**
   * Set the element to observe
   */
  const setElement = (el: HTMLElement) => {
    elementRef = el
  }

  /**
   * Get animation classes based on visibility
   */
  const getAnimationClasses = () => {
    const baseClasses = 'scroll-animate'
    if (isVisible()) {
      return `${baseClasses} scroll-animate-visible`
    }
    return `${baseClasses} scroll-animate-hidden`
  }

  /**
   * Get animation styles
   */
  const getAnimationStyles = () => {
    if (!isVisible()) {
      return {
        opacity: 0,
        transform: 'translateY(20px)',
        transition: `all ${getDuration('normal')}ms ${getEasing('easeOut')}`,
      }
    }
    return {
      opacity: 1,
      transform: 'translateY(0)',
      transition: `all ${getDuration('normal')}ms ${getEasing('easeOut')}`,
    }
  }

  return {
    // State
    isVisible,
    hasAnimated,

    // Ref
    elementRef: setElement,

    // Utilities
    getAnimationClasses,
    getAnimationStyles,

    // Manual control
    show: () => setIsVisible(true),
    hide: () => setIsVisible(false),
    reset: () => {
      setIsVisible(false)
      setHasAnimated(false)
    },
  }
}

// ============================================================================
// 5. INTERACTION ANIMATION HOOK
// ============================================================================

/**
 * Hook for hover, tap, and focus animations
 * Provides interactive feedback for user actions
 * Perfect for buttons, cards, and interactive elements
 *
 * @param options - Interaction animation configuration
 * @returns Interaction animation utilities
 *
 * @example
 * ```tsx
 * const { eventHandlers, animationState } = useInteractionAnimation({
 *   hoverVariant: MOTION_VARIANTS.hover.lift,
 *   tapVariant: MOTION_VARIANTS.tap.press
 * })
 *
 * <button {...eventHandlers}>
 *   Interactive Button
 * </button>
 * ```
 */
export function useInteractionAnimation(
  options: {
    hoverVariant?: MotionPreset
    tapVariant?: MotionPreset
    focusVariant?: MotionPreset
    disabled?: boolean
  } = {}
) {
  const {
    hoverVariant: _hoverVariant = MOTION_VARIANTS.hover.lift,
    tapVariant: _tapVariant = MOTION_VARIANTS.tap.press,
    focusVariant: _focusVariant = MOTION_VARIANTS.focus.scale,
    disabled = false,
  } = options

  const [isHovered, setIsHovered] = createSignal(false)
  const [isPressed, setIsPressed] = createSignal(false)
  const [isFocused, setIsFocused] = createSignal(false)

  /**
   * Get current animation state
   */
  const animationState = () => {
    if (disabled) return 'disabled'
    if (isPressed()) return 'active'
    if (isFocused()) return 'focus'
    if (isHovered()) return 'hover'
    return 'initial'
  }

  /**
   * Get animation styles based on current state
   */
  const getAnimationStyles = () => {
    const state = animationState()
    const variants = {
      initial: { opacity: 1, transform: 'scale(1)' },
      hover: { opacity: 1, transform: 'scale(1.05)' },
      active: { opacity: 0.8, transform: 'scale(0.95)' },
      focus: { opacity: 1, transform: 'scale(1.02)' },
      disabled: { opacity: 0.5, cursor: 'not-allowed' },
    }

    return {
      ...variants[state as keyof typeof variants],
      transition: `all ${getDuration('fast')}ms ${getEasing('easeOut')}`,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }
  }

  /**
   * Event handlers for interactions
   */
  const eventHandlers = {
    onMouseEnter: () => !disabled && setIsHovered(true),
    onMouseLeave: () => {
      setIsHovered(false)
      setIsPressed(false)
    },
    onMouseDown: () => !disabled && setIsPressed(true),
    onMouseUp: () => !disabled && setIsPressed(false),
    onFocus: () => !disabled && setIsFocused(true),
    onBlur: () => !disabled && setIsFocused(false),
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        setIsPressed(true)
      }
    },
    onKeyUp: (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        setIsPressed(false)
      }
    },
  }

  return {
    // State
    isHovered,
    isPressed,
    isFocused,
    animationState,

    // Utilities
    getAnimationStyles,
    eventHandlers,

    // Manual control
    setHovered: setIsHovered,
    setPressed: setIsPressed,
    setFocused: setIsFocused,
  }
}

// ============================================================================
// 6. LOADING ANIMATION HOOK
// ============================================================================

/**
 * Hook for loading states with animated skeletons
 * Provides various loading animations for different content types
 * Perfect for data fetching and async operations
 *
 * @param options - Loading animation configuration
 * @returns Loading animation utilities
 *
 * @example
 * ```tsx
 * const { isLoading, startLoading, stopLoading, getLoadingProps } = useLoadingAnimation({
 *   type: 'skeleton',
 *   size: 'medium'
 * })
 *
 * <div {...getLoadingProps()}>
 *   {isLoading() ? <LoadingSkeleton /> : <Content />}
 * </div>
 * ```
 */
export function useLoadingAnimation(
  options: {
    type?: 'spinner' | 'pulse' | 'dots' | 'skeleton'
    size?: 'small' | 'medium' | 'large'
    text?: string
    duration?: MotionDuration
  } = {}
) {
  const {
    type = 'skeleton',
    size = 'medium',
    text,
    duration = 'slow',
  } = options

  const [isLoading, setIsLoading] = createSignal(false)
  const [progress, setProgress] = createSignal(0)

  /**
   * Start loading animation
   */
  const startLoading = () => {
    setIsLoading(true)
    setProgress(0)
  }

  /**
   * Stop loading animation
   */
  const stopLoading = () => {
    setIsLoading(false)
    setProgress(100)
  }

  /**
   * Get loading animation props
   */
  const getLoadingProps = () => {
    const baseProps = {
      'aria-busy': isLoading(),
      'aria-label': isLoading() ? text || 'Loading...' : undefined,
    }

    if (!isLoading()) return baseProps

    const sizeClasses = {
      small: 'w-4 h-4',
      medium: 'w-8 h-8',
      large: 'w-12 h-12',
    }

    return {
      ...baseProps,
      class: `loading-animation loading-${type} ${sizeClasses[size]}`,
      style: {
        animation: `${type} ${getDuration(duration)}ms ${getEasing('linear')} infinite`,
      },
    }
  }

  /**
   * Get skeleton component props
   */
  const getSkeletonProps = () => {
    if (!isLoading()) return {}

    return {
      class: 'skeleton-loader',
      style: {
        background:
          'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: `skeleton ${getDuration('slow')}ms ${getEasing('easeInOut')} infinite`,
      },
    }
  }

  /**
   * Get loading configuration
   */
  const getLoadingConfig = () => {
    return {
      type,
      size,
      text,
      duration,
      isLoading: isLoading(),
      progress: progress(),
    }
  }

  /**
   * Render loading component (basic implementation)
   */
  const renderLoading = () => {
    if (!isLoading()) return null

    const props = getLoadingProps()
    return {
      tag: 'div',
      props,
      children: text || 'Loading...',
    }
  }

  return {
    // State
    isLoading,
    progress,

    // Actions
    startLoading,
    stopLoading,

    // Utilities
    getLoadingProps,
    getSkeletonProps,
    getLoadingConfig,
    renderLoading,

    // Manual control
    setLoading: setIsLoading,
    setProgress,
  }
}

// ============================================================================
// 7. MODAL ANIMATION HOOK
// ============================================================================

/**
 * Hook for modal and dialog animations
 * Provides smooth open/close animations with overlay effects
 * Perfect for confirmations, forms, and detailed views
 *
 * @param options - Modal animation configuration
 * @returns Modal animation utilities
 *
 * @example
 * ```tsx
 * const { isOpen, open, close, getModalProps, getOverlayProps } = useModalAnimation({
 *   overlayVariant: MOTION_VARIANTS.modal.overlay,
 *   contentVariant: MOTION_VARIANTS.modal.content
 * })
 *
 * <Show when={isOpen()}>
 *   <div {...getOverlayProps()} />
 *   <div {...getModalProps()}>
 *     Modal content
 *   </div>
 * </Show>
 * ```
 */
export function useModalAnimation(options: Partial<ModalMotionProps> = {}) {
  const {
    overlay: _overlay = MOTION_VARIANTS.modal.overlay,
    content: _content = MOTION_VARIANTS.modal.content,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    onClose,
  } = options

  const [isOpen, setIsOpen] = createSignal(false)
  const [isAnimating, setIsAnimating] = createSignal(false)

  /**
   * Open modal with animation
   */
  const open = () => {
    setIsOpen(true)
    setIsAnimating(true)

    // Add escape key listener
    if (closeOnEscape) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          close()
        }
      }
      document.addEventListener('keydown', handleEscape)

      // Store cleanup function
      ;(open as { _cleanup?: () => void })._cleanup = () => {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }

  /**
   * Close modal with animation
   */
  const close = () => {
    setIsAnimating(false)

    // Wait for animation to complete
    const waitForAnimation = () => {
      setIsOpen(false)
      onClose?.()

      // Clean up event listeners
      const openWithCleanup = open as { _cleanup?: () => void }
      if (openWithCleanup._cleanup) {
        openWithCleanup._cleanup()
      }
    }

    if (process.env.NODE_ENV === 'test') {
      queueMicrotask(waitForAnimation)
    } else {
      setTimeout(waitForAnimation, getDuration('normal'))
    }
  }

  /**
   * Get modal overlay props
   */
  const getOverlayProps = () => {
    return {
      class: `modal-overlay ${isAnimating() ? 'modal-overlay-visible' : 'modal-overlay-hidden'}`,
      style: {
        position: 'fixed',
        inset: 0,
        'z-index': 40,
        opacity: isAnimating() ? 1 : 0,
        transition: `all ${getDuration('fast')}ms ${getEasing('easeInOut')}`,
      },
      onClick: closeOnOverlayClick ? close : undefined,
      'aria-hidden': 'true',
    }
  }

  /**
   * Get modal content props
   */
  const getModalProps = () => {
    return {
      class: `modal-content ${isAnimating() ? 'modal-content-visible' : 'modal-content-hidden'}`,
      style: {
        position: 'fixed',
        'z-index': 50,
        opacity: isAnimating() ? 1 : 0,
        transform: isAnimating() ? 'scale(1)' : 'scale(0.9)',
        transition: `all ${getDuration('normal')}ms ${getEasing('easeOut')}`,
      },
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-title',
      'aria-describedby': 'modal-description',
    }
  }

  /**
   * Toggle modal state
   */
  const toggle = () => {
    if (isOpen()) {
      close()
    } else {
      open()
    }
  }

  onCleanup(() => {
    // Clean up any stored cleanup function
    const openWithCleanup = open as { _cleanup?: () => void }
    const cleanup = openWithCleanup._cleanup
    if (typeof cleanup === 'function') {
      cleanup()
      openWithCleanup._cleanup = undefined
    }
  })

  return {
    // State
    isOpen,
    isAnimating,

    // Actions
    open,
    close,
    toggle,

    // Utilities
    getOverlayProps,
    getModalProps,

    // Manual control
    setIsOpen,
  }
}

// ============================================================================
// 8. PAGE TRANSITION HOOK
// ============================================================================

/**
 * Hook for page-level transition animations
 * Provides smooth navigation between different pages/views
 * Perfect for single-page applications and route changes
 *
 * @param options - Page transition configuration
 * @returns Page transition utilities
 *
 * @example
 * ```tsx
 * const { isTransitioning, transitionTo, getPageProps } = usePageTransition({
 *   variant: MOTION_VARIANTS.page.fade,
 *   duration: 'normal'
 * })
 *
 * // Transition to new page
 * transitionTo('/new-page')
 *
 * <div {...getPageProps()}>
 *   Page content
 * </div>
 * ```
 */
export function usePageTransition(
  options: {
    variant?: MotionPreset
    duration?: MotionDuration
    easing?: MotionEasing
  } = {}
) {
  const {
    variant: _variant = MOTION_VARIANTS.page.fade,
    duration = 'normal',
    easing = 'easeInOut',
  } = options

  const [isTransitioning, setIsTransitioning] = createSignal(false)
  const [currentPage, setCurrentPage] = createSignal<string>('')
  const [transitionDirection, setTransitionDirection] = createSignal<
    'forward' | 'backward'
  >('forward')

  /**
   * Transition to a new page
   */
  const transitionTo = async (
    newPage: string,
    direction: 'forward' | 'backward' = 'forward'
  ) => {
    if (isTransitioning() || newPage === currentPage()) return

    setIsTransitioning(true)
    setTransitionDirection(direction)

    // Exit animation
    await new Promise((resolve) => {
      setTimeout(resolve, getDuration(duration) / 2)
    })

    // Change page
    setCurrentPage(newPage)

    // Enter animation
    await new Promise((resolve) => {
      setTimeout(resolve, getDuration(duration) / 2)
    })

    setIsTransitioning(false)
  }

  /**
   * Get page transition props
   */
  const getPageProps = (pageName?: string) => {
    const isActive = pageName ? pageName === currentPage() : true
    const isEntering = isActive && isTransitioning()
    const isExiting = !isActive && isTransitioning()

    const baseStyles = {
      transition: `all ${getDuration(duration)}ms ${getEasing(easing)}`,
    }

    if (isEntering) {
      return {
        ...baseStyles,
        opacity: 1,
        transform: 'translateY(0)',
        class: 'page-entering',
      }
    }

    if (isExiting) {
      return {
        ...baseStyles,
        opacity: 0,
        transform: 'translateY(-20px)',
        class: 'page-exiting',
      }
    }

    return {
      ...baseStyles,
      opacity: 1,
      transform: 'translateY(0)',
      class: 'page-active',
    }
  }

  /**
   * Get transition CSS classes
   */
  const getTransitionClasses = () => {
    const baseClass = 'page-transition'
    if (isTransitioning()) {
      return `${baseClass} page-transitioning page-transition-${transitionDirection()}`
    }
    return baseClass
  }

  return {
    // State
    isTransitioning,
    currentPage,
    transitionDirection,

    // Actions
    transitionTo,

    // Utilities
    getPageProps,
    getTransitionClasses,

    // Manual control
    startTransition: () => setIsTransitioning(true),
    stopTransition: () => setIsTransitioning(false),
    setCurrentPage,
  }
}

// ============================================================================
// 9. ANIMATION STATE HOOK
// ============================================================================

/**
 * Hook for managing animation states and callbacks
 * Provides comprehensive animation lifecycle management
 * Perfect for complex animations with multiple stages
 *
 * @param options - Animation state configuration
 * @returns Animation state utilities
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   startAnimation,
 *   stopAnimation,
 *   addEventListener
 * } = useAnimationState({
 *   onStart: () => console.log('Animation started'),
 *   onEnd: () => console.log('Animation ended')
 * })
 * ```
 */
export function useAnimationState(
  options: {
    onStart?: () => void
    onEnd?: () => void
    onProgress?: (progress: number) => void
    onCancel?: () => void
    duration?: MotionDuration
  } = {}
) {
  const { onStart, onEnd, onProgress, onCancel, duration = 'normal' } = options

  const [state, setState] = createSignal<
    'idle' | 'running' | 'paused' | 'completed' | 'cancelled'
  >('idle')
  const [progress, setProgress] = createSignal(0)
  const [startTime, setStartTime] = createSignal<number>(0)

  let animationFrame: number | undefined
  const eventListeners: Map<keyof AnimationEvents, (() => void)[]> = new Map()

  /**
   * Add event listener for animation events
   */
  const addEventListener = (
    event: keyof AnimationEvents,
    callback: () => void
  ) => {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, [])
    }
    eventListeners.get(event)!.push(callback)
  }

  /**
   * Remove event listener
   */
  const removeEventListener = (
    event: keyof AnimationEvents,
    callback: () => void
  ) => {
    const listeners = eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * Trigger event listeners
   */
  const triggerEvent = (event: keyof AnimationEvents) => {
    const listeners = eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => {
        callback()
      })
    }
  }

  /**
   * Start animation
   */
  const startAnimation = () => {
    if (state() === 'running') return

    const now = Date.now()
    setStartTime(now)
    setState('running')
    setProgress(0)

    triggerEvent('start')
    onStart?.()

    // Simulate animation progress
    const durationMs = getDuration(duration)
    const animate = () => {
      const currentProgress = Math.min((Date.now() - now) / durationMs, 1)

      setProgress(currentProgress)
      onProgress?.(currentProgress)

      if (currentProgress < 1 && state() === 'running') {
        animationFrame = requestAnimationFrame(animate)
      } else if (currentProgress >= 1) {
        completeAnimation()
      }
    }

    animationFrame = requestAnimationFrame(animate)
  }

  /**
   * Pause animation
   */
  const pauseAnimation = () => {
    if (state() !== 'running') return

    setState('paused')
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }
  }

  /**
   * Resume animation
   */
  const resumeAnimation = () => {
    if (state() !== 'paused') return

    setState('running')
    const durationMs = getDuration(duration)

    const animate = () => {
      const currentProgress = Math.min(
        (Date.now() - startTime()) / durationMs,
        1
      )

      setProgress(currentProgress)
      onProgress?.(currentProgress)

      if (currentProgress < 1 && state() === 'running') {
        animationFrame = requestAnimationFrame(animate)
      } else if (currentProgress >= 1) {
        completeAnimation()
      }
    }

    animationFrame = requestAnimationFrame(animate)
  }

  /**
   * Stop animation
   */
  const stopAnimation = () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }
    setState('idle')
    setProgress(0)
    triggerEvent('cancel')
    onCancel?.()
  }

  /**
   * Complete animation
   */
  const completeAnimation = () => {
    setState('completed')
    setProgress(1)
    triggerEvent('end')
    onEnd?.()
  }

  /**
   * Reset animation state
   */
  const resetAnimation = () => {
    stopAnimation()
    setState('idle')
    setProgress(0)
  }

  onCleanup(() => {
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame)
      animationFrame = undefined
    }
    // Clear event listeners
    eventListeners.clear()
  })

  return {
    // State
    state,
    progress,
    performance: () => null, // Simplified for now

    // Actions
    startAnimation,
    pauseAnimation,
    resumeAnimation,
    stopAnimation,
    completeAnimation,
    resetAnimation,

    // Events
    addEventListener,
    removeEventListener,

    // Utilities
    isRunning: () => state() === 'running',
    isPaused: () => state() === 'paused',
    isCompleted: () => state() === 'completed',
    isIdle: () => state() === 'idle',
  }
}

// ============================================================================
// 6. LAYOUT ANIMATION HOOK
// ============================================================================

/**
 * Hook for animating layout changes and reflows
 * Smoothly transitions between different layout states
 * Perfect for responsive design and dynamic content
 *
 * @param options - Layout animation configuration
 * @returns Layout animation utilities
 *
 * @example
 * ```tsx
 * const { animateLayout, getLayoutStyles } = useLayoutAnimation({
 *   duration: 'normal',
 *   easing: 'easeInOut'
 * })
 *
 * // Animate layout changes
 * animateLayout(fromLayout, toLayout)
 * ```
 */
export function useLayoutAnimation(
  options: {
    duration?: MotionDuration
    easing?: MotionEasing
    respectReducedMotion?: boolean
  } = {}
) {
  const {
    duration = 'normal',
    easing = 'easeInOut',
    respectReducedMotion = true,
  } = options

  const [isAnimating, setIsAnimating] = createSignal(false)
  const [currentLayout, setCurrentLayout] = createSignal<string>('')

  /**
   * Animate layout transition
   */
  const animateLayout = async (
    _fromLayout: string,
    toLayout: string,
    element?: HTMLElement
  ): Promise<void> => {
    if (respectReducedMotion && prefersReducedMotion()) {
      setCurrentLayout(toLayout)
      return
    }

    setIsAnimating(true)

    if (element) {
      // Use FLIP technique for smooth layout animations
      const fromRect = element.getBoundingClientRect()

      // Apply new layout
      setCurrentLayout(toLayout)

      // Measure new position
      const toRect = element.getBoundingClientRect()

      // Calculate transform
      const deltaX = fromRect.left - toRect.left
      const deltaY = fromRect.top - toRect.top
      const deltaW = fromRect.width / toRect.width
      const deltaH = fromRect.height / toRect.height

      // Apply inverse transform
      element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`
      element.style.transition = 'none'

      // Force reflow
      element.offsetHeight

      // Apply transition
      element.style.transition = `transform ${getDuration(duration)}ms ${getEasing(easing)}`
      element.style.transform = 'translate(0, 0) scale(1, 1)'

      // Clean up after animation
      setTimeout(() => {
        element.style.transform = ''
        element.style.transition = ''
        setIsAnimating(false)
      }, getDuration(duration))
    } else {
      // Fallback for non-element animations
      setCurrentLayout(toLayout)
      setTimeout(() => setIsAnimating(false), getDuration(duration))
    }
  }

  /**
   * Get layout animation styles
   */
  const getLayoutStyles = () => {
    return {
      transition: isAnimating()
        ? `all ${getDuration(duration)}ms ${getEasing(easing)}`
        : 'none',
    }
  }

  return {
    // State
    isAnimating,
    currentLayout,

    // Animation methods
    animateLayout,

    // Utilities
    getLayoutStyles,

    // Manual control
    startAnimation: () => setIsAnimating(true),
    stopAnimation: () => setIsAnimating(false),
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Combined hook for common animation patterns
 * Provides a convenient way to access multiple animation utilities
 */
export function useMotionAnimations() {
  const reducedMotion = useReducedMotion()
  const themeTransition = useThemeTransition()
  const animationState = useAnimationState()

  return {
    // Individual hooks
    reducedMotion,
    themeTransition,
    animationState,

    // Factory functions for other hooks
    useStagger: useStaggerAnimation,
    useScroll: useScrollAnimation,
    useInteraction: useInteractionAnimation,
    useLayout: useLayoutAnimation,
    useLoading: useLoadingAnimation,
    useModal: useModalAnimation,
    usePage: usePageTransition,

    // Direct access to motion system
    motion: createMotion(),
    themeMotion: createThemeMotion(),

    // Variants and presets
    variants: MOTION_VARIANTS,
    presets: MOTION_PRESETS,
    css: MOTION_CSS,
    keyframes: MOTION_KEYFRAMES,
  }
}

// Re-export types for convenience
export type {
  AnimationEvents,
  ReducedMotionPreference,
  ModalMotionProps,
} from '../types/motion'
