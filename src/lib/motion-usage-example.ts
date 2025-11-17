/**
 * Example usage of motion configuration
 * This file demonstrates how to use motion system in components
 */

import {
  isMotionEnabled,
  getDuration,
  getEasing,
  getDelay,
  MOTION_PRESETS,
  getThemeMotion,
  MOTION_CSS,
  createMotion,
} from './motion'

/**
 * Example of using motion presets in inline styles
 */
export function createFadeInStyles(isVisible: boolean) {
  const fadeInPreset = MOTION_PRESETS.fadeIn

  return {
    ...fadeInPreset.initial,
    transition: MOTION_CSS.transition(['opacity'], 'normal', 'easeInOut'),
    ...(isVisible ? fadeInPreset.animate : fadeInPreset.initial),
  }
}

/**
 * Example of theme-aware motion styles
 */
export function createThemeMotionStyles(
  theme: 'light' | 'dark',
  isVisible: boolean
) {
  const themeMotion = getThemeMotion(theme, 'subtle')

  return {
    ...themeMotion.initial,
    transition: MOTION_CSS.transition(
      ['opacity', 'transform'],
      'fast',
      'easeOut'
    ),
    ...(isVisible ? themeMotion.animate : themeMotion.initial),
  }
}

/**
 * Example of accessibility-aware motion styles
 */
export function createAccessibleMotionStyles(isVisible: boolean) {
  return {
    transition: isMotionEnabled()
      ? MOTION_CSS.transition(['transform'], 'normal', 'bounce')
      : 'none',
    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
  }
}

/**
 * Example of using motion utilities directly
 */
export function createCustomAnimationStyles() {
  const motion = createMotion()

  return {
    'animation-duration': `${motion.getDuration('slow')}ms`,
    'animation-timing-function': motion.getEasing('easeInOut'),
    'animation-delay': `${motion.getDelay('short')}ms`,
  }
}

/**
 * Example of creating custom animation configurations
 */
export function createCustomAnimation() {
  return {
    initial: { opacity: 0, transform: 'scale(0.8) rotate(-5deg)' },
    animate: { opacity: 1, transform: 'scale(1) rotate(0deg)' },
    exit: { opacity: 0, transform: 'scale(0.8) rotate(5deg)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
      delay: getDelay('short') / 1000,
    },
  }
}

/**
 * Example of responsive motion configuration
 */
export function getResponsiveMotion() {
  const isMobile = window.innerWidth < 768
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024

  if (isMobile) {
    return {
      duration: getDuration('fast'),
      easing: getEasing('easeOut'),
      delay: getDelay('none'),
    }
  }

  if (isTablet) {
    return {
      duration: getDuration('normal'),
      easing: getEasing('easeInOut'),
      delay: getDelay('short'),
    }
  }

  return {
    duration: getDuration('slow'),
    easing: getEasing('easeInOut'),
    delay: getDelay('normal'),
  }
}

/**
 * Example of accessibility-aware motion
 */
export function getAccessibleMotion() {
  if (!isMotionEnabled()) {
    return {
      duration: 0,
      easing: 'linear',
      delay: 0,
      useInstant: true,
    }
  }

  return {
    duration: getDuration('normal'),
    easing: getEasing('easeInOut'),
    delay: getDelay('short'),
    useInstant: false,
  }
}

/**
 * Example of theme-aware motion utilities
 */
export function createThemeMotion(theme: 'light' | 'dark') {
  return {
    subtle: getThemeMotion(theme, 'subtle'),
    vibrant: getThemeMotion(theme, 'vibrant'),
    transition: (properties: string[]) =>
      MOTION_CSS.transition(properties, 'normal', 'easeInOut'),
    animation: (name: string, duration?: 'fast' | 'normal' | 'slow') =>
      MOTION_CSS.animation(name, duration || 'normal', 'easeInOut'),
  }
}

/**
 * Example of card animation styles
 */
export function createAnimatedCardStyles(
  isHovered: boolean,
  theme: 'light' | 'dark'
) {
  const themeMotion = createThemeMotion(theme)

  return {
    ...themeMotion.subtle.initial,
    transition: themeMotion.transition(['transform', 'box-shadow']),
    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
    'box-shadow': isHovered
      ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    cursor: 'pointer',
    'border-radius': '8px',
    padding: '16px',
    background: theme === 'light' ? 'white' : '#1f2937',
    color: theme === 'light' ? '#111827' : '#f9fafb',
  }
}
