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
      class={`flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
        props.isCollapsed ? 'w-16' : 'w-64'
      }`}
      style={{
        width: `${props.isCollapsed ? UI_CONFIG.sidebarCollapsedWidth : UI_CONFIG.sidebarWidth}px`,
      }}
    >
      {/* Header */}
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
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
            <span class="text-xl font-bold text-gray-900 dark:text-white">
              Kogoro
            </span>
          </div>
        </Show>

        <button
          type="button"
          onClick={props.onToggleCollapse}
          class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={props.isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Show
            when={props.isCollapsed}
            fallback={
              <ChevronLeft class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            }
          >
            <ChevronRight class="w-4 h-4 text-gray-500 dark:text-gray-400" />
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
                class={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={props.isCollapsed ? item.label : undefined}
              >
                <Icon
                  class={`w-5 h-5 shrink-0 ${
                    active
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                  }`}
                />

                <Show when={!props.isCollapsed}>
                  <span class="ml-3 truncate">{item.label}</span>
                  <Show when={item.badge && item.badge > 0}>
                    <span class="ml-auto bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs px-2 py-1 rounded-full">
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
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <Show when={!props.isCollapsed}>
          <div class="text-xs text-gray-500 dark:text-gray-400">
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
