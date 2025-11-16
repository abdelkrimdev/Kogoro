/**
 * Tests for theme transition utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  prefersReducedMotion,
  addThemeTransition,
  removeThemeTransition,
  createSmoothThemeTransition,
  getTransitionDuration,
  getTransitionEasing,
  addTransitionListener,
  watchReducedMotion,
} from './theme-transitions'

// Mock window and document
const mockMatchMedia = vi.fn()
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
})

const mockElement = {
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(),
  },
  style: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as HTMLElement

describe('theme-transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default (no reduced motion)
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  describe('prefersReducedMotion', () => {
    it('should return false when reduced motion is not preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      expect(prefersReducedMotion()).toBe(false)
    })

    it('should return true when reduced motion is preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      expect(prefersReducedMotion()).toBe(true)
    })

    it('should return false on server side', () => {
      const originalWindow = (global as typeof globalThis & { window?: Window })
        .window
      // @ts-expect-error - Intentionally deleting window for server-side test
      delete (global as typeof globalThis & { window?: Window }).window
      expect(prefersReducedMotion()).toBe(false)
      // @ts-expect-error - Restoring window for test
      global.window = originalWindow
    })
  })

  describe('addThemeTransition', () => {
    it('should add transition class when reduced motion is not preferred', () => {
      addThemeTransition(mockElement, 'test-class')
      expect(mockElement.classList.add).toHaveBeenCalledWith('test-class')
    })

    it('should not add transition class when reduced motion is preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      addThemeTransition(mockElement, 'test-class')
      expect(mockElement.classList.add).not.toHaveBeenCalled()
    })

    it('should not add transition class for null element', () => {
      addThemeTransition(null as unknown as HTMLElement, 'test-class')
      expect(mockElement.classList.add).not.toHaveBeenCalled()
    })
  })

  describe('removeThemeTransition', () => {
    it('should remove transition class', () => {
      removeThemeTransition(mockElement, 'test-class')
      expect(mockElement.classList.remove).toHaveBeenCalledWith('test-class')
    })

    it('should not remove transition class for null element', () => {
      removeThemeTransition(null as unknown as HTMLElement, 'test-class')
      expect(mockElement.classList.remove).not.toHaveBeenCalled()
    })
  })

  describe('getTransitionDuration', () => {
    it('should return 300ms when reduced motion is not preferred', () => {
      expect(getTransitionDuration()).toBe(300)
    })

    it('should return 0ms when reduced motion is preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      expect(getTransitionDuration()).toBe(0)
    })
  })

  describe('getTransitionEasing', () => {
    it('should return the correct easing function', () => {
      expect(getTransitionEasing()).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
    })
  })

  describe('createSmoothThemeTransition', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should create smooth transition and resolve after duration', async () => {
      const callback = vi.fn()
      const promise = createSmoothThemeTransition(callback, 300)

      expect(callback).toHaveBeenCalled()

      vi.advanceTimersByTime(300)
      await expect(promise).resolves.toBeUndefined()
    })

    it('should execute immediately when reduced motion is preferred', async () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      const callback = vi.fn()
      const promise = createSmoothThemeTransition(callback, 300)

      expect(callback).toHaveBeenCalled()

      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('addTransitionListener', () => {
    it('should add transition listener when reduced motion is not preferred', () => {
      const callback = vi.fn()
      addTransitionListener(mockElement, 'background-color', callback)
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'transitionend',
        expect.any(Function)
      )
    })

    it('should execute callback immediately when reduced motion is preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      const callback = vi.fn()
      addTransitionListener(mockElement, 'background-color', callback)
      expect(callback).toHaveBeenCalled()
      expect(mockElement.addEventListener).not.toHaveBeenCalled()
    })
  })

  describe('watchReducedMotion', () => {
    it('should set up media query listener', () => {
      const mockMediaQuery = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      mockMatchMedia.mockReturnValue(mockMediaQuery)

      const callback = vi.fn()
      const cleanup = watchReducedMotion(callback)

      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
      expect(typeof cleanup).toBe('function')
    })

    it('should return noop function on server side', () => {
      const originalWindow = (global as typeof globalThis & { window?: Window })
        .window
      // @ts-expect-error - Intentionally deleting window for server-side test
      delete (global as typeof globalThis & { window?: Window }).window

      const callback = vi.fn()
      const cleanup = watchReducedMotion(callback)

      expect(typeof cleanup).toBe('function')
      expect(cleanup).not.toThrow()

      // @ts-expect-error - Restoring window for test
      global.window = originalWindow
    })
  })
})
