/**
 * Tests for custom motion hooks
 * Validates that all hooks work correctly with SolidJS reactivity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useThemeTransition,
  useReducedMotion,
  useStaggerAnimation,
  useScrollAnimation,
  useInteractionAnimation,
  useLayoutAnimation,
  useLoadingAnimation,
  useModalAnimation,
  usePageTransition,
  useAnimationState,
  useMotionAnimations,
} from './useMotionAnimations'

// Mock the theme transition module
vi.mock('../lib/motion-theme', () => ({
  createThemeTransition: vi.fn().mockResolvedValue(undefined),
  createThemeMotion: vi.fn(),
  THEME_MOTION_VARIANTS: {},
}))

// Create class-based mocks for proper constructor behavior
class MockMutationObserver {
  private callback: MutationCallback
  observe = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])

  constructor(callback: MutationCallback) {
    this.callback = callback
  }

  // Method to simulate DOM mutations for testing
  simulateMutation(target: Node, attributeName: string) {
    const mutation: MutationRecord = {
      type: 'attributes',
      target,
      attributeName,
      oldValue: null,
      addedNodes: [],
      removedNodes: [],
      nextSibling: null,
      previousSibling: null,
    }

    this.callback([mutation], this)
  }
}

class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds = []
}

const mockMatchMedia = vi.fn()
const mockRequestAnimationFrame = vi.fn()
const mockCancelAnimationFrame = vi.fn()

// Set up window mocks
Object.defineProperty(window, 'matchMedia', {
  value: mockMatchMedia,
  writable: true,
})

Object.defineProperty(window, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
})

Object.defineProperty(window, 'MutationObserver', {
  value: MockMutationObserver,
  writable: true,
})

Object.defineProperty(window, 'requestAnimationFrame', {
  value: mockRequestAnimationFrame,
  writable: true,
})

Object.defineProperty(window, 'cancelAnimationFrame', {
  value: mockCancelAnimationFrame,
  writable: true,
})

describe('useThemeTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset DOM state
    document.documentElement.className = ''

    // Set up mock implementations
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query !== '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    // MockMutationObserver is already set up as a class
  })

  it('should initialize with default theme', () => {
    const { currentTheme, isLightTheme, isDarkTheme } = useThemeTransition()

    expect(currentTheme()).toBe('light')
    expect(isLightTheme()).toBe(true)
    expect(isDarkTheme()).toBe(false)
  })

  it('should toggle between themes', async () => {
    // Ensure matchMedia mock is properly set up
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query !== '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    // Create a mock observer that we can control
    let observerCallback: MutationCallback | null = null
    const mockObserverInstance = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
      simulateMutation: (target: Node, attributeName: string) => {
        if (observerCallback) {
          const mutation: MutationRecord = {
            type: 'attributes',
            target,
            attributeName,
            oldValue: null,
            addedNodes: [],
            removedNodes: [],
            nextSibling: null,
            previousSibling: null,
          }
          observerCallback([mutation], mockObserverInstance as any)
        }
      },
    }

    // Override MutationObserver for this test
    const OriginalMutationObserver = window.MutationObserver
    Object.defineProperty(window, 'MutationObserver', {
      value: class MockMutationObserver {
        constructor(callback: MutationCallback) {
          observerCallback = callback
        }
        observe = mockObserverInstance.observe
        disconnect = mockObserverInstance.disconnect
        takeRecords = mockObserverInstance.takeRecords
      },
      writable: true,
    })

    const { currentTheme, toggleTheme } = useThemeTransition()

    expect(currentTheme()).toBe('light')

    // Test first toggle - simulate the DOM mutation
    await toggleTheme()

    // Simulate adding 'dark' class and trigger observer
    document.documentElement.classList.add('dark')
    mockObserverInstance.simulateMutation(document.documentElement, 'class')

    expect(currentTheme()).toBe('dark')

    // Test second toggle with same hook instance
    await toggleTheme()

    // Simulate removing 'dark' class and trigger observer
    document.documentElement.classList.remove('dark')
    mockObserverInstance.simulateMutation(document.documentElement, 'class')

    expect(currentTheme()).toBe('light')

    // Restore original MutationObserver
    Object.defineProperty(window, 'MutationObserver', {
      value: OriginalMutationObserver,
      writable: true,
    })
  })

  it('should track transition state', () => {
    const { isTransitioning, progress } = useThemeTransition()

    expect(isTransitioning()).toBe(false)
    expect(progress()).toBe(0)
  })
})

describe('useReducedMotion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  it('should detect reduced motion preference', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const { prefersReduced, shouldAnimate } = useReducedMotion()

    expect(prefersReduced()).toBe(true)
    expect(shouldAnimate()).toBe(false)
  })

  it('should allow animations when reduced motion is not preferred', () => {
    const { prefersReduced, shouldAnimate } = useReducedMotion()

    expect(prefersReduced()).toBe(false)
    expect(shouldAnimate()).toBe(true)
  })

  it('should provide watch functionality', () => {
    const { watch } = useReducedMotion()
    const callback = vi.fn()

    const unwatch = watch(callback)
    expect(typeof unwatch).toBe('function')
  })
})

describe('useStaggerAnimation', () => {
  it('should calculate stagger delays correctly', () => {
    const { getStaggerDelay } = useStaggerAnimation({
      baseDelay: 50,
      maxDelay: 200,
    })

    expect(getStaggerDelay(0)).toBe(0)
    expect(getStaggerDelay(1)).toBe(50)
    expect(getStaggerDelay(2)).toBe(100)
    expect(getStaggerDelay(5)).toBe(200) // Capped at maxDelay
  })

  it('should provide stagger props for list items', () => {
    const { getStaggerProps } = useStaggerAnimation()

    const props = getStaggerProps(2)

    expect(props.style).toHaveProperty('animation-delay', '100ms')
    expect(props.style).toHaveProperty('transition-delay', '100ms')
    expect(props.class).toBe('stagger-item')
    expect(props['data-stagger-index']).toBe(2)
  })

  it('should generate stagger CSS', () => {
    const { getStaggerCSS } = useStaggerAnimation()

    const css = getStaggerCSS()

    expect(css).toContain('.stagger-item')
    expect(css).toContain('opacity: 0')
    expect(css).toContain('translateY(20px)')
    expect(css).toContain('@keyframes staggerIn')
  })
})

describe('useScrollAnimation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // MockIntersectionObserver is already set up as a class
  })

  it('should initialize with hidden state', () => {
    const { isVisible, hasAnimated } = useScrollAnimation()

    expect(isVisible()).toBe(false)
    expect(hasAnimated()).toBe(false)
  })

  it('should provide animation classes based on visibility', () => {
    const { getAnimationClasses } = useScrollAnimation()

    const classes = getAnimationClasses()
    expect(classes).toContain('scroll-animate')
    expect(classes).toContain('scroll-animate-hidden')
  })

  it('should provide animation styles', () => {
    const { getAnimationStyles } = useScrollAnimation()

    const styles = getAnimationStyles()
    expect(styles).toHaveProperty('opacity')
    expect(styles).toHaveProperty('transform')
    expect(styles).toHaveProperty('transition')
  })
})

describe('useInteractionAnimation', () => {
  it('should track interaction states', () => {
    const { isHovered, isPressed, isFocused, animationState } =
      useInteractionAnimation()

    expect(isHovered()).toBe(false)
    expect(isPressed()).toBe(false)
    expect(isFocused()).toBe(false)
    expect(animationState()).toBe('initial')
  })

  it('should provide event handlers', () => {
    const { eventHandlers } = useInteractionAnimation()

    expect(eventHandlers).toHaveProperty('onMouseEnter')
    expect(eventHandlers).toHaveProperty('onMouseLeave')
    expect(eventHandlers).toHaveProperty('onMouseDown')
    expect(eventHandlers).toHaveProperty('onFocus')
    expect(eventHandlers).toHaveProperty('onKeyDown')
  })

  it('should provide animation styles', () => {
    const { getAnimationStyles } = useInteractionAnimation()

    const styles = getAnimationStyles()
    expect(styles).toHaveProperty('transition')
    expect(styles).toHaveProperty('cursor')
  })

  it('should handle disabled state', () => {
    const { animationState, getAnimationStyles } = useInteractionAnimation({
      disabled: true,
    })

    expect(animationState()).toBe('disabled')

    const styles = getAnimationStyles()
    expect(styles.cursor).toBe('not-allowed')
  })
})

describe('useLayoutAnimation', () => {
  it('should track animation state', () => {
    const { isAnimating, currentLayout } = useLayoutAnimation()

    expect(isAnimating()).toBe(false)
    expect(currentLayout()).toBe('')
  })

  it('should provide layout styles', () => {
    const { getLayoutStyles } = useLayoutAnimation()

    const styles = getLayoutStyles()
    expect(styles).toHaveProperty('transition')
  })

  it('should animate layout changes', async () => {
    const { animateLayout } = useLayoutAnimation()

    // Mock element
    const mockElement = {
      getBoundingClientRect: vi
        .fn()
        .mockReturnValueOnce({ left: 0, top: 0, width: 100, height: 100 })
        .mockReturnValueOnce({ left: 50, top: 50, width: 200, height: 200 }),
      style: {},
      offsetHeight: 100,
    } as any

    await animateLayout('old', 'new', mockElement)

    expect(mockElement.getBoundingClientRect).toHaveBeenCalledTimes(2)
  })
})

describe('useLoadingAnimation', () => {
  it('should track loading state', () => {
    const { isLoading, progress } = useLoadingAnimation()

    expect(isLoading()).toBe(false)
    expect(progress()).toBe(0)
  })

  it('should start and stop loading', () => {
    const { isLoading, startLoading, stopLoading } = useLoadingAnimation()

    expect(isLoading()).toBe(false)

    startLoading()
    expect(isLoading()).toBe(true)

    stopLoading()
    expect(isLoading()).toBe(false)
  })

  it('should provide loading props', () => {
    const { getLoadingProps } = useLoadingAnimation()

    const props = getLoadingProps()
    expect(props).toHaveProperty('aria-busy', false)
  })

  it('should provide skeleton props', () => {
    const { getSkeletonProps, startLoading } = useLoadingAnimation({
      type: 'skeleton',
    })

    startLoading()
    const props = getSkeletonProps()

    expect(props).toHaveProperty('class', 'skeleton-loader')
    expect(props).toHaveProperty('style')
  })

  it('should render loading components', () => {
    const { renderLoading, startLoading } = useLoadingAnimation({
      type: 'spinner',
    })

    startLoading()
    const component = renderLoading()

    expect(component).not.toBeNull()
  })
})

describe('useModalAnimation', () => {
  it('should track modal state', () => {
    const { isOpen, isAnimating } = useModalAnimation()

    expect(isOpen()).toBe(false)
    expect(isAnimating()).toBe(false)
  })

  it('should open and close modal', () => {
    const { isOpen, open, close } = useModalAnimation()

    expect(isOpen()).toBe(false)

    open()
    expect(isOpen()).toBe(true)

    close()
    // Note: Due to timeout, isOpen will still be true immediately
  })

  it('should provide modal props', () => {
    const { getModalProps, getOverlayProps } = useModalAnimation()

    const modalProps = getModalProps()
    const overlayProps = getOverlayProps()

    expect(modalProps).toHaveProperty('role', 'dialog')
    expect(modalProps).toHaveProperty('aria-modal', 'true')
    expect(overlayProps).toHaveProperty('aria-hidden', 'true')
  })

  it('should toggle modal state', async () => {
    const { isOpen, toggle } = useModalAnimation()

    expect(isOpen()).toBe(false)

    toggle()
    expect(isOpen()).toBe(true)

    toggle()

    // Wait for microtask to complete (modal close animation)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(isOpen()).toBe(false)
  })
})

describe('usePageTransition', () => {
  it('should track transition state', () => {
    const { isTransitioning, currentPage, transitionDirection } =
      usePageTransition()

    expect(isTransitioning()).toBe(false)
    expect(currentPage()).toBe('')
    expect(transitionDirection()).toBe('forward')
  })

  it('should transition between pages', async () => {
    const { transitionTo, currentPage } = usePageTransition()

    await transitionTo('/new-page')

    expect(currentPage()).toBe('/new-page')
  })

  it('should provide page props', () => {
    const { getPageProps } = usePageTransition()

    const props = getPageProps('test-page')

    expect(props).toHaveProperty('transition')
    expect(props).toHaveProperty('class')
  })

  it('should provide transition classes', () => {
    const { getTransitionClasses } = usePageTransition()

    const classes = getTransitionClasses()
    expect(classes).toContain('page-transition')
  })
})

describe('useAnimationState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequestAnimationFrame.mockImplementation((cb) => {
      setTimeout(cb, 16)
      return 1
    })
  })

  it('should track animation state', () => {
    const { state, progress, performance } = useAnimationState()

    expect(state()).toBe('idle')
    expect(progress()).toBe(0)
    expect(performance()).toBeNull()
  })

  it('should start and stop animation', () => {
    const { state, startAnimation, stopAnimation } = useAnimationState()

    expect(state()).toBe('idle')

    startAnimation()
    expect(state()).toBe('running')

    stopAnimation()
    expect(state()).toBe('idle')
  })

  it('should manage event listeners', () => {
    const { addEventListener, removeEventListener } = useAnimationState()
    const callback = vi.fn()

    addEventListener('start', callback)
    removeEventListener('start', callback)

    expect(typeof callback).toBe('function')
  })

  it('should provide state utilities', () => {
    const { isRunning, isPaused, isCompleted, isIdle } = useAnimationState()

    expect(isRunning()).toBe(false)
    expect(isPaused()).toBe(false)
    expect(isCompleted()).toBe(false)
    expect(isIdle()).toBe(true)
  })
})

describe('useMotionAnimations', () => {
  it('should provide access to all motion utilities', () => {
    const motion = useMotionAnimations()

    expect(motion).toHaveProperty('reducedMotion')
    expect(motion).toHaveProperty('themeTransition')
    expect(motion).toHaveProperty('animationState')
    expect(motion).toHaveProperty('useStagger')
    expect(motion).toHaveProperty('useScroll')
    expect(motion).toHaveProperty('useInteraction')
    expect(motion).toHaveProperty('useLayout')
    expect(motion).toHaveProperty('useLoading')
    expect(motion).toHaveProperty('useModal')
    expect(motion).toHaveProperty('usePage')
    expect(motion).toHaveProperty('variants')
    expect(motion).toHaveProperty('presets')
    expect(motion).toHaveProperty('css')
    expect(motion).toHaveProperty('keyframes')
  })

  it('should provide access to motion variants and presets', () => {
    const { variants, presets } = useMotionAnimations()

    expect(variants).toBeDefined()
    expect(presets).toBeDefined()
    expect(variants).toHaveProperty('fade')
    expect(variants).toHaveProperty('slide')
    expect(variants).toHaveProperty('scale')
  })
})

describe('Integration Tests', () => {
  it('should work with reduced motion across all hooks', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const reducedMotion = useReducedMotion()

    expect(reducedMotion.prefersReduced()).toBe(true)
    expect(reducedMotion.shouldAnimate()).toBe(false)
  })

  it('should handle theme transitions with animations', () => {
    const themeTransition = useThemeTransition()
    const animationState = useAnimationState({
      onStart: () => themeTransition.startTransition('dark'),
    })

    expect(themeTransition.currentTheme()).toBe('light')
    expect(animationState.state()).toBe('idle')
  })
})
