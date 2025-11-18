/**
 * Test utilities for UI components
 * Provides common mock configurations and cleanup helpers
 */

import { vi, cleanup } from 'vitest'
import { render } from '@solidjs/testing-library'

// Mock motion system with all required exports
export const mockMotionSystem = () => {
  vi.mock('../../lib/motion', () => ({
    isMotionEnabled: vi.fn(() => true),
    getDuration: vi.fn(() => 300),
    getEasing: vi.fn(() => 'ease-out'),
    getDelay: vi.fn(() => 0),
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
}

// Mock lazy motion system
export const mockLazyMotion = () => {
  vi.mock('../../lib/lazy-motion', () => ({
    preloadMotionFeatures: vi.fn(),
    loadMotionFeature: vi.fn(),
    useLazyMotion: vi.fn(() => ({
      isLoaded: () => true,
      isLoading: () => false,
      error: () => null,
      load: vi.fn(),
      preload: vi.fn(),
    })),
    MOTION_FEATURES: {
      animations: true,
      variants: true,
      transitions: true,
      performance: true,
    },
  }))
}

// Mock motion hooks
export const mockMotionHooks = () => {
  vi.mock('../../hooks/useMotionAnimations', () => ({
    useReducedMotion: () => ({
      shouldAnimate: () => true,
    }),
    useMotionAnimations: () => ({
      enter: () => ({ opacity: 1 }),
      exit: () => ({ opacity: 0 }),
    }),
  }))
}

// Mock performance monitor
export const mockPerformanceMonitor = () => {
  vi.mock('../../lib/performance-monitor', () => ({
    createPerformanceMonitor: () => ({
      startTiming: vi.fn(),
      endTiming: vi.fn(),
      measure: vi.fn(),
      getMetrics: vi.fn(() => ({})),
      reset: vi.fn(),
    }),
  }))
}

// Setup all common mocks
export const setupCommonMocks = () => {
  mockMotionSystem()
  mockLazyMotion()
  mockMotionHooks()
  mockPerformanceMonitor()
}

// Custom render function with cleanup
export const renderWithCleanup = (ui: () => JSX.Element, options = {}) => {
  cleanup()
  return render(ui, options)
}

// Test setup helper
export const setupTest = () => {
  vi.useFakeTimers()
  setupCommonMocks()
  cleanup()
}

// Test teardown helper
export const teardownTest = () => {
  vi.useRealTimers()
  vi.clearAllMocks()
  cleanup()
}

// Mock window.location.reload
export const mockWindowReload = () => {
  const mockReload = vi.fn()
  delete (window.location as Location & { reload?: () => void }).reload
  Object.defineProperty(window.location, 'reload', {
    value: mockReload,
    writable: true,
    configurable: true,
  })
  return mockReload
}
