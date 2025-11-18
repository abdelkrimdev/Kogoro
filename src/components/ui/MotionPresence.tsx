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
  onError,
} from 'solid-js'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useMotionAnimations'
import { MotionErrorBoundary } from './MotionErrorBoundary'

import type {
  AnimatedComponentProps,
  AnimationVariant,
  DurationPreset,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced motion presence interface with comprehensive options
 */
export interface MotionPresenceProps
  extends AnimatedComponentProps,
    ErrorHandlingProps {
  /**
   * Whether component should be visible
   * @default false
   */
  show?: boolean
  /**
   * Animation variant for enter/exit transitions
   * @default 'fade'
   */
  variant?: AnimationVariant
  /**
   * Custom CSS classes for enter animation
   */
  enterClass?: string
  /**
   * Custom CSS classes for exit animation
   */
  exitClass?: string
  /**
   * Animation duration preset
   * @default 'normal'
   */
  duration?: DurationPreset
  /**
   * Whether animation should happen only on initial appearance
   * @default false
   */
  appear?: boolean
  /**
   * Children content to animate
   */
  children?: JSX.Element
  /**
   * Callback when animation completes (both enter and exit)
   */
  onComplete?: () => void
  /**
   * Callback when enter animation starts
   */
  onEnterStart?: () => void
  /**
   * Callback when enter animation completes
   */
  onEnterComplete?: () => void
  /**
   * Callback when exit animation starts
   */
  onExitStart?: () => void
  /**
   * Callback when exit animation completes
   */
  onExitComplete?: () => void
  /**
   * Custom enter animation duration in milliseconds
   */
  enterDuration?: number
  /**
   * Custom exit animation duration in milliseconds
   */
  exitDuration?: number
  /**
   * Easing function for animations
   * @default 'ease-out'
   */
  easing?: string
  /**
   * Whether to unmount children when hidden
   * @default true
   */
  unmountOnExit?: boolean
  /**
   * Whether to mount children when shown
   * @default true
   */
  mountOnShow?: boolean
  /**
   * Minimum height to maintain during animations
   */
  minHeight?: string
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
    'onError',
    'maxRetries',
    'retryDelay',
  ])

  const { shouldAnimate } = useReducedMotion()

  // Animation states
  const [isPresent, setIsPresent] = createSignal(false)
  const [isExiting, setIsExiting] = createSignal(false)
  const [hasError, setHasError] = createSignal(false)

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

  // Error boundary for presence component
  onError((error) => {
    console.error('MotionPresence component error:', error)
    setHasError(true)
    local.onError?.(error)
  })

  // Handle animation completion with error handling
  const handleAnimationEnd = () => {
    try {
      if (isExiting()) {
        setIsExiting(false)
        setIsPresent(false)
      }
      local.onComplete?.()
    } catch (error) {
      console.error('Error in MotionPresence animation end handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  // Handle show prop changes with error handling
  createEffect(() => {
    try {
      const showValue = local.show
      if (showValue && !isPresent()) {
        // Entering
        setIsPresent(true)
        setIsExiting(false)
      } else if (!showValue && isPresent()) {
        // Exiting
        setIsExiting(true)
      }
    } catch (error) {
      console.error('Error in MotionPresence effect:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  })

  return (
    <MotionErrorBoundary
      onError={(error) => {
        setHasError(true)
        local.onError?.(error)
      }}
    >
      <Show when={local.show || isPresent()}>
        <div
          class={cn(
            'motion-presence-content',
            shouldAnimate() &&
              (isExiting()
                ? getAnimationClasses().exit
                : getAnimationClasses().enter),
            !shouldAnimate() && 'no-motion',
            hasError() && 'opacity-50'
          )}
          onAnimationEnd={handleAnimationEnd}
          style={{
            'animation-duration': `${getDuration()}ms`,
            'animation-fill-mode': 'both',
          }}
          {...rest}
        >
          <MotionErrorBoundary
            onError={(error) => {
              setHasError(true)
              local.onError?.(error)
            }}
          >
            {local.children}
          </MotionErrorBoundary>
        </div>
      </Show>
    </MotionErrorBoundary>
  )
}

export default MotionPresence
