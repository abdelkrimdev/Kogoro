/**
 * MotionButton - Animated button component with hover, tap, and loading states
 * Integrates with the motion system for smooth interactive animations
 * Perfect for anime collection actions like add, remove, favorite, etc.
 */

import { type Component, Show, splitProps, type JSX } from 'solid-js'
import { cn } from '../../lib/utils'
import {
  useInteractionAnimation,
  useLoadingAnimation,
} from '../../hooks/useMotionAnimations'
import { OptimizedMotion } from './OptimizedMotion'
import type { MOTION_VARIANTS } from '../../lib/motion-variants'

export interface MotionButtonProps {
  /** Button variant for styling */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Button size */
  size?: 'sm' | 'md' | 'lg'
  /** Whether button is disabled */
  disabled?: boolean
  /** Whether button is in loading state */
  loading?: boolean
  /** Loading text to display */
  loadingText?: string
  /** Button type */
  type?: 'button' | 'submit' | 'reset'
  /** Button click handler */
  onClick?: (event: MouseEvent) => void
  /** Icon to display */
  icon?: string
  /** Icon position */
  iconPosition?: 'left' | 'right'
  /** Full width button */
  fullWidth?: boolean
  /** Custom animation variant */
  animationVariant?: keyof typeof MOTION_VARIANTS.button
  /** Children content */
  children?: JSX.Element
  /** Custom CSS classes */
  class?: string
}

/**
 * MotionButton component with interactive animations
 *
 * @example
 * ```tsx
 * <MotionButton
 *   variant="primary"
 *   size="md"
 *   loading={isLoading}
 *   onClick={handleAddAnime}
 * >
 *   Add to Collection
 * </MotionButton>
 * ```
 */
export const MotionButton: Component<MotionButtonProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'variant',
    'size',
    'disabled',
    'loading',
    'loadingText',
    'type',
    'onClick',
    'icon',
    'iconPosition',
    'fullWidth',
    'animationVariant',
    'children',
    'class',
  ])

  // Setup interaction animations
  const { eventHandlers, getAnimationStyles } = useInteractionAnimation({
    disabled: local.disabled || local.loading,
  })

  // Setup loading animation
  const { getLoadingProps } = useLoadingAnimation({
    type: 'spinner',
    size:
      local.size === 'sm' ? 'small' : local.size === 'lg' ? 'large' : 'medium',
    text: local.loadingText,
  })

  // Get base classes based on variant and size
  const getBaseClasses = () => {
    const variantClasses = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
      secondary:
        'bg-gray-200 hover:bg-gray-300 text-gray-900 border-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 dark:border-gray-600',
      ghost:
        'bg-transparent hover:bg-gray-100 text-gray-700 border-transparent dark:hover:bg-gray-800 dark:text-gray-300',
      danger: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
    }

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm font-medium rounded-md',
      md: 'px-4 py-2 text-sm font-medium rounded-lg',
      lg: 'px-6 py-3 text-base font-medium rounded-lg',
    }

    return cn(
      'inline-flex items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
      variantClasses[local.variant || 'primary'],
      sizeClasses[local.size || 'md'],
      local.fullWidth && 'w-full',
      local.class
    )
  }

  // Handle click with loading state
  const handleClick = (event: MouseEvent) => {
    if (local.disabled || local.loading) return
    local.onClick?.(event)
  }

  const buttonContent = (
    <>
      {/* Loading state */}
      <Show when={local.loading}>
        <div class="flex items-center space-x-2">
          <div {...getLoadingProps()} />
          <Show when={local.loadingText}>
            <span>{local.loadingText}</span>
          </Show>
        </div>
      </Show>

      {/* Normal state */}
      <Show when={!local.loading}>
        {/* Left icon */}
        <Show when={local.icon && local.iconPosition !== 'right'}>
          <span class="mr-2">{local.icon}</span>
        </Show>

        {/* Button content */}
        {local.children}

        {/* Right icon */}
        <Show when={local.icon && local.iconPosition === 'right'}>
          <span class="ml-2">{local.icon}</span>
        </Show>
      </Show>
    </>
  )

  return (
    <OptimizedMotion
      features={['animations']}
      preloadStrategy="hover"
      disabled={local.disabled || local.loading}
      respectReducedMotion
      performanceMonitoring={import.meta.env.DEV}
    >
      <button
        type={local.type || 'button'}
        class={getBaseClasses()}
        disabled={local.disabled || local.loading}
        onClick={handleClick}
        style={getAnimationStyles()}
        {...eventHandlers}
        {...rest}
      >
        {buttonContent}
      </button>
    </OptimizedMotion>
  )
}

export default MotionButton
