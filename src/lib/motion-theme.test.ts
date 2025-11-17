/**
 * Tests for motion-theme utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  initializeThemeMotion,
  getThemeMotionState,
  isThemeMotionEnabled,
  createThemeMotionPreset,
  getThemeMotionPreset,
  createThemeTransition,
  createColorAnimation,
  getThemeMotionCSS,
  applyThemeMotionClasses,
  removeThemeMotionClasses,
  getAnimeCollectionPreset,
  createStaggeredAnimation,
  optimizeThemeTransitions,
  createThemeMotion,
  ANIME_COLLECTION_MOTION_PRESETS,
} from './motion-theme'
import type { MotionPreset } from '../types/motion'
import { getCurrentTheme } from './theme-helpers'
import { prefersReducedMotion } from './theme-transitions'

// Mock dependencies
vi.mock('./theme-helpers', () => ({
  getCurrentTheme: vi.fn(() => 'light'),
}))

vi.mock('./theme-transitions', () => ({
  prefersReducedMotion: vi.fn(() => false),
  watchReducedMotion: vi.fn(() => vi.fn()),
}))

vi.mock('./theme-constants', () => ({
  THEME_COLORS: {
    bgPrimary: 'rgb(var(--bg-primary))',
    bgSecondary: 'rgb(var(--bg-secondary))',
  },
  SEMANTIC_COLORS: {
    success: {
      light: 'rgb(34 197 94)',
      dark: 'rgb(74 222 128)',
      bg: 'rgb(34 197 94 / 0.1)',
      border: 'rgb(34 197 94 / 0.2)',
    },
    warning: {
      light: 'rgb(234 179 8)',
      dark: 'rgb(250 204 21)',
      bg: 'rgb(234 179 8 / 0.1)',
      border: 'rgb(234 179 8 / 0.2)',
    },
  },
}))

vi.mock('./motion', () => ({
  MOTION_PRESETS: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.3, easing: 'ease-out' },
    },
  } as const,
  THEME_MOTION_VARIANTS: {
    light: {
      subtle: {
        initial: { opacity: 0.8 },
        animate: { opacity: 1 },
        transition: { duration: 0.2 },
      },
    },
    dark: {
      subtle: {
        initial: { opacity: 0.9 },
        animate: { opacity: 1 },
        transition: { duration: 0.2 },
      },
    },
  } as const,
  getDuration: vi.fn((duration) => {
    const durations = { fast: 150, normal: 300, slow: 500 }
    return durations[duration as keyof typeof durations] || 300
  }),
  getEasing: vi.fn((easing) => easing || 'ease-out'),
  getDelay: vi.fn((delay) => {
    const delays = { none: 0, short: 100, medium: 200 }
    return delays[delay as keyof typeof delays] || 0
  }),
  isMotionEnabled: vi.fn(() => true),
}))

describe('motion-theme utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize theme motion system', () => {
      expect(() => initializeThemeMotion()).not.toThrow()
    })

    it('should return initial theme motion state', () => {
      const state = getThemeMotionState()
      expect(state).toHaveProperty('currentTheme')
      expect(state).toHaveProperty('isTransitioning')
      expect(state).toHaveProperty('transitionProgress')
      expect(state).toHaveProperty('reducedMotion')
      expect(state).toHaveProperty('enabled')
    })
  })

  describe('theme motion state', () => {
    it('should check if theme motion is enabled', () => {
      const result = isThemeMotionEnabled()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('theme motion presets', () => {
    it('should create theme motion preset', () => {
      const preset = createThemeMotionPreset(
        { initial: { scale: 0.8 } },
        { initial: { scale: 0.9 } }
      )

      expect(preset).toHaveProperty('light')
      expect(preset).toHaveProperty('dark')
      expect(preset.light).toHaveProperty('initial')
      expect(preset.light).toHaveProperty('animate')
      expect(preset.light).toHaveProperty('exit')
      expect(preset.light).toHaveProperty('transition')
    })

    it('should get theme motion preset', () => {
      const preset = getThemeMotionPreset('fadeIn')
      expect(preset).toHaveProperty('initial')
      expect(preset).toHaveProperty('animate')
      expect(preset).toHaveProperty('exit')
      expect(preset).toHaveProperty('transition')
    })
  })

  describe('theme transitions', () => {
    it('should create theme transition', async () => {
      const promise = createThemeTransition({
        duration: 'fast',
        onTransitionStart: vi.fn(),
        onTransitionEnd: vi.fn(),
      })

      expect(promise).toBeInstanceOf(Promise)
      await expect(promise).resolves.toBeUndefined()
    })

    it('should skip transition when reduced motion is preferred', async () => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true)

      const onStart = vi.fn()
      const onEnd = vi.fn()

      await createThemeTransition({
        respectReducedMotion: true,
        onTransitionStart: onStart,
        onTransitionEnd: onEnd,
      })

      expect(onStart).toHaveBeenCalled()
      expect(onEnd).toHaveBeenCalled()
    })
  })

  describe('color animations', () => {
    it('should create color animation', () => {
      const animation = createColorAnimation({
        fromColor: 'success',
        toColor: 'warning',
        property: 'backgroundColor',
        respectReducedMotion: false,
      })

      expect(animation).toHaveProperty('initial')
      expect(animation).toHaveProperty('animate')
      expect(animation).toHaveProperty('transition')
    })

    it('should return empty animation when reduced motion is preferred', () => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true)

      const animation = createColorAnimation({
        fromColor: 'success',
        property: 'backgroundColor',
        respectReducedMotion: true,
      })

      expect(animation).toEqual({})
    })
  })

  describe('CSS utilities', () => {
    it('should generate theme motion CSS', () => {
      const css = getThemeMotionCSS()
      expect(typeof css).toBe('string')
      expect(css).toContain('--motion-theme-duration')
      expect(css).toContain('--motion-theme-easing')
    })

    it('should apply theme motion classes to element', () => {
      const element = {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        style: {
          setProperty: vi.fn(),
          removeProperty: vi.fn(),
        },
      } as any

      applyThemeMotionClasses(element)
      expect(element.classList.add).toHaveBeenCalledWith('theme-motion-subtle')
      expect(element.style.setProperty).toHaveBeenCalled()
    })

    it('should remove theme motion classes from element', () => {
      const element = {
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        style: {
          setProperty: vi.fn(),
          removeProperty: vi.fn(),
        },
      } as any

      removeThemeMotionClasses(element)
      expect(element.classList.remove).toHaveBeenCalledWith(
        'theme-motion-subtle'
      )
      expect(element.style.removeProperty).toHaveBeenCalled()
    })
  })

  describe('anime collection presets', () => {
    it('should have defined anime collection presets', () => {
      expect(ANIME_COLLECTION_MOTION_PRESETS).toHaveProperty('animeCard')
      expect(ANIME_COLLECTION_MOTION_PRESETS).toHaveProperty('episodeItem')
      expect(ANIME_COLLECTION_MOTION_PRESETS).toHaveProperty('searchResult')
      expect(ANIME_COLLECTION_MOTION_PRESETS).toHaveProperty('collectionGrid')
      expect(ANIME_COLLECTION_MOTION_PRESETS).toHaveProperty('themeSwitch')
    })

    it('should get anime collection preset', () => {
      const preset = getAnimeCollectionPreset('animeCard')
      expect(preset).toHaveProperty('initial')
      expect(preset).toHaveProperty('animate')
      expect(preset).toHaveProperty('exit')
      expect(preset).toHaveProperty('transition')
    })
  })

  describe('staggered animations', () => {
    it('should create staggered animation', () => {
      const basePreset: MotionPreset = {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3 },
      }

      const staggered = createStaggeredAnimation(basePreset, 3, 50)
      expect(staggered).toHaveLength(3)
      expect(staggered[0].transition?.delay).toBe(0)
      expect(staggered[1].transition?.delay).toBe(0.05)
      expect(staggered[2].transition?.delay).toBe(0.1)
    })
  })

  describe('performance optimization', () => {
    it('should optimize theme transitions', () => {
      expect(() => optimizeThemeTransitions()).not.toThrow()
    })
  })

  describe('createThemeMotion hook', () => {
    it('should create theme motion hook with all utilities', () => {
      const hook = createThemeMotion()

      expect(hook).toHaveProperty('state')
      expect(hook).toHaveProperty('isEnabled')
      expect(hook).toHaveProperty('getCurrentTheme')
      expect(hook).toHaveProperty('isTransitioning')
      expect(hook).toHaveProperty('getTransitionProgress')

      expect(hook).toHaveProperty('createTransition')
      expect(hook).toHaveProperty('createColorAnimation')
      expect(hook).toHaveProperty('getPreset')
      expect(hook).toHaveProperty('getAnimePreset')
      expect(hook).toHaveProperty('createStaggered')

      expect(hook).toHaveProperty('getCSS')
      expect(hook).toHaveProperty('applyClasses')
      expect(hook).toHaveProperty('removeClasses')

      expect(hook).toHaveProperty('presets')
      expect(hook).toHaveProperty('animePresets')
      expect(hook).toHaveProperty('themeVariants')

      expect(hook).toHaveProperty('optimize')
    })
  })
})
