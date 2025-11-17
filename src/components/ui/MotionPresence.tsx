/**
 * MotionPresence - AnimatePresence wrapper for enter/exit animations
 * Handles element enter/exit animations with proper cleanup and accessibility
 * Perfect for modals, dropdowns, and dynamic content
 */

import {
  type Component,
  createSignal,
  splitProps,
  Show,
  createEffect,
} from 'solid-js'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useMotionAnimations'

export interface MotionPresenceProps {
  /** Whether component should be visible */
  show?: boolean
  /** Animation variant for enter/exit */
  variant?: 'fade' | 'slide' | 'scale'
  /** Custom animation classes */
  enterClass?: string
  /** Custom animation classes for exit */
  exitClass?: string
  /** Animation duration preset */
  duration?: 'fast' | 'normal' | 'slow'
  /** Whether animation should happen only once */
  appear?: boolean
  /** Children content */
  children?: JSX.Element
  /** Custom on complete callback */
  onComplete?: () => void
}

/**
 * MotionPresence component with enter/exit animations
 *
 * @example
 * ```tsx
 * <MotionPresence show={isOpen} variant="fade">
 *   <div>Modal content</div>
 * </MotionPresence>
 * ```
 */
export const MotionPresence: Component<MotionPresenceProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'show',
    'variant',
    'enterClass',
    'exitClass',
    'duration',
    'appear',
    'children',
    'onComplete',
  ])

  const { shouldAnimate } = useReducedMotion()

  // Animation states
  const [isPresent, setIsPresent] = createSignal(false)
  const [isExiting, setIsExiting] = createSignal(false)

  // Get animation duration in ms
  const getDuration = () => {
    switch (local.duration) {
      case 'fast':
        return 200
      case 'normal':
        return 300
      case 'slow':
        return 500
      default:
        return 300
    }
  }

  // Get animation classes based on variant
  const getAnimationClasses = () => {
    const variantClasses = {
      fade: {
        enter: 'animate-fade-in',
        exit: 'animate-fade-out',
      },
      slide: {
        enter: 'animate-slide-in',
        exit: 'animate-slide-out',
      },
      scale: {
        enter: 'animate-scale-in',
        exit: 'animate-scale-out',
      },
    }

    const variantConfig =
      variantClasses[local.variant || 'fade'] || variantClasses.fade

    return {
      enter: cn(local.enterClass, variantConfig.enter),
      exit: cn(local.exitClass, variantConfig.exit),
    }
  }

  // Handle animation completion
  const handleAnimationEnd = () => {
    if (isExiting()) {
      setIsExiting(false)
      setIsPresent(false)
    }
    local.onComplete?.()
  }

  // Handle show prop changes
  createEffect(() => {
    const showValue = local.show
    if (showValue && !isPresent()) {
      // Entering
      setIsPresent(true)
      setIsExiting(false)
    } else if (!showValue && isPresent()) {
      // Exiting
      setIsExiting(true)
    }
  })

  return (
    <Show when={local.show || isPresent()}>
      <div
        class={cn(
          'motion-presence-content',
          shouldAnimate() &&
            (isExiting()
              ? getAnimationClasses().exit
              : getAnimationClasses().enter),
          !shouldAnimate() && 'no-motion'
        )}
        onAnimationEnd={handleAnimationEnd}
        style={{
          'animation-duration': `${getDuration()}ms`,
          'animation-fill-mode': 'both',
        }}
        {...rest}
      >
        {local.children}
      </div>
    </Show>
  )
}

export default MotionPresence
