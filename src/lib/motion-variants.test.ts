/**
 * Tests for motion variants library
 */

import { describe, it, expect } from 'vitest'
import {
  MOTION_VARIANTS,
  getAccessibleVariant,
  createStaggeredVariant,
  createResponsiveVariant,
  getThemeVariant,
  createCustomVariant,
} from './motion-variants'

describe('Motion Variants', () => {
  describe('Entry/Exit Animations', () => {
    it('should have fade variants', () => {
      expect(MOTION_VARIANTS.fade).toBeDefined()
      expect(MOTION_VARIANTS.fade.fadeIn).toBeDefined()
      expect(MOTION_VARIANTS.fade.fadeOutScale).toBeDefined()
      expect(MOTION_VARIANTS.fade.fadeInScale).toBeDefined()
      expect(MOTION_VARIANTS.fade.crossfade).toBeDefined()
    })

    it('should have slide variants', () => {
      expect(MOTION_VARIANTS.slide).toBeDefined()
      expect(MOTION_VARIANTS.slide.slideInRight).toBeDefined()
      expect(MOTION_VARIANTS.slide.slideInLeft).toBeDefined()
      expect(MOTION_VARIANTS.slide.slideInUp).toBeDefined()
      expect(MOTION_VARIANTS.slide.slideInDown).toBeDefined()
    })

    it('should have scale variants', () => {
      expect(MOTION_VARIANTS.scale).toBeDefined()
      expect(MOTION_VARIANTS.scale.scaleIn).toBeDefined()
      expect(MOTION_VARIANTS.scale.scaleOut).toBeDefined()
      expect(MOTION_VARIANTS.scale.bounceScale).toBeDefined()
    })
  })

  describe('UI Component Variants', () => {
    it('should have button variants', () => {
      expect(MOTION_VARIANTS.button).toBeDefined()
      expect(MOTION_VARIANTS.button.primary).toBeDefined()
      expect(MOTION_VARIANTS.button.secondary).toBeDefined()
      expect(MOTION_VARIANTS.button.ghost).toBeDefined()
    })

    it('should have card variants', () => {
      expect(MOTION_VARIANTS.card).toBeDefined()
      expect(MOTION_VARIANTS.card.standard).toBeDefined()
      expect(MOTION_VARIANTS.card.compact).toBeDefined()
      expect(MOTION_VARIANTS.card.featured).toBeDefined()
    })

    it('should have modal variants', () => {
      expect(MOTION_VARIANTS.modal).toBeDefined()
      expect(MOTION_VARIANTS.modal.overlay).toBeDefined()
      expect(MOTION_VARIANTS.modal.content).toBeDefined()
      expect(MOTION_VARIANTS.modal.fullscreen).toBeDefined()
    })

    it('should have sidebar variants', () => {
      expect(MOTION_VARIANTS.sidebar).toBeDefined()
      expect(MOTION_VARIANTS.sidebar.left).toBeDefined()
      expect(MOTION_VARIANTS.sidebar.right).toBeDefined()
      expect(MOTION_VARIANTS.sidebar.compressed).toBeDefined()
    })

    it('should have list variants', () => {
      expect(MOTION_VARIANTS.list).toBeDefined()
      expect(MOTION_VARIANTS.list.staggered).toBeDefined()
      expect(MOTION_VARIANTS.list.sequential).toBeDefined()
      expect(MOTION_VARIANTS.list.reorder).toBeDefined()
    })
  })

  describe('Layout Animations', () => {
    it('should have page variants', () => {
      expect(MOTION_VARIANTS.page).toBeDefined()
      expect(MOTION_VARIANTS.page.fade).toBeDefined()
      expect(MOTION_VARIANTS.page.slide).toBeDefined()
      expect(MOTION_VARIANTS.page.scale).toBeDefined()
    })

    it('should have container variants', () => {
      expect(MOTION_VARIANTS.container).toBeDefined()
      expect(MOTION_VARIANTS.container.height).toBeDefined()
      expect(MOTION_VARIANTS.container.gridReflow).toBeDefined()
      expect(MOTION_VARIANTS.container.flexReflow).toBeDefined()
    })
  })

  describe('Interaction Variants', () => {
    it('should have hover variants', () => {
      expect(MOTION_VARIANTS.hover).toBeDefined()
      expect(MOTION_VARIANTS.hover.lift).toBeDefined()
      expect(MOTION_VARIANTS.hover.glow).toBeDefined()
      expect(MOTION_VARIANTS.hover.brightness).toBeDefined()
      expect(MOTION_VARIANTS.hover.rotate).toBeDefined()
    })

    it('should have focus variants', () => {
      expect(MOTION_VARIANTS.focus).toBeDefined()
      expect(MOTION_VARIANTS.focus.scale).toBeDefined()
      expect(MOTION_VARIANTS.focus.border).toBeDefined()
      expect(MOTION_VARIANTS.focus.shadow).toBeDefined()
    })

    it('should have tap variants', () => {
      expect(MOTION_VARIANTS.tap).toBeDefined()
      expect(MOTION_VARIANTS.tap.press).toBeDefined()
      expect(MOTION_VARIANTS.tap.ripple).toBeDefined()
    })
  })

  describe('Loading Variants', () => {
    it('should have loading variants', () => {
      expect(MOTION_VARIANTS.loading).toBeDefined()
      expect(MOTION_VARIANTS.loading.spinner).toBeDefined()
      expect(MOTION_VARIANTS.loading.dots).toBeDefined()
      expect(MOTION_VARIANTS.loading.skeleton).toBeDefined()
      expect(MOTION_VARIANTS.loading.progress).toBeDefined()
      expect(MOTION_VARIANTS.loading.bounce).toBeDefined()
    })
  })

  describe('Theme-aware Variants', () => {
    it('should have theme variants', () => {
      expect(MOTION_VARIANTS.theme).toBeDefined()
      expect(MOTION_VARIANTS.theme.subtle).toBeDefined()
      expect(MOTION_VARIANTS.theme.vibrant).toBeDefined()
      expect(MOTION_VARIANTS.theme.colorAware).toBeDefined()
    })

    it('should have light and dark variants', () => {
      expect(MOTION_VARIANTS.theme.subtle.light).toBeDefined()
      expect(MOTION_VARIANTS.theme.subtle.dark).toBeDefined()
      expect(MOTION_VARIANTS.theme.vibrant.light).toBeDefined()
      expect(MOTION_VARIANTS.theme.vibrant.dark).toBeDefined()
    })
  })

  describe('Responsive Variants', () => {
    it('should have responsive variants', () => {
      expect(MOTION_VARIANTS.responsive).toBeDefined()
      expect(MOTION_VARIANTS.responsive.mobile).toBeDefined()
      expect(MOTION_VARIANTS.responsive.tablet).toBeDefined()
      expect(MOTION_VARIANTS.responsive.desktop).toBeDefined()
    })
  })

  describe('Reduced Motion Variants', () => {
    it('should have reduced motion variants', () => {
      expect(MOTION_VARIANTS.reducedMotion).toBeDefined()
      expect(MOTION_VARIANTS.reducedMotion.opacity).toBeDefined()
      expect(MOTION_VARIANTS.reducedMotion.instant).toBeDefined()
      expect(MOTION_VARIANTS.reducedMotion.color).toBeDefined()
    })
  })

  describe('Collection-specific Variants', () => {
    it('should have anime card variants', () => {
      expect(MOTION_VARIANTS.animeCard).toBeDefined()
      expect(MOTION_VARIANTS.animeCard.grid).toBeDefined()
      expect(MOTION_VARIANTS.animeCard.list).toBeDefined()
      expect(MOTION_VARIANTS.animeCard.compact).toBeDefined()
    })

    it('should have search variants', () => {
      expect(MOTION_VARIANTS.search).toBeDefined()
      expect(MOTION_VARIANTS.search.input).toBeDefined()
      expect(MOTION_VARIANTS.search.filterTag).toBeDefined()
      expect(MOTION_VARIANTS.search.results).toBeDefined()
    })

    it('should have theme switch variants', () => {
      expect(MOTION_VARIANTS.themeSwitch).toBeDefined()
      expect(MOTION_VARIANTS.themeSwitch.toggle).toBeDefined()
      expect(MOTION_VARIANTS.themeSwitch.overlay).toBeDefined()
    })
  })

  describe('Utility Functions', () => {
    it('should get accessible variant', () => {
      const normalVariant = MOTION_VARIANTS.fade.fadeIn
      const reducedVariant = MOTION_VARIANTS.reducedMotion.opacity

      const result = getAccessibleVariant(normalVariant, reducedVariant)
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })

    it('should create staggered variant', () => {
      const baseVariant = MOTION_VARIANTS.fade.fadeIn
      const staggered = createStaggeredVariant(baseVariant, 100)

      expect(staggered).toBeDefined()
      expect(staggered.transition?.delay).toBe(0.1)
    })

    it('should create responsive variant', () => {
      const mobile = MOTION_VARIANTS.responsive.mobile
      const tablet = MOTION_VARIANTS.responsive.tablet
      const desktop = MOTION_VARIANTS.responsive.desktop

      const responsive = createResponsiveVariant(mobile, tablet, desktop)

      expect(responsive).toBeDefined()
      expect(responsive.mobile).toBeDefined()
      expect(responsive.tablet).toBeDefined()
      expect(responsive.desktop).toBeDefined()
    })

    it('should get theme variant', () => {
      const lightVariant = getThemeVariant('light', 'subtle')
      const darkVariant = getThemeVariant('dark', 'subtle')

      expect(lightVariant).toBeDefined()
      expect(darkVariant).toBeDefined()
      expect(lightVariant).not.toBe(darkVariant)
    })

    it('should create custom variant', () => {
      const custom = createCustomVariant({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.3 },
      })

      expect(custom).toBeDefined()
      expect(custom.initial?.opacity).toBe(0)
      expect(custom.animate?.opacity).toBe(1)
      expect(custom.transition?.duration).toBe(0.3)
    })
  })

  describe('Variant Structure', () => {
    it('should have proper structure for fade variants', () => {
      const fadeIn = MOTION_VARIANTS.fade.fadeIn

      expect(fadeIn.initial).toBeDefined()
      expect(fadeIn.animate).toBeDefined()
      expect(fadeIn.exit).toBeDefined()
      expect(fadeIn.transition).toBeDefined()

      expect(fadeIn.initial?.opacity).toBe(0)
      expect(fadeIn.animate?.opacity).toBe(1)
      expect(fadeIn.exit?.opacity).toBe(0)
    })

    it('should have proper structure for button variants', () => {
      const primary = MOTION_VARIANTS.button.primary

      expect(primary.initial).toBeDefined()
      expect(primary.hover).toBeDefined()
      expect(primary.active).toBeDefined()
      expect(primary.disabled).toBeDefined()
      expect(primary.transition).toBeDefined()
    })

    it('should have proper structure for theme variants', () => {
      const subtle = MOTION_VARIANTS.theme.subtle

      expect(subtle.light).toBeDefined()
      expect(subtle.dark).toBeDefined()
      expect(subtle.light.initial).toBeDefined()
      expect(subtle.light.animate).toBeDefined()
      expect(subtle.light.transition).toBeDefined()
    })
  })

  describe('Animation Properties', () => {
    it('should have valid transition properties', () => {
      const variants = [
        MOTION_VARIANTS.fade.fadeIn,
        MOTION_VARIANTS.slide.slideInRight,
        MOTION_VARIANTS.scale.scaleIn,
        MOTION_VARIANTS.button.primary,
        MOTION_VARIANTS.card.standard,
      ]

      variants.forEach((variant) => {
        expect(variant.transition).toBeDefined()
        expect(typeof variant.transition?.duration).toBe('number')
        expect(typeof variant.transition?.easing).toBe('string')
      })
    })

    it('should have valid transform properties', () => {
      const slideInRight = MOTION_VARIANTS.slide.slideInRight
      const scaleIn = MOTION_VARIANTS.scale.scaleIn

      expect(slideInRight.initial?.transform).toContain('translateX')
      expect(slideInRight.animate?.transform).toContain('translateX')
      expect(scaleIn.initial?.transform).toContain('scale')
      expect(scaleIn.animate?.transform).toContain('scale')
    })

    it('should have valid opacity properties', () => {
      const fadeIn = MOTION_VARIANTS.fade.fadeIn
      const fadeOutScale = MOTION_VARIANTS.fade.fadeOutScale

      expect(typeof fadeIn.initial?.opacity).toBe('number')
      expect(typeof fadeIn.animate?.opacity).toBe('number')
      expect(typeof fadeIn.exit?.opacity).toBe('number')
      expect(typeof fadeOutScale.initial?.opacity).toBe('number')
      expect(typeof fadeOutScale.animate?.opacity).toBe('number')
    })
  })

  describe('Collection-specific Features', () => {
    it('should have hover effects for anime cards', () => {
      const gridCard = MOTION_VARIANTS.animeCard.grid
      const listCard = MOTION_VARIANTS.animeCard.list

      expect(gridCard.hover).toBeDefined()
      expect(listCard.hover).toBeDefined()
      expect(gridCard.hover?.transform).toContain('scale')
      expect(listCard.hover?.transform).toContain('translateX')
    })

    it('should have search-specific animations', () => {
      const searchInput = MOTION_VARIANTS.search.input
      const filterTag = MOTION_VARIANTS.search.filterTag

      expect(searchInput.focus).toBeDefined()
      expect(filterTag.hover).toBeDefined()
      expect(searchInput.focus?.transform).toContain('scale')
      expect(filterTag.hover?.transform).toContain('scale')
    })

    it('should have theme switching animations', () => {
      const themeToggle = MOTION_VARIANTS.themeSwitch.toggle
      const themeOverlay = MOTION_VARIANTS.themeSwitch.overlay

      expect(themeToggle.animate?.transform).toContain('rotate')
      expect(themeOverlay.initial?.opacity).toBe(0)
      expect(themeOverlay.animate?.opacity).toBeGreaterThan(0)
    })
  })
})
