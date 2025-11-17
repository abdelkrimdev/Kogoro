/**
 * Tests for motion configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  initializeMotion,
  getMotionState,
  isMotionEnabled,
  getDuration,
  getEasing,
  getDelay,
  MOTION_PRESETS,
  THEME_MOTION_VARIANTS,
  createMotionPreset,
  getThemeMotion,
  MOTION_CSS,
  MOTION_KEYFRAMES,
  createMotion,
  type MotionPreset,
  type MotionDuration,
  type MotionEasing,
  type MotionDelay,
  type ThemeMotionVariant,
} from './motion'

// Mock window and matchMedia
const mockMatchMedia = vi.fn()
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
})

describe('motion configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset motion state
    vi.stubGlobal('window', {
      matchMedia: mockMatchMedia,
    })
  })

  describe('initialization', () => {
    it('should initialize motion system', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      initializeMotion()
      const state = getMotionState()

      expect(state.reducedMotion).toBe(false)
      expect(state.enabled).toBe(true)
    })

    it('should detect reduced motion preference', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      initializeMotion()
      const state = getMotionState()

      expect(state.reducedMotion).toBe(true)
      expect(state.enabled).toBe(true)
    })
  })

  describe('motion state', () => {
    it('should return correct motion enabled state', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      initializeMotion()
      expect(isMotionEnabled()).toBe(true)
    })

    it('should return false when reduced motion is preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      initializeMotion()
      expect(isMotionEnabled()).toBe(false)
    })
  })

  describe('duration utilities', () => {
    beforeEach(() => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      initializeMotion()
    })

    it('should return correct durations', () => {
      expect(getDuration('fast')).toBe(150)
      expect(getDuration('normal')).toBe(300)
      expect(getDuration('slow')).toBe(500)
      expect(getDuration('instant')).toBe(0)
    })

    it('should return 0 when motion is disabled', () => {
      // Mock reduced motion
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      initializeMotion()

      expect(getDuration('fast')).toBe(0)
      expect(getDuration('normal')).toBe(0)
      expect(getDuration('slow')).toBe(0)
    })
  })

  describe('easing utilities', () => {
    it('should return correct easing functions', () => {
      expect(getEasing('ease')).toBe('cubic-bezier(0.25, 0.1, 0.25, 1)')
      expect(getEasing('easeIn')).toBe('cubic-bezier(0.42, 0, 1, 1)')
      expect(getEasing('easeOut')).toBe('cubic-bezier(0, 0, 0.58, 1)')
      expect(getEasing('easeInOut')).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
      expect(getEasing('bounce')).toBe('cubic-bezier(0.68, -0.55, 0.265, 1.55)')
      expect(getEasing('linear')).toBe('linear')
    })
  })

  describe('delay utilities', () => {
    beforeEach(() => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      initializeMotion()
    })

    it('should return correct delays', () => {
      expect(getDelay('none')).toBe(0)
      expect(getDelay('short')).toBe(50)
      expect(getDelay('normal')).toBe(100)
      expect(getDelay('long')).toBe(200)
    })

    it('should return 0 when motion is disabled', () => {
      // Mock reduced motion
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      initializeMotion()

      expect(getDelay('short')).toBe(0)
      expect(getDelay('normal')).toBe(0)
      expect(getDelay('long')).toBe(0)
    })
  })

  describe('motion presets', () => {
    it('should have all required presets', () => {
      expect(MOTION_PRESETS.fadeIn).toBeDefined()
      expect(MOTION_PRESETS.fadeOut).toBeDefined()
      expect(MOTION_PRESETS.slideInRight).toBeDefined()
      expect(MOTION_PRESETS.slideInLeft).toBeDefined()
      expect(MOTION_PRESETS.slideInUp).toBeDefined()
      expect(MOTION_PRESETS.slideInDown).toBeDefined()
      expect(MOTION_PRESETS.scaleIn).toBeDefined()
      expect(MOTION_PRESETS.scaleOut).toBeDefined()
      expect(MOTION_PRESETS.bounceIn).toBeDefined()
      expect(MOTION_PRESETS.themeTransition).toBeDefined()
      expect(MOTION_PRESETS.listItem).toBeDefined()
      expect(MOTION_PRESETS.gridItem).toBeDefined()
      expect(MOTION_PRESETS.modalOverlay).toBeDefined()
      expect(MOTION_PRESETS.modalContent).toBeDefined()
      expect(MOTION_PRESETS.sidebar).toBeDefined()
      expect(MOTION_PRESETS.pulse).toBeDefined()
      expect(MOTION_PRESETS.spin).toBeDefined()
    })

    it('should have correct preset structure', () => {
      const preset = MOTION_PRESETS.fadeIn
      expect(preset).toHaveProperty('initial')
      expect(preset).toHaveProperty('animate')
      expect(preset).toHaveProperty('exit')
      expect(preset).toHaveProperty('transition')
    })
  })

  describe('theme motion variants', () => {
    it('should have theme-specific variants', () => {
      expect(THEME_MOTION_VARIANTS.light).toBeDefined()
      expect(THEME_MOTION_VARIANTS.dark).toBeDefined()
      expect(THEME_MOTION_VARIANTS.light.subtle).toBeDefined()
      expect(THEME_MOTION_VARIANTS.light.vibrant).toBeDefined()
      expect(THEME_MOTION_VARIANTS.dark.subtle).toBeDefined()
      expect(THEME_MOTION_VARIANTS.dark.vibrant).toBeDefined()
    })

    it('should return correct theme motion', () => {
      const lightMotion = getThemeMotion('light', 'subtle')
      const darkMotion = getThemeMotion('dark', 'subtle')

      expect(lightMotion).toBeDefined()
      expect(darkMotion).toBeDefined()
      expect(lightMotion).not.toBe(darkMotion)
    })
  })

  describe('custom preset creation', () => {
    it('should create custom motion preset', () => {
      const customPreset = createMotionPreset({
        transition: { duration: 0.5 },
      })

      expect(customPreset.initial.opacity).toBe(0)
      expect(customPreset.animate.opacity).toBe(1)
      expect(customPreset.exit.opacity).toBe(0)
      expect(customPreset.transition.duration).toBe(0.5)
    })
  })

  describe('CSS utilities', () => {
    beforeEach(() => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
      initializeMotion()
    })

    it('should generate CSS transition strings', () => {
      const transition = MOTION_CSS.transition(
        ['opacity', 'transform'],
        'fast',
        'easeOut'
      )
      expect(transition).toContain('opacity')
      expect(transition).toContain('transform')
      expect(transition).toContain('150ms')
      expect(transition).toContain('cubic-bezier(0, 0, 0.58, 1)')
    })

    it('should generate CSS animation strings', () => {
      const animation = MOTION_CSS.animation(
        'fadeIn',
        'normal',
        'easeInOut',
        'short',
        2
      )
      expect(animation).toBe(
        'fadeIn 300ms cubic-bezier(0.4, 0, 0.2, 1) 50ms 2 normal'
      )
    })

    it('should generate CSS animation strings', () => {
      const animation = MOTION_CSS.animation(
        'fadeIn',
        'normal',
        'easeInOut',
        'short',
        2
      )
      expect(animation).toBe(
        'fadeIn 300ms cubic-bezier(0.4, 0, 0.2, 1) 50ms 2 normal'
      )
    })

    it('should generate CSS keyframes', () => {
      const keyframes = MOTION_CSS.keyframes({
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      })
      expect(keyframes).toContain('@keyframes animation')
      expect(keyframes).toContain('opacity: 0')
      expect(keyframes).toContain('opacity: 1')
    })
  })

  describe('keyframes', () => {
    it('should have all required keyframes', () => {
      expect(MOTION_KEYFRAMES.fadeIn).toBeDefined()
      expect(MOTION_KEYFRAMES.fadeOut).toBeDefined()
      expect(MOTION_KEYFRAMES.slideInRight).toBeDefined()
      expect(MOTION_KEYFRAMES.slideInLeft).toBeDefined()
      expect(MOTION_KEYFRAMES.slideInUp).toBeDefined()
      expect(MOTION_KEYFRAMES.slideInDown).toBeDefined()
      expect(MOTION_KEYFRAMES.scaleIn).toBeDefined()
      expect(MOTION_KEYFRAMES.bounce).toBeDefined()
      expect(MOTION_KEYFRAMES.pulse).toBeDefined()
      expect(MOTION_KEYFRAMES.spin).toBeDefined()
    })
  })

  describe('createMotion hook', () => {
    it('should return motion utilities', () => {
      const motion = createMotion()

      expect(motion.state).toBeTypeOf('function')
      expect(motion.isEnabled).toBeTypeOf('function')
      expect(motion.getDuration).toBeTypeOf('function')
      expect(motion.getEasing).toBeTypeOf('function')
      expect(motion.getDelay).toBeTypeOf('function')
      expect(motion.presets).toBeDefined()
      expect(motion.variants).toBeDefined()
      expect(motion.css).toBeDefined()
      expect(motion.keyframes).toBeDefined()
    })
  })

  describe('type definitions', () => {
    it('should have correct type definitions', () => {
      const preset: MotionPreset = 'fadeIn'
      const duration: MotionDuration = 'normal'
      const easing: MotionEasing = 'easeInOut'
      const delay: MotionDelay = 'short'
      const variant: ThemeMotionVariant = 'subtle'

      expect(preset).toBe('fadeIn')
      expect(duration).toBe('normal')
      expect(easing).toBe('easeInOut')
      expect(delay).toBe('short')
      expect(variant).toBe('subtle')
    })
  })
})
