/**
 * Example usage of motion variants for Kogoro app
 * This file demonstrates how to use the comprehensive animation library
 */

import {
  MOTION_VARIANTS,
  getAccessibleVariant,
  createStaggeredVariant,
  getThemeVariant,
  createCustomVariant,
} from './motion-variants'
import { isMotionEnabled } from './motion'

// ============================================================================
// BASIC USAGE EXAMPLES
// ============================================================================

/**
 * Example: Using fade animations for a modal
 */
export function modalAnimationExample() {
  const overlayVariant = MOTION_VARIANTS.modal.overlay
  const contentVariant = MOTION_VARIANTS.modal.content

  return {
    overlay: overlayVariant,
    content: contentVariant,
  }
}

/**
 * Example: Using card animations for anime collection
 */
export function animeCardExample() {
  // Grid view card with hover effects
  const gridCard = MOTION_VARIANTS.animeCard.grid

  // List view card for compact display
  const listCard = MOTION_VARIANTS.animeCard.list

  // Mobile-optimized card
  const mobileCard = MOTION_VARIANTS.animeCard.compact

  return { gridCard, listCard, mobileCard }
}

/**
 * Example: Button animations for different button types
 */
export function buttonAnimationExample() {
  const primaryButton = MOTION_VARIANTS.button.primary
  const secondaryButton = MOTION_VARIANTS.button.secondary
  const ghostButton = MOTION_VARIANTS.button.ghost

  return { primaryButton, secondaryButton, ghostButton }
}

// ============================================================================
// ACCESSIBILITY EXAMPLES
// ============================================================================

/**
 * Example: Creating accessible animations that respect reduced motion
 */
export function accessibleAnimationExample() {
  const normalVariant = MOTION_VARIANTS.fade.fadeIn
  const reducedVariant = MOTION_VARIANTS.reducedMotion.opacity

  // Automatically choose the right variant based on user preferences
  const accessibleVariant = getAccessibleVariant(normalVariant, reducedVariant)

  return accessibleVariant
}

// ============================================================================
// STAGGERED ANIMATIONS EXAMPLES
// ============================================================================

/**
 * Example: Creating staggered list animations
 */
export function staggeredListExample() {
  const baseVariant = MOTION_VARIANTS.list.staggered

  // Create staggered variants with different delays
  const item1 = createStaggeredVariant(baseVariant, 0) // No delay
  const item2 = createStaggeredVariant(baseVariant, 50) // 50ms delay
  const item3 = createStaggeredVariant(baseVariant, 100) // 100ms delay
  const item4 = createStaggeredVariant(baseVariant, 150) // 150ms delay

  return [item1, item2, item3, item4]
}

/**
 * Example: Staggered grid animation for anime collection
 */
export function staggeredGridExample<T extends Record<string, unknown>>(
  items: T[]
) {
  const baseVariant = MOTION_VARIANTS.animeCard.grid

  return items.map((item, index) => ({
    ...item,
    animation: createStaggeredVariant(baseVariant, index * 100),
  }))
}

// ============================================================================
// THEME-AWARE EXAMPLES
// ============================================================================

/**
 * Example: Theme-aware animations
 */
export function themeAwareAnimationExample(currentTheme: 'light' | 'dark') {
  // Get theme-specific variant
  const subtleVariant = getThemeVariant(currentTheme, 'subtle')
  const vibrantVariant = getThemeVariant(currentTheme, 'vibrant')
  const colorAwareVariant = getThemeVariant(currentTheme, 'colorAware')

  return { subtleVariant, vibrantVariant, colorAwareVariant }
}

// ============================================================================
// CUSTOM ANIMATION EXAMPLES
// ============================================================================

/**
 * Example: Creating custom animation variants
 */
export function customAnimationExample() {
  // Custom slide-in animation with bounce
  const customSlideIn = createCustomVariant({
    initial: { opacity: 0, transform: 'translateX(-50px) scale(0.8)' },
    animate: { opacity: 1, transform: 'translateX(0) scale(1)' },
    exit: { opacity: 0, transform: 'translateX(50px) scale(0.8)' },
    hover: { transform: 'translateX(4px) scale(1.05)' },
    transition: {
      duration: 0.4,
      easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // bounce
    },
  })

  // Custom loading animation
  const customLoading = createCustomVariant({
    initial: { opacity: 0.3, transform: 'scale(0.9)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    transition: {
      duration: 0.8,
      easing: 'ease-in-out',
      repeat: Infinity,
      reverse: true,
    },
  })

  return { customSlideIn, customLoading }
}

// ============================================================================
// RESPONSIVE EXAMPLES
// ============================================================================

/**
 * Example: Responsive animations for different screen sizes
 */
