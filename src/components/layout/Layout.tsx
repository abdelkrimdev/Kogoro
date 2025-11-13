import { type Component, createSignal } from 'solid-js'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { UI_CONFIG } from '../../lib/config'

interface LayoutProps {
  children: any
  searchQuery: string
  onSearch: (query: string) => void
}

export const Layout: Component<LayoutProps> = (props) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = createSignal(false)

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed())
  }

  return (
    <div class="flex h-screen bg-gray-50 dark:bg-gray-950">
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
