import { type Component, createSignal, type JSX } from 'solid-js'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { UI_CONFIG } from '../../lib/config'
import { cn } from '../../lib/class-utils'
import { getBackgroundClasses } from '../../lib/theme-classes'

interface LayoutProps {
  children: JSX.Element
  searchQuery: string
  onSearch: (query: string) => void
}

export const Layout: Component<LayoutProps> = (props) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = createSignal(false)

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed())
  }

  return (
    <div class={cn('flex h-screen', getBackgroundClasses('primary'))}>
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed()}
        onToggleCollapse={toggleSidebar}
      />

      {/* Main Content */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header searchQuery={props.searchQuery} onSearch={props.onSearch} />

        {/* Page Content */}
        <main
          class="flex-1 overflow-auto"
          style={{
            'padding-top': `${UI_CONFIG.headerHeight}px`,
            'padding-left': `${isSidebarCollapsed() ? UI_CONFIG.sidebarCollapsedWidth : UI_CONFIG.sidebarWidth}px`,
          }}
        >
          <div class="p-6">{props.children}</div>
        </main>
      </div>
    </div>
  )
}