export function responsiveAnimationExample(
  screenSize: 'mobile' | 'tablet' | 'desktop'
) {
  const mobile = MOTION_VARIANTS.responsive.mobile
  const tablet = MOTION_VARIANTS.responsive.tablet
  const desktop = MOTION_VARIANTS.responsive.desktop

  switch (screenSize) {
    case 'mobile':
      return mobile
    case 'tablet':
      return tablet
    case 'desktop':
      return desktop
    default:
      return mobile
  }
}

// ============================================================================
// SEARCH AND FILTER EXAMPLES
// ============================================================================

/**
 * Example: Search interface animations
 */
export function searchInterfaceExample() {
  const searchInput = MOTION_VARIANTS.search.input
  const filterTag = MOTION_VARIANTS.search.filterTag
  const resultsContainer = MOTION_VARIANTS.search.results

  return { searchInput, filterTag, resultsContainer }
}

/**
 * Example: Theme switching animation
 */
export function themeSwitchExample() {
  const toggleAnimation = MOTION_VARIANTS.themeSwitch.toggle
  const overlayAnimation = MOTION_VARIANTS.themeSwitch.overlay

  return { toggleAnimation, overlayAnimation }
}

// ============================================================================
// LOADING STATE EXAMPLES
// ============================================================================

/**
 * Example: Different loading animations
 */
export function loadingStateExample() {
  const spinner = MOTION_VARIANTS.loading.spinner
  const dots = MOTION_VARIANTS.loading.dots
  const skeleton = MOTION_VARIANTS.loading.skeleton
  const progress = MOTION_VARIANTS.loading.progress
  const bounce = MOTION_VARIANTS.loading.bounce

  return { spinner, dots, skeleton, progress, bounce }
}

// ============================================================================
// PRACTICAL COMPONENT EXAMPLES
// ============================================================================

/**
 * Example: Complete anime card component animation setup
 */
export function animeCardComponentExample() {
  // Base card animation
  const cardAnimation = MOTION_VARIANTS.animeCard.grid

  // Hover state with additional effects
  const hoverAnimation = {
    ...cardAnimation.hover,
    filter: 'brightness(1.1)',
  }

  // Loading state for card
  const loadingAnimation = MOTION_VARIANTS.loading.skeleton

  // Accessible version
  const accessibleAnimation = getAccessibleVariant(
    cardAnimation,
    MOTION_VARIANTS.reducedMotion.opacity
  )

  return {
    normal: cardAnimation,
    hover: hoverAnimation,
    loading: loadingAnimation,
    accessible: accessibleAnimation,
  }
}

/**
 * Example: Modal component animation setup
 */
export function modalComponentExample() {
  const overlay = MOTION_VARIANTS.modal.overlay
  const content = MOTION_VARIANTS.modal.content

  // Alternative slide-up modal
  const slideUpContent = MOTION_VARIANTS.modal.slideUp

  return {
    overlay,
    content,
    slideUpContent,
  }
}

/**
 * Example: Sidebar navigation animation
 */
export function sidebarExample() {
  const slideIn = MOTION_VARIANTS.sidebar.left
  const compressed = MOTION_VARIANTS.sidebar.compressed

  return { slideIn, compressed }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if animations should be enabled
 */
export function shouldAnimate() {
  return isMotionEnabled()
}

/**
 * Get appropriate animation duration based on complexity
 */
export function getAnimationDuration(
  complexity: 'simple' | 'medium' | 'complex'
) {
  switch (complexity) {
    case 'simple':
      return 150 // fast
    case 'medium':
      return 300 // normal
    case 'complex':
      return 500 // slow
    default:
      return 300
  }
}

/**
 * Example: Animation configuration for a complete page
 */
export function pageAnimationExample() {
  const pageTransition = MOTION_VARIANTS.page.fade
  const containerAnimation = MOTION_VARIANTS.container.height

  return {
    page: pageTransition,
    container: containerAnimation,
  }
}

// ============================================================================
// EXPORT ALL EXAMPLES
// ============================================================================

export const examples = {
  modal: modalAnimationExample,
  animeCard: animeCardExample,
  button: buttonAnimationExample,
  accessible: accessibleAnimationExample,
  staggeredList: staggeredListExample,
  staggeredGrid: staggeredGridExample,
  themeAware: themeAwareAnimationExample,
  custom: customAnimationExample,
  responsive: responsiveAnimationExample,
  searchInterface: searchInterfaceExample,
  themeSwitch: themeSwitchExample,
  loadingState: loadingStateExample,
  animeCardComponent: animeCardComponentExample,
  modalComponent: modalComponentExample,
  sidebar: sidebarExample,
  page: pageAnimationExample,
  utilities: {
    shouldAnimate,
    getAnimationDuration,
  },
} as const
