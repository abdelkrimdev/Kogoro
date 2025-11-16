import { type Component, For, Show } from 'solid-js'
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
import { UI_CONFIG } from '../../lib/config'
import {
  cn,
  getTextClasses,
  getBackgroundClasses,
  getBorderClasses,
  getStatusClasses,
  getThemeComponentClasses,
} from '../../lib/utils'

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

export const Sidebar: Component<SidebarProps> = (props) => {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const handleItemClick = (item: SidebarItem) => {
    navigate(item.path)
  }

  return (
    <div
      class={cn(
        'flex flex-col transition-all duration-300',
        getBackgroundClasses('primary'),
        getBorderClasses('primary'),
        'border-r',
        props.isCollapsed ? 'w-16' : 'w-64'
      )}
      style={{
        width: `${props.isCollapsed ? UI_CONFIG.sidebarCollapsedWidth : UI_CONFIG.sidebarWidth}px`,
      }}
    >
      {/* Header */}
      <div
        class={cn(
          'flex items-center justify-between p-4 border-b',
          getBorderClasses('primary')
        )}
      >
        <Show
          when={!props.isCollapsed}
          fallback={
            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-sm">K</span>
            </div>
          }
        >
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-sm">K</span>
            </div>
            <span class={cn('text-xl font-bold', getTextClasses('primary'))}>
              Kogoro
            </span>
          </div>
        </Show>

        <button
          type="button"
          onClick={props.onToggleCollapse}
          class={cn(
            'p-1 rounded-lg transition-colors',
            getThemeComponentClasses({ variant: 'muted', interactive: true })
          )}
          title={props.isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Show
            when={props.isCollapsed}
            fallback={
              <ChevronLeft class={cn('w-4 h-4', getTextClasses('tertiary'))} />
            }
          >
            <ChevronRight class={cn('w-4 h-4', getTextClasses('tertiary'))} />
          </Show>
        </button>
      </div>

      {/* Navigation */}
      <nav class="flex-1 p-2 space-y-1">
        <For each={sidebarItems}>
          {(item) => {
            const Icon = item.icon
            const active = isActive(item.path)

            return (
              <button
                type="button"
                onClick={() => handleItemClick(item)}
                class={cn(
                  'w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors group',
                  active
                    ? cn(
                        getStatusClasses('info', 'bg'),
                        getStatusClasses('info', 'text')
                      )
                    : cn(
                        getTextClasses('secondary'),
                        getThemeComponentClasses({
                          variant: 'muted',
                          interactive: true,
                        })
                      )
                )}
                title={props.isCollapsed ? item.label : undefined}
              >
                <Icon
                  class={cn(
                    'w-5 h-5 shrink-0',
                    active
                      ? getStatusClasses('info', 'text')
                      : cn(
                          getTextClasses('tertiary'),
                          `group-hover:${getTextClasses('secondary')}`
                        )
                  )}
                />

                <Show when={!props.isCollapsed}>
                  <span class="ml-3 truncate">{item.label}</span>
                  <Show when={item.badge && item.badge > 0}>
                    <span
                      class={cn(
                        'ml-auto text-xs px-2 py-1 rounded-full',
                        getStatusClasses('info', 'bg'),
                        getStatusClasses('info', 'text')
                      )}
                    >
                      {item.badge}
                    </span>
                  </Show>
                </Show>
              </button>
            )
          }}
        </For>
      </nav>

      {/* Footer */}
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
    </div>
  )
}
