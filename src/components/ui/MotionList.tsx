/**
 * MotionList - Animated list component with staggered item animations
 * Features smooth enter/exit animations for list items with configurable stagger
 * Perfect for navigation menus, search results, and dynamic content lists
 */

import {
  type Component,
  splitProps,
  For,
  Show,
  createEffect,
  createSignal,
} from 'solid-js'
import { cn } from '../../lib/utils'
import { useReducedMotion } from '../../hooks/useMotionAnimations'

export interface MotionListItemProps {
  /** Unique key for the item */
  key?: string | number
  /** Item content */
  children?: JSX.Element
  /** Custom animation delay */
  delay?: number
  /** Animation variant */
  animation?: 'fade' | 'slide' | 'scale'
  /** Additional CSS classes */
  class?: string
}

export interface MotionListProps {
  /** List items array */
  items?: unknown[]
  /** Whether to render as ordered list */
  ordered?: boolean
  /** Stagger delay between items (ms) */
  staggerDelay?: number
  /** Animation variant for items */
  animation?: 'fade' | 'slide' | 'scale'
  /** Animation duration */
  duration?: 'fast' | 'normal' | 'slow'
  /** Direction for slide animation */
  direction?: 'up' | 'down' | 'left' | 'right'
  /** Custom item renderer */
  renderItem?: (item: unknown, index: number) => JSX.Element
  /** Additional CSS classes */
  class?: string
  /** List item classes */
  itemClass?: string
}

/**
 * MotionList component with staggered animations
 *
 * @example
 * ```tsx
 * <MotionList
 *   items={animeList}
 *   renderItem={(anime) => <div>{anime.title}</div>}
 *   animation="slide"
 *   staggerDelay={100}
 * />
 * ```
 */
export const MotionList: Component<MotionListProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'items',
    'ordered',
    'staggerDelay',
    'animation',
    'duration',
    'direction',
    'renderItem',
    'class',
    'itemClass',
  ])

  const { shouldAnimate } = useReducedMotion()
  const [visibleItems, setVisibleItems] = createSignal<(string | number)[]>([])

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

  // Get animation classes for items
  const getItemAnimationClasses = (index: number) => {
    if (!shouldAnimate()) return ''

    const baseDelay = local.staggerDelay || 50
    const _delay = index * baseDelay

    const variantClasses = {
      fade: 'animate-fade-in',
      slide: {
        up: 'animate-slide-in-up',
        down: 'animate-slide-in-down',
        left: 'animate-slide-in-left',
        right: 'animate-slide-in-right',
      },
      scale: 'animate-scale-in',
    }

    let animationClass = ''
    if (local.animation === 'fade') {
      animationClass = variantClasses.fade
    } else if (local.animation === 'slide') {
      animationClass = variantClasses.slide[local.direction || 'up']
    } else if (local.animation === 'scale') {
      animationClass = variantClasses.scale
    } else {
      animationClass = variantClasses.fade
    }

    return cn(animationClass, local.itemClass)
  }

  // Get list container classes
  const getListClasses = () => {
    const listClasses = local.ordered ? 'list-decimal' : 'list-disc'
    return cn(listClasses, local.class)
  }

  // Handle items change with staggered animation
  createEffect(() => {
    const items = local.items || []
    const currentVisible = visibleItems()

    // Add new items with stagger
    const newItems = items.filter((_, index) => !currentVisible.includes(index))

    if (newItems.length > 0) {
      const staggerDelay = local.staggerDelay || 50
      newItems.forEach((_, index) => {
        setTimeout(() => {
          setVisibleItems((prev) => [...prev, items.indexOf(newItems[index])])
        }, index * staggerDelay)
      })
    } else {
      setVisibleItems(items.map((_, index) => index))
    }
  })

  // Default item renderer
  const defaultRenderItem = (item: unknown, _index: number) => {
    return <span>{typeof item === 'object' ? item.toString() : item}</span>
  }

  const renderItem = local.renderItem || defaultRenderItem

  return (
    <ul class={getListClasses()} {...rest}>
      <For each={local.items || []}>
        {(item, index) => {
          const isVisible = visibleItems().includes(index())

          return (
            <Show when={isVisible}>
              <li
                class={getItemAnimationClasses(index())}
                style={{
                  'animation-duration': `${getDuration()}ms`,
                  'animation-fill-mode': 'both',
                }}
              >
                {renderItem(item, index())}
              </li>
            </Show>
          )
        }}
      </For>
    </ul>
  )
}

export default MotionList
