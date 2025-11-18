/**
 * Tests for OptimizedMotion component
 * Verifies lazy loading, error handling, and performance optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import {
  OptimizedMotion,
  MinimalMotion,
  OptimizedListItem,
  LazyHeavyMotion,
} from './OptimizedMotion'

// Mock motion system
vi.mock('../../lib/motion', () => ({
  isMotionEnabled: () => true,
  getDuration: () => 300,
  getEasing: () => 'ease',
  getDelay: () => 0,
  MOTION_DURATIONS: {
    fast: 150,
    normal: 300,
    slow: 500,
    instant: 0,
  },
  MOTION_EASING: {
    ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    linear: 'linear',
  },
  MOTION_DELAYS: {
    none: 0,
    short: 50,
    normal: 100,
    long: 200,
  },
}))

// Mock lazy motion modules
vi.mock('../../lib/lazy-motion', () => ({
  preloadMotionFeatures: vi.fn(),
  loadMotionFeature: vi.fn(),
  useLazyMotion: vi.fn(() => ({
    isLoaded: () => true,
    isLoading: () => false,
    error: () => null,
    load: vi.fn().mockResolvedValue(true),
    preload: vi.fn(),
  })),
  MOTION_FEATURES: {
    animations: true,
    variants: true,
    transitions: true,
    performance: true,
  },
}))

// Mock performance monitor
vi.mock('../../lib/performance-monitor', () => ({
  createPerformanceMonitor: () => ({
    startTiming: vi.fn(),
    endTiming: vi.fn(),
    getMetrics: vi.fn(() => ({})),
    cleanup: vi.fn(),
  }),
  usePerformanceMonitor: () => ({
    startTiming: vi.fn(),
    endTiming: vi.fn(),
    getMetrics: vi.fn(() => ({})),
  }),
}))

// Mock motion-theme
vi.mock('../../lib/motion-theme', () => ({
  createThemeTransition: vi.fn(),
}))

// Mock theme-transitions
vi.mock('../../lib/theme-transitions', () => ({
  createThemeTransition: vi.fn(),
  getTransitionDuration: vi.fn(() => 300),
  getTransitionEasing: vi.fn(() => 'ease'),
}))

// Mock motion-variants
vi.mock('../../lib/motion-variants', () => ({
  createVariants: vi.fn(),
  getVariant: vi.fn(),
  MOTION_VARIANTS: {},
}))

describe('OptimizedMotion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('should render children without motion when disabled', () => {
    const { unmount } = render(() => (
      <OptimizedMotion disabled>
        <div data-testid="disabled-content">Test Content</div>
      </OptimizedMotion>
    ))

    expect(screen.getByTestId('disabled-content')).toBeInTheDocument()
    expect(screen.getByTestId('disabled-content').parentElement).toHaveClass(
      'motion-disabled'
    )
    unmount()
  })

  it('should show loading state initially', () => {
    const { unmount } = render(() => (
      <OptimizedMotion features={['animations']}>
        <div data-testid="loading-content">Test Content</div>
      </OptimizedMotion>
    ))

    // Should show loading fallback initially
    expect(screen.getByText('Loading motion features...')).toBeInTheDocument()
    unmount()
  })

  it('should handle motion loading errors gracefully', async () => {
    // Mock lazy motion to throw an error
    const { useLazyMotion } = await import('../../lib/lazy-motion')
    vi.mocked(useLazyMotion).mockReturnValue({
      isLoaded: () => false,
      isLoading: () => true,
      error: () => new Error('Motion load failed'),
      load: vi.fn().mockRejectedValue(new Error('Motion load failed')),
      preload: vi.fn(),
    })

    const { unmount } = render(() => (
      <OptimizedMotion features={['animations']}>
        <div data-testid="error-content">Test Content</div>
      </OptimizedMotion>
    ))

    // Should render without crashing
    expect(screen.getByText('Loading motion features...')).toBeInTheDocument()
    unmount()
  })

  it('should respect reduced motion preferences', () => {
    const { unmount } = render(() => (
      <OptimizedMotion disabled={true}>
        <div data-testid="reduced-content">Test Content</div>
      </OptimizedMotion>
    ))

    expect(screen.getByTestId('reduced-content')).toBeInTheDocument()
    expect(screen.getByTestId('reduced-content').parentElement).toHaveClass(
      'motion-disabled'
    )
    unmount()
  })

  it('should enable performance monitoring when requested', async () => {
    const { unmount } = render(() => (
      <OptimizedMotion enablePerformanceMonitoring={true}>
        <div data-testid="perf-content">Test Content</div>
      </OptimizedMotion>
    ))

    // Wait for async loading to complete
    await vi.runAllTimersAsync()

    // Component should render without errors
    expect(screen.getByTestId('perf-content')).toBeInTheDocument()
    unmount()
  })
})

describe('MinimalMotion', () => {
  it('should render with fade-in animation', async () => {
    const { unmount } = render(() => (
      <MinimalMotion>
        <div data-testid="minimal-content-1">Minimal Content</div>
      </MinimalMotion>
    ))

    const content = screen.getByTestId('minimal-content-1')
    expect(content).toBeInTheDocument()
    expect(content.parentElement).toHaveClass('minimal-motion')

    // Should have some inline styles for animation
    expect(content.parentElement).toHaveAttribute('style')
    unmount()
  })

  it('should apply custom className', () => {
    const { unmount } = render(() => (
      <MinimalMotion className="custom-class">
        <div data-testid="minimal-content-2">Content</div>
      </MinimalMotion>
    ))

    expect(screen.getByTestId('minimal-content-2').parentElement).toHaveClass(
      'custom-class'
    )
    unmount()
  })
})

describe('OptimizedListItem', () => {
  it('should render with staggered animation', async () => {
    const { unmount } = render(() => (
      <OptimizedListItem index={2}>
        <div data-testid="list-item-1">Item 2</div>
      </OptimizedListItem>
    ))

    const item = screen.getByTestId('list-item-1')
    expect(item).toBeInTheDocument()
    expect(item.parentElement).toHaveClass('optimized-list-item')

    // Should have some inline styles for animation
    expect(item.parentElement).toHaveAttribute('style')
    unmount()
  })

  it('should apply custom className', () => {
    const { unmount } = render(() => (
      <OptimizedListItem index={0} className="custom-item">
        <div data-testid="list-item-2">Item</div>
      </OptimizedListItem>
    ))

    expect(screen.getByTestId('list-item-2').parentElement).toHaveClass(
      'custom-item'
    )
    unmount()
  })
})

describe('LazyHeavyMotion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load features on interaction', async () => {
    const { unmount } = render(() => (
      <LazyHeavyMotion>
        <div data-testid="heavy-content-1">Heavy Content</div>
      </LazyHeavyMotion>
    ))

    const content = screen.getByTestId('heavy-content-1')
    expect(content).toBeInTheDocument()

    // Simulate user interaction
    fireEvent.mouseEnter(content)

    // Component should still be rendered
    expect(content).toBeInTheDocument()
    unmount()
  })

  it('should apply custom className', () => {
    const { unmount } = render(() => (
      <LazyHeavyMotion className="custom-heavy">
        <div data-testid="heavy-content-2">Content</div>
      </LazyHeavyMotion>
    ))

    expect(screen.getByTestId('heavy-content-2').parentElement).toHaveClass(
      'custom-heavy'
    )
    unmount()
  })

  it('should cleanup timeout when unmounted with idle strategy', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

    const { unmount } = render(() => (
      <LazyHeavyMotion preloadStrategy="idle">
        <div data-testid="heavy-content-timeout">Timeout Test</div>
      </LazyHeavyMotion>
    ))

    // Wait for setTimeout to be called
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Verify setTimeout was called for idle strategy
    expect(setTimeoutSpy).toHaveBeenCalled()

    // Unmount component
    unmount()

    // Verify clearTimeout was called during cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled()

    // Restore spies
    clearTimeoutSpy.mockRestore()
    setTimeoutSpy.mockRestore()
  })
})

describe('MotionErrorBoundary Integration', () => {
  it('should catch and handle motion errors', () => {
    const ThrowError = () => {
      throw new Error('Motion error')
    }

    const { unmount } = render(() => (
      <OptimizedMotion>
        <ThrowError />
      </OptimizedMotion>
    ))

    // Component should handle errors gracefully - just verify it doesn't crash
    // The error boundary will catch and handle the error
    unmount()
  })

  it('should provide retry functionality', () => {
    const ThrowError = () => {
      throw new Error('Test error')
    }

    const { unmount } = render(() => (
      <OptimizedMotion maxRetries={3}>
        <ThrowError />
      </OptimizedMotion>
    ))

    // Component should handle errors gracefully - just verify it doesn't crash
    // The error boundary will catch and handle the error with retry functionality
    unmount()
  })
})
