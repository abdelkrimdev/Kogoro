import { type Component, For, Show, type JSX } from 'solid-js'
import { useLocation, useNavigate } from '@solidjs/router'
import {
  House as Home,
  Search,
  Settings,
  Scan,
  ChevronLeft,
  ChevronRight,
  Library,
} from 'lucide-solid'
import {
  cn,
  getTextClasses,
  getBorderClasses,
  getStatusClasses,
  getThemeComponentClasses,
} from '../../lib/utils'
import { UI_CONFIG } from '../../lib/config'
import {
  useInteractionAnimation,
  useReducedMotion,
  useStaggerAnimation,
} from '../../hooks/useMotionAnimations'
import { MotionSidebar } from '../ui/MotionSidebar'
import { MOTION_VARIANTS } from '../../lib/motion-variants'

// Type definitions for animation styles
type AnimationStyles = Record<string, string | number | undefined>

// Type definitions for event handlers
type EventHandlers = Record<string, unknown> & {
  onClick?: (e: MouseEvent) => void
  onMouseEnter?: (e: MouseEvent) => undefined | boolean
  onMouseLeave?: (e: MouseEvent) => void
  onMouseDown?: (e: MouseEvent) => undefined | boolean
  onMouseUp?: (e: MouseEvent) => undefined | boolean
  onFocus?: (e: FocusEvent) => undefined | boolean
  onBlur?: (e: FocusEvent) => undefined | boolean
  onKeyDown?: (e: KeyboardEvent) => void
  onKeyUp?: (e: KeyboardEvent) => void
}

// Type definitions for stagger props
type StaggerProps = {
  style?: JSX.CSSProperties
  [key: string]: unknown
}

interface SidebarItem {
  id: string
  label: string
  icon: Component<{ class?: string }>
  path: string
  badge?: number
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: '/',
  },
  {
    id: 'collection',
    label: 'Collection',
    icon: Library,
    path: '/collection',
  },
  {
    id: 'scanner',
    label: 'Scanner',
    icon: Scan,
    path: '/scanner',
  },
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    path: '/search',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
  },
]

interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

// Sidebar Logo Component
const SidebarLogo: Component<{ isCollapsed: boolean }> = (props) => {
  return (
    <Show
      when={!props.isCollapsed}
      fallback={
        <div class="w-8 h-8 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-sm">K</span>
        </div>
      }
    >
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-sm">K</span>
        </div>
        <span class={cn('text-xl font-bold', getTextClasses('primary'))}>
          Kogoro
        </span>
      </div>
    </Show>
  )
}

