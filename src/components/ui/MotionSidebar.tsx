/**
 * MotionSidebar - Animated sidebar component with slide/collapse animations
 * Features smooth expand/collapse transitions and responsive behavior
 * Perfect for navigation menus, filters, and secondary content panels
 */

import {
  type Component,
  createSignal,
  splitProps,
  Show,
  createEffect,
  type JSX,
} from 'solid-js'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useMotionAnimations'

export interface MotionSidebarProps {
  /** Whether sidebar is open */
  isOpen?: boolean
  /** Sidebar position */
  position?: 'left' | 'right'
  /** Sidebar variant */
  variant?: 'overlay' | 'push' | 'static'
  /** Sidebar width */
  width?: 'sm' | 'md' | 'lg' | 'xl'
  /** Whether to show backdrop */
  showBackdrop?: boolean
  /** Whether clicking backdrop closes sidebar */
  closeOnBackdropClick?: boolean
  /** Custom close handler */
  onClose?: () => void
  /** Sidebar content */
  children?: JSX.Element
  /** Additional CSS classes */
  class?: string
  /** Animation duration */
  duration?: 'fast' | 'normal' | 'slow'
  /** Whether sidebar is collapsible */
  collapsible?: boolean
  /** Whether sidebar starts collapsed */
  defaultCollapsed?: boolean
}

/**
 * MotionSidebar component with slide and collapse animations
 *
 * @example
 * ```tsx
 * <MotionSidebar
 *   isOpen={isSidebarOpen}
 *   position="left"
 *   variant="overlay"
 *   onClose={handleClose}
 * >
 *   <nav>Navigation content</nav>
 * </MotionSidebar>
 * ```
 */
export const MotionSidebar: Component<MotionSidebarProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'isOpen',
    'position',
    'variant',
    'width',
    'showBackdrop',
    'closeOnBackdropClick',
    'onClose',
    'children',
    'class',
    'duration',
    'collapsible',
    'defaultCollapsed',
  ])

  const { shouldAnimate } = useReducedMotion()
  const [isCollapsed, setIsCollapsed] = createSignal(local.defaultCollapsed)

  // Handle backdrop click
  const handleBackdropClick = () => {
    local.onClose?.()
  }

  const handleBackdropKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      local.onClose?.()
    }
  }

  // Handle ESC key
  createEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && local.isOpen) {
        local.onClose?.()
      }
    }

    if (local.isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  })

  // Get sidebar width classes
  const getSidebarWidthClasses = () => {
    const widthClasses = {
      sm: 'w-64',
      md: 'w-80',
      lg: 'w-96',
      xl: 'w-[28rem]',
    }
    return widthClasses[local.width || 'md']
  }

  // Get animation duration in ms
  const getDuration = () => {
    switch (local.duration) {
      case 'fast':
        return '200ms'
      case 'normal':
        return '300ms'
      case 'slow':
        return '500ms'
      default:
        return '300ms'
    }
  }

  // Get sidebar position and animation classes
  // Helper function to get base sidebar classes
  const getBaseSidebarClasses = () => {
    return cn(
      'fixed top-0 h-full bg-white dark:bg-gray-800 shadow-lg z-40',
      'transform transition-transform ease-in-out',
      getSidebarWidthClasses(),
      local.collapsible && isCollapsed() && 'w-16',
      local.class
    )
  }

  // Helper function to get position classes
  const getPositionClasses = () => {
    const isLeft = local.position === 'left'
    return isLeft ? 'left-0' : 'right-0'
  }

  // Helper function to get transform classes for animated sidebar
  const getAnimatedTransformClasses = () => {
    const isLeft = local.position === 'left'

    if (local.variant === 'overlay' || local.variant === 'push') {
      return local.isOpen
        ? 'translate-x-0'
        : isLeft
          ? '-translate-x-full'
          : 'translate-x-full'
    }

    return local.isOpen ? 'translate-x-0' : 'translate-x-full'
  }

  // Helper function to get transform classes for non-animated sidebar
  const getStaticTransformClasses = () => {
    return local.isOpen ? 'translate-x-0' : 'translate-x-full'
  }

  // Helper function to get transform classes
  const getTransformClasses = () => {
    if (shouldAnimate()) {
      return getAnimatedTransformClasses()
    } else {
      return getStaticTransformClasses()
    }
  }

  const getSidebarClasses = () => {
    const baseClasses = getBaseSidebarClasses()
    const positionClasses = getPositionClasses()
    const transformClasses = getTransformClasses()

    return cn(baseClasses, positionClasses, transformClasses)
  }

  // Get backdrop classes
  const getBackdropClasses = () => {
    return cn(
      'fixed inset-0 bg-black/50 z-30 transition-opacity',
      local.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
    )
  }

  // Toggle collapse state
  const toggleCollapse = () => {
    if (local.collapsible) {
      setIsCollapsed(!isCollapsed())
    }
  }

  return (
    <>
      {/* Backdrop for overlay variant */}
      <Show when={local.variant === 'overlay' && local.showBackdrop}>
        <button
          type="button"
          tabIndex={0}
          class={getBackdropClasses()}
          onClick={handleBackdropClick}
          onKeyDown={handleBackdropKeyDown}
          aria-label="Close sidebar"
        />
      </Show>

      {/* Sidebar */}
      <Show when={local.isOpen || local.variant === 'static'}>
        <aside
          class={getSidebarClasses()}
          style={{
            'transition-duration': getDuration(),
          }}
          {...rest}
        >
          {/* Collapse toggle button */}
          <Show when={local.collapsible}>
            <button
              type="button"
              class="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
              onClick={toggleCollapse}
              aria-label={isCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                class="w-4 h-4 transition-transform"
                classList={{
                  'rotate-180':
                    (local.position === 'left' && !isCollapsed()) ||
                    (local.position === 'right' && isCollapsed()),
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>
                  {isCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
                </title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </Show>

          {/* Close button for overlay variant */}
          <Show when={local.variant === 'overlay' && !local.collapsible}>
            <button
              type="button"
              class="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
              onClick={() => local.onClose?.()}
              aria-label="Close sidebar"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Close sidebar</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Show>

          {/* Sidebar Content */}
          <div class="h-full overflow-y-auto">
            <Show
              when={!isCollapsed()}
              fallback={
                <div class="flex flex-col items-center py-4 space-y-4">
                  {/* Collapsed state icons can go here */}
                </div>
              }
            >
              <div class="p-4">{local.children}</div>
            </Show>
          </div>
        </aside>
      </Show>
    </>
  )
}

export default MotionSidebar
