import { type Component, Show, For } from 'solid-js'
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
} from '../../lib/theme-classes'
import { cn } from '../../lib/class-utils'

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
      class={cn(
        'border-b px-6 flex items-center justify-between',
        getBackgroundClasses('primary'),
        getBorderClasses('secondary')
      )}
      style={{ height: `${UI_CONFIG.headerHeight}px` }}
    >
      {/* Search Bar */}
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
              cn('placeholder:text-muted-foreground') // Using semantic muted foreground for placeholders
            )}
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div class="flex items-center space-x-4 ml-6">
        {/* Theme Toggle */}
        <ThemeErrorBoundary
          onError={(error) => {
            console.error('Theme switching error in header:', error)
          }}
        >
          <div class="relative group">
            <button
              type="button"
              onClick={toggleTheme}
              class={cn(
                cn(
                  cn(
                    'p-2 rounded-lg transition-colors hover:bg-muted hover:bg-muted'
                  )
                )
              )}
              title="Toggle theme"
            >
              <ThemeIcon class={cn('w-5 h-5', getTextClasses('secondary'))} />
            </button>

            {/* Theme Dropdown */}
            <div
              class={cn(
                'absolute right-0 mt-2 w-48 rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50',
                getBackgroundClasses('primary'),
                getBorderClasses('secondary')
              )}
            >
              <div class="p-2">
                <For each={['light', 'dark', 'auto'] as const}>
                  {(theme) => (
                    <button
                      type="button"
                      onClick={() => handleThemeChange(theme)}
                      class={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        themeState.theme === theme
                          ? cn(
                              getStatusClasses('info', 'bg'),
                              getStatusClasses('info', 'text')
                            )
                          : cn(
                              cn('hover:bg-muted hover:bg-muted'),
                              getTextClasses('secondary')
                            )
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
                        <span
                          class={cn(
                            'ml-auto',
                            getStatusClasses('info', 'text')
                          )}
                        >
                          ✓
                        </span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </div>
        </ThemeErrorBoundary>

        {/* Notifications */}
        <button
          type="button"
          class={cn(
            cn(
              'relative p-2 rounded-lg transition-colors hover:bg-muted hover:bg-muted'
            )
          )}
          title="Notifications"
        >
          <Bell class={cn('w-5 h-5', getTextClasses('secondary'))} />
          <span
            class={`absolute top-1 right-1 w-2 h-2 ${getStatusClasses('error', 'bg')} rounded-full`}
          ></span>
        </button>

        {/* User Menu */}
        <div class="relative group">
          <button
            type="button"
            class={cn(
              cn(
                'flex items-center space-x-2 p-2 rounded-lg transition-colors hover:bg-muted hover:bg-muted'
              )
            )}
            title="User menu"
          >
            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User class="w-4 h-4 text-white" />
            </div>
          </button>

          {/* User Dropdown */}
          <div
            class={cn(
              'absolute right-0 mt-2 w-56 rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50',
              getBackgroundClasses('primary'),
              getBorderClasses('secondary')
            )}
          >
            <div class={cn('p-4 border-b', getBorderClasses('secondary'))}>
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User class="w-5 h-5 text-white" />
                </div>
                <div>
                  <div class="font-medium text-gray-900 dark:text-white">
                    User
                  </div>
                  <div class={cn('text-sm', getTextClasses('tertiary'))}>
                    user@example.com
                  </div>
                </div>
              </div>
            </div>
            <div class="p-2">
              <button
                type="button"
                class={cn(
                  'w-full text-left px-3 py-2 rounded-lg hover:bg-muted hover:bg-muted',
                  getTextClasses('secondary')
                )}
              >
                Profile
              </button>
              <button
                type="button"
                class={cn(
                  'w-full text-left px-3 py-2 rounded-lg hover:bg-muted hover:bg-muted',
                  getTextClasses('secondary')
                )}
              >
                Preferences
              </button>
              <hr class={cn('my-2', getBorderClasses('secondary'))} />
              <button
                type="button"
                class={cn(
                  'w-full text-left px-3 py-2 rounded-lg hover:bg-muted hover:bg-muted',
                  getStatusClasses('error', 'text')
                )}
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
