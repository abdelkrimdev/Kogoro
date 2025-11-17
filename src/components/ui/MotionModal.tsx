/**
 * MotionModal - Animated modal/dialog component
 * Features overlay animations, content animations, and accessibility
 * Perfect for confirmations, forms, and detailed content
 */

import {
  type Component,
  splitProps,
  Show,
  createEffect,
  type JSX,
} from 'solid-js'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useMotionAnimations'

export interface MotionModalProps {
  /** Whether modal is open */
  isOpen?: boolean
  /** Modal title */
  title?: string
  /** Modal size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Whether to show close button */
  showCloseButton?: boolean
  /** Whether clicking overlay closes modal */
  closeOnOverlayClick?: boolean
  /** Whether ESC key closes modal */
  closeOnEscape?: boolean
  /** Custom close handler */
  onClose?: () => void
  /** Modal content */
  children?: JSX.Element
  /** Additional CSS classes */
  class?: string
  /** Animation variant */
  variant?: 'fade' | 'slide' | 'scale'
  /** Animation duration */
  duration?: 'fast' | 'normal' | 'slow'
}

/**
 * MotionModal component with overlay and content animations
 *
 * @example
 * ```tsx
 * <MotionModal isOpen={showModal} title="Confirm Action" onClose={handleClose}>
 *   <p>Are you sure you want to continue?</p>
 * </MotionModal>
 * ```
 */
export const MotionModal: Component<MotionModalProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'isOpen',
    'title',
    'size',
    'showCloseButton',
    'closeOnOverlayClick',
    'closeOnEscape',
    'onClose',
    'children',
    'class',
    'variant',
    'duration',
  ])

  const { shouldAnimate } = useReducedMotion()

  // Handle overlay click
  const handleOverlayClick = () => {
    if (local.closeOnOverlayClick) {
      local.onClose?.()
    }
  }

  // Handle overlay keyboard events
  const handleOverlayKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOverlayClick()
    }
  }

  // Handle modal keyboard events
  const handleModalKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && local.closeOnEscape) {
      event.preventDefault()
      local.onClose?.()
    }
  }

  // Handle ESC key
  createEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && local.closeOnEscape && local.isOpen) {
        local.onClose?.()
      }
    }

    if (local.isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  })

  // Get modal size classes
  const getModalSizeClasses = () => {
    const sizeClasses = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
      full: 'max-w-full mx-4',
    }
    return sizeClasses[local.size || 'md']
  }

  // Get animation classes
  const getAnimationClasses = () => {
    if (!shouldAnimate()) return ''

    const variantClasses = {
      fade: 'animate-fade-in',
      slide: 'animate-slide-in',
      scale: 'animate-scale-in',
    }

    return variantClasses[local.variant || 'fade'] || variantClasses.fade
  }

  return (
    <Show when={local.isOpen}>
      <button
        type="button"
        class={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4',
          !shouldAnimate() && 'no-motion'
        )}
        onClick={handleOverlayClick}
        onKeyDown={handleOverlayKeyDown}
        tabIndex={-1}
        aria-label="Close modal"
      >
        {/* Overlay */}
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Modal Content */}
        <div
          class={cn(
            'relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-auto',
            'transform transition-all duration-300',
            getModalSizeClasses(),
            getAnimationClasses(),
            local.class
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby={local.title ? 'modal-title' : undefined}
          {...rest}
        >
          {/* Header */}
          <Show when={local.title || local.showCloseButton}>
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <Show when={local.title}>
                <h2
                  id="modal-title"
                  class="text-xl font-semibold text-gray-900 dark:text-white"
                >
                  {local.title}
                </h2>
              </Show>
              <Show when={local.showCloseButton}>
                <button
                  type="button"
                  class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
                  onClick={() => local.onClose?.()}
                  aria-label="Close modal"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <title>Close</title>
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </Show>
            </div>
          </Show>

          {/* Body */}
          <div class="p-6">{local.children}</div>
        </div>
      </button>
    </Show>
  )
}

export default MotionModal