// Collapse Button Component
const CollapseButton: Component<{
  isCollapsed: boolean
  onToggleCollapse: () => void
  animationStyles: AnimationStyles
  eventHandlers: EventHandlers
}> = (props) => {
  const { shouldAnimate } = useReducedMotion()

  return (
    <button
      type="button"
      onClick={props.onToggleCollapse}
      {...props.eventHandlers}
      style={props.animationStyles}
      class={cn(
        'p-1 rounded-lg',
        getThemeComponentClasses({ variant: 'muted', interactive: true })
      )}
      title={props.isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <Show
        when={props.isCollapsed}
        fallback={
          <ChevronLeft
            class={cn('w-4 h-4', getTextClasses('tertiary'))}
            style={{
              transition: shouldAnimate()
                ? `transform ${UI_CONFIG.animationDuration.normal}ms ease-in-out`
                : 'none',
            }}
          />
        }
      >
        <ChevronRight
          class={cn('w-4 h-4', getTextClasses('tertiary'))}
          style={{
            transition: shouldAnimate()
              ? `transform ${UI_CONFIG.animationDuration.normal}ms ease-in-out`
              : 'none',
          }}
        />
      </Show>
    </button>
  )
}

// Sidebar Header Component
const SidebarHeader: Component<{
  isCollapsed: boolean
  onToggleCollapse: () => void
}> = (props) => {
  const collapseButtonAnimation = useInteractionAnimation({
    hoverVariant: MOTION_VARIANTS.hover.rotate,
    tapVariant: MOTION_VARIANTS.tap.press,
  })

  return (
    <div
      class={cn(
        'flex items-center justify-between p-4 border-b',
        getBorderClasses('primary')
      )}
    >
      <SidebarLogo isCollapsed={props.isCollapsed} />
      <CollapseButton
        isCollapsed={props.isCollapsed}
        onToggleCollapse={props.onToggleCollapse}
        animationStyles={collapseButtonAnimation.getAnimationStyles()}
        eventHandlers={collapseButtonAnimation.eventHandlers}
      />
    </div>
  )
}

// Sidebar Item Badge Component
const SidebarItemBadge: Component<{ badge?: number }> = (props) => {
  const { shouldAnimate } = useReducedMotion()

  return (
    <Show when={props.badge && props.badge > 0}>
      <span
        class={cn(
          'ml-auto text-xs px-2 py-1 rounded-full',
          getStatusClasses('info', 'bg'),
          getStatusClasses('info', 'text')
        )}
        style={{
          transition: shouldAnimate()
            ? `transform ${UI_CONFIG.animationDuration.fast}ms ease-in-out`
            : 'none',
        }}
      >
        {props.badge}
      </span>
    </Show>
  )
}

// Sidebar Item Label Component
const SidebarItemLabel: Component<{
  label: string
  badge?: number
  isCollapsed: boolean
}> = (props) => {
  const { shouldAnimate } = useReducedMotion()

  return (
    <Show when={!props.isCollapsed}>
      <span
        class="ml-3 truncate"
        style={{
          transition: shouldAnimate()
            ? `opacity ${UI_CONFIG.animationDuration.fast}ms ease-in-out`
            : 'none',
        }}
      >
        {props.label}
      </span>
      <SidebarItemBadge badge={props.badge} />
    </Show>
  )
}

// Sidebar Navigation Item Component
const SidebarNavItem: Component<{
  item: SidebarItem
  isActive: boolean
  isCollapsed: boolean
  onClick: () => void
  animationStyles: AnimationStyles
  eventHandlers: EventHandlers
  staggerProps: StaggerProps
}> = (props) => {
  const { shouldAnimate } = useReducedMotion()
  const Icon = props.item.icon

  const buttonStyles = () => ({
    ...props.animationStyles,
    ...props.staggerProps.style,
    transition: shouldAnimate()
      ? `all ${UI_CONFIG.animationDuration.fast}ms ease-in-out`
      : 'none',
  })

  const buttonClasses = () =>
    cn(
      'w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg group',
      props.isActive
        ? cn(getStatusClasses('info', 'bg'), getStatusClasses('info', 'text'))
        : cn(
            getTextClasses('secondary'),
            getThemeComponentClasses({
              variant: 'muted',
              interactive: true,
            })
          )
    )

  const iconClasses = () =>
    cn(
      'w-5 h-5 shrink-0',
      props.isActive
        ? getStatusClasses('info', 'text')
        : cn(
            getTextClasses('tertiary'),
            `group-hover:${getTextClasses('secondary')}`
          )
    )

  return (
    <button
      type="button"
      onClick={props.onClick}
      {...props.eventHandlers}
      {...props.staggerProps}
      style={buttonStyles()}
      class={buttonClasses()}
      title={props.isCollapsed ? props.item.label : undefined}
    >
      <Icon class={iconClasses()} />
      <SidebarItemLabel
        label={props.item.label}
        badge={props.item.badge}
        isCollapsed={props.isCollapsed}
      />
    </button>
  )
}

// Sidebar Navigation Component
const SidebarNavigation: Component<{
  isCollapsed: boolean
  onItemClick: (item: SidebarItem) => void
}> = (props) => {
  const location = useLocation()
  const { shouldAnimate } = useReducedMotion()

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  // Create interaction animation for navigation items
  const {
    eventHandlers: navItemHandlers,
    getAnimationStyles: getNavItemStyles,
  } = useInteractionAnimation({
    hoverVariant: MOTION_VARIANTS.hover.lift,
    tapVariant: MOTION_VARIANTS.tap.press,
  })

  // Stagger animation for navigation items
  const { getStaggerProps } = useStaggerAnimation({
    baseDelay: shouldAnimate() ? 50 : 0,
    maxDelay: 300,
    variant: MOTION_VARIANTS.list.staggered,
  })

  return (
    <nav class="flex-1 p-2 space-y-1">
      <For each={sidebarItems}>
        {(item, index) => (
          <SidebarNavItem
            item={item}
            isActive={isActive(item.path)}
            isCollapsed={props.isCollapsed}
            onClick={() => props.onItemClick(item)}
            animationStyles={getNavItemStyles()}
            eventHandlers={navItemHandlers}
            staggerProps={getStaggerProps(index())}
          />
        )}
      </For>
    </nav>
  )
}

// Sidebar Footer Component
const SidebarFooter: Component<{ isCollapsed: boolean }> = (props) => {
  return (
    <div class={cn('p-4 border-t', getBorderClasses('primary'))}>
      <Show when={!props.isCollapsed}>
        <div class={cn('text-xs', getTextClasses('tertiary'))}>
          <div class="flex items-center justify-between mb-1">
            <span>Status</span>
            <span class="w-2 h-2 bg-green-500 rounded-full"></span>
          </div>
          <div>Ready</div>
        </div>
      </Show>
    </div>
  )
}

// Main Sidebar Component
export const Sidebar: Component<SidebarProps> = (props) => {
  const navigate = useNavigate()

  const handleItemClick = (item: SidebarItem) => {
    navigate(item.path)
  }

  return (
    <MotionSidebar
      isOpen={!props.isCollapsed}
      position="left"
      variant="static"
      width="md"
      collapsible={true}
      defaultCollapsed={props.isCollapsed}
      duration="normal"
      class={cn(getBorderClasses('primary'), 'border-r')}
    >
      <SidebarHeader
        isCollapsed={props.isCollapsed}
        onToggleCollapse={props.onToggleCollapse}
      />

      <SidebarNavigation
        isCollapsed={props.isCollapsed}
        onItemClick={handleItemClick}
      />

      <SidebarFooter isCollapsed={props.isCollapsed} />
    </MotionSidebar>
  )
}
