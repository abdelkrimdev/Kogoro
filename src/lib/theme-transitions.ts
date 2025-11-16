/**
 * Theme transition utilities for smooth theme switching
 */

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Add theme transition class to elements
 */
export function addThemeTransition(
  element: HTMLElement,
  className = 'theme-transition'
): void {
  if (element && !prefersReducedMotion()) {
    element.classList.add(className)
  }
}

/**
 * Remove theme transition class from elements
 */
export function removeThemeTransition(
  element: HTMLElement,
  className = 'theme-transition'
): void {
  if (element) {
    element.classList.remove(className)
  }
}

/**
 * Apply theme transitions to document and body
 */
export function applyThemeTransitions(): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return

  const html = document.documentElement
  const body = document.body

  // Add transition styles
  html.style.transition =
    'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  body.style.transition =
    'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'

  // Apply transitions to all elements with theme-aware properties
  const themeElements = document.querySelectorAll('*')
  themeElements.forEach((element) => {
    if (element instanceof HTMLElement) {
      const computedStyle = window.getComputedStyle(element)
      const hasThemeProperties =
        computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        computedStyle.color !== 'rgba(0, 0, 0, 0)' ||
        computedStyle.borderColor !== 'rgba(0, 0, 0, 0)'

      if (hasThemeProperties) {
        addThemeTransition(element)
      }
    }
  })
}

/**
 * Remove theme transitions from document and body
 */
export function removeThemeTransitions(): void {
  if (typeof document === 'undefined') return

  const html = document.documentElement
  const body = document.body

  html.style.transition = ''
  body.style.transition = ''

  // Remove transition classes from all elements
  const themeElements = document.querySelectorAll(
    '.theme-transition, .theme-transition-bg, .theme-transition-text, .theme-transition-border, .theme-transition-all'
  )
  themeElements.forEach((element) => {
    if (element instanceof HTMLElement) {
      element.classList.remove(
        'theme-transition',
        'theme-transition-bg',
        'theme-transition-text',
        'theme-transition-border',
        'theme-transition-all'
      )
    }
  })
}

/**
 * Create a smooth theme transition effect
 */
export function createSmoothThemeTransition(
  callback: () => void,
  duration: number = 300
): Promise<void> {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) {
      callback()
      resolve()
      return
    }

    // Apply transitions
    applyThemeTransitions()

    // Execute the theme change
    callback()

    // Wait for the transition to complete
    setTimeout(() => {
      resolve()
    }, duration)
  })
}

/**
 * Get transition duration based on user preferences
 */
export function getTransitionDuration(): number {
  return prefersReducedMotion() ? 0 : 300
}

/**
 * Get transition easing function
 */
export function getTransitionEasing(): string {
  return 'cubic-bezier(0.4, 0, 0.2, 1)'
}

/**
 * Add transition listener for theme changes
 */
export function addTransitionListener(
  element: HTMLElement,
  property: 'background-color' | 'color' | 'border-color' | 'all',
  callback: () => void
): void {
  if (prefersReducedMotion()) {
    callback()
    return
  }

  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.propertyName === property || property === 'all') {
      element.removeEventListener('transitionend', handleTransitionEnd)
      callback()
    }
  }

  element.addEventListener('transitionend', handleTransitionEnd)
}

/**
 * Monitor reduced motion preference changes
 */
export function watchReducedMotion(
  callback: (prefersReduced: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  const handleChange = () => {
    callback(mediaQuery.matches)
  }

  mediaQuery.addEventListener('change', handleChange)

  // Return cleanup function
  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}
