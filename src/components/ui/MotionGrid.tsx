import {
  type Component,
  splitProps,
  createSignal,
  onMount,
  For,
  Show,
  createMemo,
  onCleanup,
  type JSX,
} from 'solid-js'
import { cn } from '../../lib/utils'
import { isMotionEnabled, getEasing } from '../../lib/motion'

export interface MotionGridProps {
  children: JSX.Element
  class?: string
  columns?: number | string
  gap?: string
  stagger?: number
  variant?: 'fade' | 'slide' | 'scale' | 'flip'
  direction?: 'up' | 'down' | 'left' | 'right'
  duration?: number
  delay?: number
  animate?: boolean
  onAnimationStart?: () => void
  onAnimationComplete?: () => void
}

export const MotionGrid: Component<MotionGridProps> = (props) => {
  const [local, others] = splitProps(props, [
    'children',
    'class',
    'columns',
    'gap',
    'stagger',
    'variant',
    'direction',
    'duration',
    'delay',
    'animate',
    'onAnimationStart',
    'onAnimationComplete',
  ])

  const [items, setItems] = createSignal<JSX.Element[]>([])
  const [isAnimated, setIsAnimated] = createSignal(false)

  // Memoized calculation to avoid reactive dependencies in timeouts
  const totalDuration = createMemo(() => {
    const itemCount = items().length
    return (
      (local.duration || 0.5) +
      Math.max(0, itemCount - 1) * (local.stagger || 0.1)
    )
  })

  onMount(() => {
    // Convert children to array for staggered animation
    const childrenArray = Array.isArray(local.children)
      ? local.children
      : [local.children]
    setItems(childrenArray.filter(Boolean))

    // Trigger animation after mount
    if (local.animate !== false) {
      const delay = local.delay || 0
      let animationTimeoutId: ReturnType<typeof setTimeout>
      let completionTimeoutId: ReturnType<typeof setTimeout>

      // Start animation after initial delay
      animationTimeoutId = setTimeout(() => {
        local.onAnimationStart?.()
        setIsAnimated(true)

        // Schedule completion callback using memoized duration
        completionTimeoutId = setTimeout(
          () => {
            local.onAnimationComplete?.()
          },
          totalDuration() * 1000 + delay
        )
      }, delay)

      // Cleanup timeouts on unmount
      onCleanup(() => {
        clearTimeout(animationTimeoutId)
        clearTimeout(completionTimeoutId)
      })
    }
  })

  // Helper function to get base animation properties
  const getAnimationProps = (index: number) => {
    const baseDelay = local.delay || 0
    const staggerDelay = index * (local.stagger || 0.1)
    const totalDelay = baseDelay + staggerDelay
    const duration = local.duration || 0.5
    const easing = getEasing('easeOut')

    return { totalDelay, duration, easing }
  }

  // Helper function for slide animation
  const getSlideStyle = (index: number) => {
    const { totalDelay, duration, easing } = getAnimationProps(index)
    const slideOffset =
      local.direction === 'left' || local.direction === 'right' ? 50 : 30

    const getTranslateX = () => {
      switch (local.direction) {
        case 'left':
          return -slideOffset
        case 'right':
          return slideOffset
        default:
          return 0
      }
    }

    const getTranslateY = () => {
      switch (local.direction) {
        case 'up':
          return -slideOffset
        case 'down':
          return slideOffset
        default:
          return 0
      }
    }

    return {
      opacity: isAnimated() ? 1 : 0,
      transform: isAnimated()
        ? 'translate(0, 0)'
        : `translate(${getTranslateX()}px, ${getTranslateY()}px)`,
      transition: `all ${duration}s ${easing} ${totalDelay}s`,
    }
  }

  // Helper function for scale animation
  const getScaleStyle = (index: number) => {
    const { totalDelay, duration, easing } = getAnimationProps(index)
    return {
      opacity: isAnimated() ? 1 : 0,
      transform: isAnimated() ? 'scale(1)' : 'scale(0.8)',
      transition: `all ${duration}s ${easing} ${totalDelay}s`,
    }
  }

  // Helper function for flip animation
  const getFlipStyle = (index: number) => {
    const { totalDelay, duration, easing } = getAnimationProps(index)
    return {
      opacity: isAnimated() ? 1 : 0,
      transform: isAnimated() ? 'rotateY(0deg)' : 'rotateY(-90deg)',
      transition: `all ${duration}s ${easing} ${totalDelay}s`,
    }
  }

  // Helper function for fade animation
  const getFadeStyle = (index: number) => {
    const { totalDelay, duration, easing } = getAnimationProps(index)
    return {
      opacity: isAnimated() ? 1 : 0,
      transition: `opacity ${duration}s ${easing} ${totalDelay}s`,
    }
  }

  const getItemStyle = (index: number) => {
    if (!(isMotionEnabled() && isAnimated())) return {}

    switch (local.variant) {
      case 'slide':
        return getSlideStyle(index)
      case 'scale':
        return getScaleStyle(index)
      case 'flip':
        return getFlipStyle(index)
      default: // fade
        return getFadeStyle(index)
    }
  }

  const gridStyle = () => ({
    display: 'grid',
    'grid-template-columns': local.columns
      ? typeof local.columns === 'number'
        ? `repeat(${local.columns}, 1fr)`
        : local.columns
      : 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: local.gap || '1rem',
  })

  return (
    <div class={cn('motion-grid', local.class)} style={gridStyle()} {...others}>
      <Show when={items().length > 0}>
        <For each={items()}>
          {(item, index) => <div style={getItemStyle(index())}>{item}</div>}
        </For>
      </Show>
    </div>
  )
}
