import { type Component, Show, For } from 'solid-js'
import { Search, Bell, User, Sun, Moon, Monitor } from 'lucide-solid'
import { useTheme } from '../../contexts/ThemeContext'
import { UI_CONFIG } from '../../lib/config'

interface HeaderProps {
  onSearch: (query: string) => void
  searchQuery: string
}

export const Header: Component<HeaderProps> = (props) => {
  const { state: themeState, setTheme, toggleTheme } = useTheme()

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    setTheme(theme)
  }

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

  const ThemeIcon = getThemeIcon()

  return (
    <header
      class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center justify-between"
      style={{ height: `${UI_CONFIG.headerHeight}px` }}
    >
      {/* Search Bar */}
      <div class="flex-1 max-w-2xl">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search anime, genres, or tags..."
            value={props.searchQuery}
            onInput={(e) => props.onSearch(e.currentTarget.value)}
            class="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div class="flex items-center space-x-4 ml-6">
        {/* Theme Toggle */}
        <div class="relative group">
          <button
            type="button"
            onClick={toggleTheme}
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Toggle theme"
          >
            <ThemeIcon class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Theme Dropdown */}
          <div class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div class="p-2">
              <For each={['light', 'dark', 'auto'] as const}>
                {(theme) => (
                  <button
                    type="button"
                    onClick={() => handleThemeChange(theme)}
                    class={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      themeState.theme === theme
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
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
                    <Show when={themeState.theme === theme}>
                      <span class="ml-auto text-blue-600 dark:text-blue-400">
                        ✓
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <button
          type="button"
          class="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Notifications"
        >
          <Bell class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User Menu */}
        <div class="relative group">
          <button
            type="button"
            class="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="User menu"
          >
            <div class="w-8 h-8 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User class="w-4 h-4 text-white" />
            </div>
          </button>

          {/* User Dropdown */}
          <div class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User class="w-5 h-5 text-white" />
                </div>
                <div>
                  <div class="font-medium text-gray-900 dark:text-white">
                    User
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    user@example.com
                  </div>
                </div>
              </div>
            </div>
            <div class="p-2">
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Profile
              </button>
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Preferences
              </button>
              <hr class="my-2 border-gray-200 dark:border-gray-700" />
              <button
                type="button"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
