import { type Component, Show, For, createSignal, type JSX } from 'solid-js'
import { Search, Bell, User, Sun, Moon, Monitor } from 'lucide-solid'
import { useTheme } from '../../contexts/ThemeContext'
import { ThemeErrorBoundary } from '../ui/ThemeErrorBoundary'
import { UI_CONFIG } from '../../lib/config'
import { getStatusClasses } from '../../lib/theme-helpers'
import {
  getTextClasses,
  getBackgroundClasses,
  getBorderClasses,
  getFocusClasses,
  getThemeComponentClasses,
} from '../../lib/theme-classes'
import { cn } from '../../lib/class-utils'
import {
  useReducedMotion,
  useModalAnimation,
  useInteractionAnimation,
  useThemeTransition,
} from '../../hooks/useMotionAnimations'
import { MOTION_VARIANTS } from '../../lib/motion-variants'
import { createThemeMotion } from '../../lib/motion-theme'

// Type definitions for modal props
type ModalProps = Record<string, unknown> & {
  style?: Record<string, string | number>
  class?: string
}

// Type definitions for animation styles
interface AnimationStyles {
  [key: string]: string | number | undefined
}

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

// Type for Lucide Solid icons
type IconComponent = Component<{ class?: string; style?: JSX.CSSProperties }>

interface HeaderProps {
  onSearch: (query: string) => void
  searchQuery: string
}

// Search Bar Component
const SearchBar: Component<{
  searchQuery: string
  onSearch: (query: string) => void
}> = (props) => {
  return (
    <div class="flex-1 max-w-2xl">
      <div class="relative">
        <Search
          class={cn(
            'absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4',
            getTextClasses('tertiary')
          )}
        />
        <input
          type="text"
          placeholder="Search anime, genres, or tags..."
          value={props.searchQuery}
          onInput={(e) => props.onSearch(e.currentTarget.value)}
          class={cn(
            'w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent',
            getFocusClasses('default'),
            getBackgroundClasses('secondary'),
            getBorderClasses('secondary'),
            getTextClasses('primary'),
            cn('placeholder:text-muted-foreground')
          )}
        />
      </div>
    </div>
  )
}

