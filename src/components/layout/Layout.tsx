import { type Component, createSignal, type JSX } from 'solid-js'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { UI_CONFIG } from '../../lib/config'
import { cn } from '../../lib/class-utils'
import { getBackgroundClasses } from '../../lib/theme-classes'
import {
  usePageTransition,
  useReducedMotion,
  useLayoutAnimation,
} from '../../hooks/useMotionAnimations'
import { createThemeMotion } from '../../lib/motion-theme'

interface LayoutProps {
  children: JSX.Element
  searchQuery: string
  onSearch: (query: string) => void
}

export const Layout: Component<LayoutProps> = (props) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = createSignal(false)
  const { shouldAnimate } = useReducedMotion()
  const { isTransitioning, getPageProps } = usePageTransition({
    duration: 'normal',
  })
  const { animateLayout, getLayoutStyles } = useLayoutAnimation({
    duration: 'normal',
    easing: 'easeInOut',
  })
  const themeMotion = createThemeMotion()

  const toggleSidebar = () => {
    const newCollapsedState = !isSidebarCollapsed()

    // Animate layout change when sidebar toggles
    if (shouldAnimate()) {
      const layoutElement = document.querySelector(
        '.layout-container'
      ) as HTMLElement
      animateLayout(
        isSidebarCollapsed() ? 'expanded' : 'collapsed',
        newCollapsedState ? 'collapsed' : 'expanded',
        layoutElement
      )
    }

    setIsSidebarCollapsed(newCollapsedState)
  }

  // Get main content animation classes
  const getMainContentClasses = () => {
    const baseClasses = 'flex-1 flex flex-col overflow-hidden'

    if (shouldAnimate() && isTransitioning()) {
      return cn(baseClasses, 'layout-transitioning')
    }

    return baseClasses
  }

  // Get page props with merged classes
  const getPagePropsWithClasses = () => {
    const pageProps = getPageProps()
    const pageClass = pageProps.class as string

    return {
      ...pageProps,
      class: cn('flex-1 overflow-auto', pageClass),
    }
  }

  // Get layout container styles with theme-aware animations
  const getLayoutContainerStyles = () => {
    const baseStyles: Record<string, string | number> = {
      ...getLayoutStyles(),
      transition: shouldAnimate()
        ? `background-color ${UI_CONFIG.animationDuration.normal}ms ease-in-out`
        : 'none',
    }

    // Apply theme-aware motion styles
    if (themeMotion.isTransitioning()) {
      baseStyles.opacity = 0.9
      baseStyles.filter =
        themeMotion.getCurrentTheme() === 'dark'
          ? 'brightness(1.1)'
          : 'brightness(0.95)'
    }

    return baseStyles
  }

  return (
    <div
      class={cn(
        'flex h-screen layout-container',
        getBackgroundClasses('primary')
      )}
      style={getLayoutContainerStyles()}
    >
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed()}
        onToggleCollapse={toggleSidebar}
      />

      {/* Main Content */}
      <div class={getMainContentClasses()}>
        {/* Header */}
        <Header searchQuery={props.searchQuery} onSearch={props.onSearch} />

        {/* Page Content */}
        <main
          style={{
            'padding-top': `${UI_CONFIG.headerHeight}px`,
          }}
          {...getPagePropsWithClasses()}
        >
          <div
            class="p-6"
            style={{
              transition: shouldAnimate()
                ? `opacity ${UI_CONFIG.animationDuration.fast}ms ease-in-out, transform ${UI_CONFIG.animationDuration.fast}ms ease-in-out`
                : 'none',
            }}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  )
}
