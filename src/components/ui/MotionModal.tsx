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
  onMount,
  onCleanup,
  createSignal,
  onError,
  type JSX,
} from 'solid-js'
import {
  cn,
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
  getThemeTransitionClasses,
  getStatusClasses,
} from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useMotionAnimations'
import { MotionErrorBoundary } from './MotionErrorBoundary'

import type {
  ModalLikeProps,
  AnimatedComponentProps,
  SizeVariant,
  AnimationVariant,
  DurationPreset,
  ErrorHandlingProps,
} from './interfaces'

/**
 * Enhanced motion modal interface with comprehensive options
 */
export interface MotionModalProps
  extends ModalLikeProps,
    AnimatedComponentProps,
    ErrorHandlingProps {
  /**
   * Whether modal is open and visible
   * @default false
   */
  isOpen?: boolean
  /**
   * Modal title displayed in header
   */
  title?: string
  /**
   * Modal size variant
   * @default 'md'
   */
  size?: SizeVariant | 'full'
  /**
   * Whether to show close button in header
   * @default true
   */
  showCloseButton?: boolean
  /**
   * Whether clicking overlay closes modal
   * @default true
   */
  closeOnOverlayClick?: boolean
  /**
   * Whether ESC key closes modal
   * @default true
   */
  closeOnEscape?: boolean
  /**
   * Modal content to render
   */
  children?: JSX.Element
  /**
   * Animation variant for modal enter/exit
   * @default 'fade'
   */
  variant?: AnimationVariant
  /**
   * Animation duration preset
   * @default 'normal'
   */
  duration?: DurationPreset
  /**
   * Whether to prevent body scroll when modal is open
   * @default true
   */
  preventBodyScroll?: boolean
  /**
   * Whether to close modal when clicking outside
   * @default true
   */
  closeOnOutsideClick?: boolean
  /**
   * Whether to focus first focusable element when modal opens
   * @default true
   */
  autoFocus?: boolean
  /**
   * Whether to trap focus within modal
   * @default true
   */
  trapFocus?: boolean
  /**
   * Custom modal ID for accessibility
   */
  id?: string
  /**
   * ARIA describedby attribute
   */
  ariaDescribedBy?: string
  /**
   * Whether to show backdrop
   * @default true
   */
  showBackdrop?: boolean
  /**
   * Backdrop blur effect
   * @default true
   */
  backdropBlur?: boolean
  /**
   * Maximum height of modal content
   * @default '90vh'
   */
  maxHeight?: string
  /**
   * Whether modal is centered vertically
   * @default true
   */
  centered?: boolean
  /**
   * Custom z-index for modal
   * @default 50
   */
  zIndex?: number
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
    'onError',
    'maxRetries',
    'retryDelay',
  ])

  const { shouldAnimate } = useReducedMotion()
  const [hasError, setHasError] = createSignal(false)
  const [_retryCount, setRetryCount] = createSignal(0)

  // Error boundary for modal component
  onError((error) => {
    console.error('MotionModal component error:', error)
    setHasError(true)
    local.onError?.(error)
  })

  // Handle overlay click with error handling
  const handleOverlayClick = () => {
    try {
      if (local.closeOnOverlayClick && typeof local.onClose === 'function') {
        local.onClose()
      }
    } catch (error) {
      console.error('Error in modal overlay click handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  // Handle overlay keyboard events with error handling
  const handleOverlayKeyDown = (event: KeyboardEvent) => {
    try {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleOverlayClick()
      }
    } catch (error) {
      console.error('Error in modal overlay key handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  // Handle modal keyboard events with error handling
  const handleModalKeyDown = (event: KeyboardEvent) => {
    try {
      if (
        event.key === 'Escape' &&
        local.closeOnEscape &&
        typeof local.onClose === 'function'
      ) {
        event.preventDefault()
        local.onClose()
      }
    } catch (error) {
      console.error('Error in modal key handler:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }
  }

  // Handle ESC key and body scroll with proper cleanup
  createEffect(() => {
    const prevOverflow = document.body.style.overflow

    if (local.isOpen) {
      // Prevent body scroll when modal opens
      document.body.style.overflow = 'hidden'
    } else {
      // Restore body scroll when modal closes
      document.body.style.overflow = prevOverflow
    }

    // Cleanup function to restore original overflow
    onCleanup(() => {
      document.body.style.overflow = prevOverflow
    })
  })

  // Setup document-level event listeners with proper cleanup and focus management
  onMount(() => {
    const handleEscape = (e: KeyboardEvent) => {
      try {
        if (
          e.key === 'Escape' &&
          local.closeOnEscape &&
          local.isOpen &&
          typeof local.onClose === 'function'
        ) {
          e.preventDefault()
          local.onClose()
        }
      } catch (error) {
        console.error('Error in modal escape handler:', error)
        setHasError(true)
        local.onError?.(error as Error)
      }
    }

    // Add event listener when component mounts
    try {
      document.addEventListener('keydown', handleEscape)
    } catch (error) {
      console.error('Error adding modal event listener:', error)
      setHasError(true)
      local.onError?.(error as Error)
    }

    // Cleanup function to remove event listener
    onCleanup(() => {
      try {
        document.removeEventListener('keydown', handleEscape)
        // Ensure body scroll is restored on cleanup
        document.body.style.overflow = ''
      } catch (error) {
        console.error('Error in modal cleanup:', error)
      }
    })
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

  const renderErrorState = () => {
    if (!hasError()) return null

    return (
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          class={cn(
            'rounded-lg shadow-lg p-6 max-w-md w-full',
            getBackgroundClasses('primary'),
            getBorderClasses('primary')
          )}
        >
          <div class="text-center">
            <svg
              class="w-12 h-12 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>Modal Error</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3
              class={cn(
                'text-lg font-semibold mb-2',
                getTextClasses('primary')
              )}
            >
              Modal Error
            </h3>
            <p class={cn('text-sm mb-4', getTextClasses('secondary'))}>
              An error occurred while displaying this modal.
            </p>
            <div class="flex space-x-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setHasError(false)
                  setRetryCount(0)
                }}
                class={cn(
                  'px-4 py-2 text-sm rounded transition-colors',
                  getStatusClasses('info', 'bg'),
                  'hover:opacity-90',
                  getTextClasses('primary')
                )}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    local.onClose?.()
                  } catch (error) {
                    console.error('Error closing modal:', error)
                  }
                }}
                class={cn(
                  'px-4 py-2 text-sm rounded transition-colors',
                  getBackgroundClasses('secondary'),
                  'hover:opacity-80',
                  getTextClasses('secondary')
                )}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <MotionErrorBoundary
      onError={(error) => {
        setHasError(true)
        local.onError?.(error)
      }}
    >
      <Show when={local.isOpen}>
        <div
          class={cn(
            'fixed inset-0 z-50 flex items-center justify-center p-4',
            !shouldAnimate() && 'no-motion',
            hasError() && 'opacity-75'
          )}
          role="presentation"
        >
          {/* Accessible overlay */}
          <button
            type="button"
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleOverlayClick}
            onKeyDown={handleOverlayKeyDown}
            aria-label="Close modal"
            tabIndex={local.closeOnOverlayClick ? 0 : -1}
          />

          {/* Modal Content */}
          <div
            class={cn(
              // Base layout classes
              'relative rounded-lg shadow-xl max-h-[90vh] overflow-auto',
              // Theme-aware classes
              getBackgroundClasses('primary'),
              getThemeTransitionClasses('all'),
              'transform transition-all duration-300',
              // Size/variant classes
              getModalSizeClasses(),
              getAnimationClasses(),
              // Error state
              hasError() && 'border-red-500',
              // Props classes (always last)
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
              <div
                class={cn(
                  'flex items-center justify-between p-6 border-b',
                  getBorderClasses('primary')
                )}
              >
                <Show when={local.title}>
                  <h2
                    id="modal-title"
                    class={cn(
                      'text-xl font-semibold',
                      getTextClasses('primary')
                    )}
                  >
                    {local.title}
                  </h2>
                </Show>
                <Show when={local.showCloseButton}>
                  <button
                    type="button"
                    class={cn(
                      'p-2 rounded-md transition-colors',
                      getTextClasses('tertiary'),
                      `hover:${getTextClasses('secondary')}`
                    )}
                    onClick={() => {
                      try {
                        local.onClose?.()
                      } catch (error) {
                        console.error('Error closing modal:', error)
                        setHasError(true)
                        local.onError?.(error as Error)
                      }
                    }}
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
            <div class="p-6">
              <MotionErrorBoundary
                onError={(error) => {
                  setHasError(true)
                  local.onError?.(error)
                }}
              >
                {local.children}
              </MotionErrorBoundary>
            </div>
          </div>
        </div>
      </Show>

      {/* Error overlay */}
      {renderErrorState()}
    </MotionErrorBoundary>
  )
}

export default MotionModal