// Theme Dropdown Component
const ThemeDropdown: Component<{
  isOpen: boolean
  currentTheme: 'light' | 'dark' | 'auto'
  onThemeChange: (theme: 'light' | 'dark' | 'auto') => void
  modalProps: ModalProps
}> = (props) => {
  return (
    <Show when={props.isOpen}>
      <div
        {...props.modalProps}
        class={cn(
          'absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50',
          getBackgroundClasses('primary'),
          getBorderClasses('secondary')
        )}
        style={{
          ...props.modalProps.style,
        }}
      >
        <div class="p-2">
          <For each={['light', 'dark', 'auto'] as const}>
            {(theme) => (
              <button
                type="button"
                onClick={() => props.onThemeChange(theme)}
                class={cn(
                  'w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left',
                  props.currentTheme === theme
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
              >
                <Show when={theme === 'light'}>
                  <Sun class="w-4 h-4" />
                </Show>
                <Show when={theme === 'dark'}>
                  <Moon class="w-4 h-4" />
                </Show>
                <Show when={theme === 'auto'}>
                  <Monitor class="w-4 h-4" />
                </Show>
                <span class="capitalize">{theme}</span>
                <Show when={props.currentTheme === theme}>
                  <span class={cn('ml-auto', getStatusClasses('info', 'text'))}>
                    ✓
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}

// Theme Toggle Button Component
const ThemeToggleButton: Component<{
  onClick: () => void
  icon: IconComponent
  isTransitioning: boolean
  animationStyles: AnimationStyles
  eventHandlers: EventHandlers
}> = (props) => {
  const { shouldAnimate } = useReducedMotion()

  return (
    <button
      type="button"
      onClick={props.onClick}
      {...props.eventHandlers}
      style={props.animationStyles}
      class={cn(
        'p-2 rounded-lg',
        getThemeComponentClasses({
          variant: 'muted',
          interactive: true,
        })
      )}
      title="Toggle theme"
    >
      <props.icon
        class={cn('w-5 h-5', getTextClasses('secondary'))}
        style={{
          transition: shouldAnimate()
            ? `transform ${UI_CONFIG.animationDuration.normal}ms ease-in-out`
            : 'none',
          transform: props.isTransitioning ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      />
    </button>
  )
}

// Hook for theme change logic
const useThemeChange = () => {
  const { state: themeState, setTheme } = useTheme()
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false)

  const themeTransition = useThemeTransition({
    duration: 'normal',
    easing: 'easeInOut',
    respectReducedMotion: true,
  })

  const handleThemeChange = async (theme: 'light' | 'dark' | 'auto') => {
    if (
      theme !== 'auto' &&
      themeState.theme !== 'auto' &&
      theme !== themeState.theme
    ) {
      await themeTransition.startTransition(theme as 'light' | 'dark')
    }
    setTheme(theme)
    setIsDropdownOpen(false)
  }

  return { themeState, isDropdownOpen, setIsDropdownOpen, handleThemeChange }
}

// Hook for theme animations
const useThemeAnimations = () => {
  const themeMotion = createThemeMotion()

  const themeDropdown = useModalAnimation({
    overlay: MOTION_VARIANTS.modal.overlay,
    content: MOTION_VARIANTS.modal.slideUp,
    closeOnOverlayClick: true,
  })

  const themeButtonAnimation = useInteractionAnimation({
    hoverVariant: MOTION_VARIANTS.hover.lift,
    tapVariant: MOTION_VARIANTS.tap.press,
  })

  const toggleDropdown = (
    isDropdownOpen: () => boolean,
    setIsDropdownOpen: (open: boolean) => void
  ) => {
    if (isDropdownOpen()) {
      setIsDropdownOpen(false)
      themeDropdown.close()
    } else {
      setIsDropdownOpen(true)
      themeDropdown.open()
    }
  }

  return {
    themeMotion,
    themeDropdown,
    themeButtonAnimation,
    toggleDropdown,
  }
}

// Custom hook for theme toggle logic
const useThemeToggle = () => {
  const { themeState, isDropdownOpen, setIsDropdownOpen, handleThemeChange } =
    useThemeChange()
  const { themeMotion, themeDropdown, themeButtonAnimation, toggleDropdown } =
    useThemeAnimations()

  const getThemeIcon = () => {
    switch (themeState.effectiveTheme) {
      case 'light':
        return Sun
      case 'dark':
        return Moon
      default:
        return Monitor
    }
  }

  return {
    themeState,
    isDropdownOpen,
    themeMotion,
    themeDropdown,
    themeButtonAnimation,
    handleThemeChange,
    getThemeIcon,
    toggleDropdown: () => toggleDropdown(isDropdownOpen, setIsDropdownOpen),
  }
}

// Theme Toggle Component
const ThemeToggle: Component = () => {
  const {
    themeState,
    isDropdownOpen,
    themeMotion,
    themeDropdown,
    themeButtonAnimation,
    handleThemeChange,
    getThemeIcon,
    toggleDropdown,
  } = useThemeToggle()

  return (
    <ThemeErrorBoundary
      onError={(error) => {
        console.error('Theme switching error in header:', error)
      }}
    >
      <div class="relative group">
        <ThemeToggleButton
          onClick={toggleDropdown}
          icon={getThemeIcon()}
          isTransitioning={themeMotion.isTransitioning()}
          animationStyles={themeButtonAnimation.getAnimationStyles()}
          eventHandlers={themeButtonAnimation.eventHandlers}
        />

        <ThemeDropdown
          isOpen={isDropdownOpen()}
          currentTheme={themeState.theme}
          onThemeChange={handleThemeChange}
          modalProps={themeDropdown.getModalProps()}
        />
      </div>
    </ThemeErrorBoundary>
  )
}

// Notifications Button Component
const NotificationsButton: Component = () => {
  const { shouldAnimate } = useReducedMotion()

  return (
    <button
      type="button"
      class={cn(
        'relative p-2 rounded-lg',
        getThemeComponentClasses({ variant: 'muted', interactive: true })
      )}
      style={{
        transition: shouldAnimate()
          ? `all ${UI_CONFIG.animationDuration.fast}ms ease-in-out`
          : 'none',
      }}
      title="Notifications"
    >
      <Bell
        class={cn('w-5 h-5', getTextClasses('secondary'))}
        style={{
          transition: shouldAnimate()
            ? `transform ${UI_CONFIG.animationDuration.fast}ms ease-in-out`
            : 'none',
        }}
      />
      <span
        class={cn(
          'absolute top-1 right-1 w-2 h-2 rounded-full animate-pulse',
          getStatusClasses('error', 'bg')
        )}
      ></span>
    </button>
  )
}

// User Dropdown Component
const UserDropdown: Component<{
  isOpen: boolean
  modalProps: ModalProps
}> = (props) => {
  return (
    <Show when={props.isOpen}>
      <div
        {...props.modalProps}
        class={cn(
          'absolute right-0 mt-2 w-56 rounded-lg shadow-lg border z-50',
          getBackgroundClasses('primary'),
          getBorderClasses('secondary')
        )}
        style={{
          ...props.modalProps.style,
        }}
      >
        <div class={cn('p-4 border-b', getBorderClasses('secondary'))}>
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User class="w-5 h-5 text-white" />
            </div>
            <div>
              <div class="font-medium text-gray-900 dark:text-white">User</div>
              <div class={cn('text-sm', getTextClasses('tertiary'))}>
                user@example.com
              </div>
            </div>
          </div>
        </div>
        <div class="p-2">
          <UserMenuItem>Profile</UserMenuItem>
          <UserMenuItem>Preferences</UserMenuItem>
          <hr class={cn('my-2', getBorderClasses('secondary'))} />
          <UserMenuItem variant="error">Sign out</UserMenuItem>
        </div>
      </div>
    </Show>
  )
}

// User Menu Item Component
const UserMenuItem: Component<{
  children: string
  variant?: 'default' | 'error'
}> = (props) => {
  const { shouldAnimate } = useReducedMotion()

  return (
    <button
      type="button"
      class={cn(
        'w-full text-left px-3 py-2 rounded-lg',
        props.variant === 'error'
          ? getStatusClasses('error', 'text')
          : getTextClasses('secondary'),
        getThemeComponentClasses({
          variant: 'muted',
          interactive: true,
        })
      )}
      style={{
        transition: shouldAnimate()
          ? `all ${UI_CONFIG.animationDuration.fast}ms ease-in-out`
          : 'none',
      }}
    >
      {props.children}
    </button>
  )
}

// User Menu Component
const UserMenu: Component = () => {
  const { shouldAnimate } = useReducedMotion()
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false)

  const userDropdown = useModalAnimation({
    overlay: MOTION_VARIANTS.modal.overlay,
    content: MOTION_VARIANTS.modal.slideUp,
    closeOnOverlayClick: true,
  })

  const userButtonAnimation = useInteractionAnimation({
    hoverVariant: MOTION_VARIANTS.hover.lift,
    tapVariant: MOTION_VARIANTS.tap.press,
  })

  const toggleDropdown = () => {
    if (isDropdownOpen()) {
      setIsDropdownOpen(false)
      userDropdown.close()
    } else {
      setIsDropdownOpen(true)
      userDropdown.open()
    }
  }

  return (
    <div class="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        {...userButtonAnimation.eventHandlers}
        style={userButtonAnimation.getAnimationStyles()}
        class={cn(
          'flex items-center space-x-2 p-2 rounded-lg',
          getThemeComponentClasses({ variant: 'muted', interactive: true })
        )}
        title="User menu"
      >
        <div
          class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
          style={{
            transition: shouldAnimate()
              ? `transform ${UI_CONFIG.animationDuration.fast}ms ease-in-out`
              : 'none',
          }}
        >
          <User class="w-4 h-4 text-white" />
        </div>
      </button>

      <UserDropdown
        isOpen={isDropdownOpen()}
        modalProps={userDropdown.getModalProps()}
      />
    </div>
  )
}

// Main Header Component
export const Header: Component<HeaderProps> = (props) => {
  return (
    <header
      class={cn(
        'border-b px-6 flex items-center justify-between',
        getBackgroundClasses('primary'),
        getBorderClasses('secondary')
      )}
      style={{ height: `${UI_CONFIG.headerHeight}px` }}
    >
      <SearchBar searchQuery={props.searchQuery} onSearch={props.onSearch} />

      <div class="flex items-center space-x-4 ml-6">
        <ThemeToggle />
        <NotificationsButton />
        <UserMenu />
      </div>
    </header>
  )
}
