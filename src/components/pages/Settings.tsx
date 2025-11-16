import { type Component, createSignal, For, Show } from 'solid-js'
import {
  FolderOpen,
  Save,
  RotateCcw,
  Database,
  Globe,
  Shield,
} from 'lucide-solid'
import {
  appState,
  storeActions,
  defaultSettings,
  type AppSettings,
} from '../../lib/store'
import { FILE_NAMING_PATTERNS } from '../../lib/config'
import {
  cn,
  getTextClasses,
  getBackgroundClasses,
  getBorderClasses,
  getThemeComponentClasses,
  getStatusClasses,
} from '../../lib/utils'

export const Settings: Component = () => {
  const [activeTab, setActiveTab] = createSignal<
    'general' | 'directories' | 'anidb' | 'naming' | 'advanced'
  >('general')
  const [hasChanges, setHasChanges] = createSignal(false)
  const [tempSettings, setTempSettings] = createSignal({ ...appState.settings })

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'directories', label: 'Directories', icon: FolderOpen },
    { id: 'anidb', label: 'AniDB', icon: Database },
    { id: 'naming', label: 'File Naming', icon: Save },
    { id: 'advanced', label: 'Advanced', icon: Shield },
  ]

  const updateTempSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setTempSettings((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const saveSettings = () => {
    storeActions.updateSettings(tempSettings())
    setHasChanges(false)
  }

  const resetSettings = () => {
    setTempSettings({ ...defaultSettings })
    setHasChanges(true)
  }

  const addDirectory = (type: 'anime' | 'download') => {
    const path = prompt(`Enter ${type} directory path:`)
    if (path) {
      if (type === 'anime') {
        updateTempSetting('animeDirectories', [
          ...tempSettings().animeDirectories,
          path,
        ])
      } else {
        updateTempSetting('downloadDirectory', path)
      }
    }
  }

  const removeDirectory = (index: number) => {
    const dirs = [...tempSettings().animeDirectories]
    dirs.splice(index, 1)
    updateTempSetting('animeDirectories', dirs)
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class={cn('text-3xl font-bold', getTextClasses('primary'))}>
            Settings
          </h1>
          <p class={cn('mt-2', getTextClasses('secondary'))}>
            Configure your Kogoro application preferences
          </p>
        </div>

        <div class="flex space-x-3">
          <button
            type="button"
            onClick={resetSettings}
            class={cn(
              'flex items-center space-x-2 rounded-lg transition-colors',
              getThemeComponentClasses({
                variant: 'muted',
                interactive: true,
              })
            )}
          >
            <RotateCcw class="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={saveSettings}
            disabled={!hasChanges()}
            class={cn(
              'flex items-center space-x-2 rounded-lg transition-colors',
              'bg-accent text-accent-foreground hover:bg-accent-hover',
              'disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed'
            )}
          >
            <Save class="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div class="lg:col-span-1">
          <nav
            class={cn(
              'rounded-lg shadow-sm border p-2',
              getBackgroundClasses('primary'),
              getBorderClasses('primary')
            )}
          >
            <For each={tabs}>
              {(tab) => {
                const Icon = tab.icon
                return (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        tab.id as
                          | 'general'
                          | 'directories'
                          | 'anidb'
                          | 'naming'
                          | 'advanced'
                      )
                    }
                    class={cn(
                      'w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors text-sm font-medium',
                      activeTab() === tab.id
                        ? cn('bg-accent text-accent-foreground')
                        : cn(getTextClasses('secondary'), 'hover:bg-muted')
                    )}
                  >
                    <Icon class="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              }}
            </For>
          </nav>
        </div>

        {/* Content */}
        <div class="lg:col-span-3">
          <div
            class={cn(
              'rounded-lg shadow-sm border',
              getBackgroundClasses('primary'),
              getBorderClasses('primary')
            )}
          >
            {/* General Tab */}
            <Show when={activeTab() === 'general'}>
              <div class="p-6 space-y-6">
                <h2
                  class={cn('text-lg font-semibold', getTextClasses('primary'))}
                >
                  General Settings
                </h2>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      for="theme-select"
                      class={cn(
                        'block text-sm font-medium mb-2',
                        getTextClasses('secondary')
                      )}
                    >
                      Theme
                    </label>
                    <select
                      id="theme-select"
                      value={tempSettings().theme}
                      onChange={(e) =>
                        updateTempSetting(
                          'theme',
                          e.target.value as 'light' | 'dark' | 'auto'
                        )
                      }
                      class={cn(
                        'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring',
                        getBackgroundClasses('primary'),
                        getBorderClasses('primary'),
                        getTextClasses('primary')
                      )}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>

                  <div>
                    <label
                      for="language-select"
                      class={cn(
                        'block text-sm font-medium mb-2',
                        getTextClasses('secondary')
                      )}
                    >
                      Language
                    </label>
                    <select
                      id="language-select"
                      value={tempSettings().language}
                      onChange={(e) =>
                        updateTempSetting('language', e.target.value)
                      }
                      class={cn(
                        'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring',
                        getBackgroundClasses('primary'),
                        getBorderClasses('primary'),
                        getTextClasses('primary')
                      )}
                    >
                      <option value="en">English</option>
                      <option value="ja">Japanese</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </div>
                </div>

                <div class="space-y-4">
                  <label class="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={tempSettings().autoRefresh}
                      onChange={(e) =>
                        updateTempSetting(
                          'autoRefresh',
                          e.currentTarget.checked
                        )
                      }
                      class={cn(
                        'w-4 h-4 rounded focus-ring focus-ring-inset',
                        'accent'
                      )}
                    />
                    <span class={cn('text-sm', getTextClasses('secondary'))}>
                      Auto-refresh collection
                    </span>
                  </label>

                  <label class="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={tempSettings().autoScan}
                      onChange={(e) =>
                        updateTempSetting('autoScan', e.currentTarget.checked)
                      }
                      class={cn(
                        'w-4 h-4 rounded focus-ring focus-ring-inset',
                        'accent'
                      )}
                    />
                    <span class={cn('text-sm', getTextClasses('secondary'))}>
                      Auto-scan directories
                    </span>
                  </label>
                </div>
              </div>
            </Show>

            {/* Directories Tab */}
            <Show when={activeTab() === 'directories'}>
              <div class="p-6 space-y-6">
                <h2
                  class={cn('text-lg font-semibold', getTextClasses('primary'))}
                >
                  Directory Settings
                </h2>

                {/* Anime Directories */}
                <div>
                  <div class="flex items-center justify-between mb-4">
                    <span
                      class={cn(
                        'text-sm font-medium',
                        getTextClasses('secondary')
                      )}
                    >
                      Anime Directories
                    </span>
                    <button
                      type="button"
                      onClick={() => addDirectory('anime')}
                      class={cn(
                        'px-3 py-1 text-sm rounded-lg transition-colors',
                        'bg-accent text-accent-foreground hover:bg-accent-hover'
                      )}
                    >
                      Add Directory
                    </button>
                  </div>

                  <div class="space-y-2">
                    <For each={tempSettings().animeDirectories}>
                      {(dir, index) => (
                        <div
                          class={cn(
                            'flex items-center space-x-2 p-3 rounded-lg',
                            getBackgroundClasses('secondary')
                          )}
                        >
                          <FolderOpen
                            class={cn('w-4 h-4', getTextClasses('tertiary'))}
                          />
                          <span
                            class={cn(
                              'flex-1 text-sm',
                              getTextClasses('primary')
                            )}
                          >
                            {dir}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDirectory(index())}
                            class={cn(
                              'transition-colors',
                              getStatusClasses('error', 'text')
                            )}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </For>

                    <Show when={tempSettings().animeDirectories.length === 0}>
                      <div
                        class={cn(
                          'text-center py-8',
                          getTextClasses('tertiary')
                        )}
                      >
                        No anime directories configured
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Download Directory */}
                <div>
                  <div class="flex items-center justify-between mb-4">
                    <span
                      class={cn(
                        'text-sm font-medium',
                        getTextClasses('secondary')
                      )}
                    >
                      Download Directory
                    </span>
                    <button
                      type="button"
                      onClick={() => addDirectory('download')}
                      class={cn(
                        'px-3 py-1 text-sm rounded-lg transition-colors',
                        'bg-accent text-accent-foreground hover:bg-accent-hover'
                      )}
                    >
                      Browse
                    </button>
                  </div>

                  <div
                    class={cn(
                      'p-3 rounded-lg',
                      getBackgroundClasses('secondary')
                    )}
                  >
                    <Show
                      when={tempSettings().downloadDirectory}
                      fallback={
                        <span class={cn(getTextClasses('tertiary'))}>
                          No download directory set
                        </span>
                      }
                    >
                      <div class="flex items-center space-x-2">
                        <FolderOpen
                          class={cn('w-4 h-4', getTextClasses('tertiary'))}
                        />
                        <span class={cn('text-sm', getTextClasses('primary'))}>
                          {tempSettings().downloadDirectory}
                        </span>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </Show>

            {/* AniDB Tab */}
            <Show when={activeTab() === 'anidb'}>
              <div class="p-6 space-y-6">
                <h2
                  class={cn('text-lg font-semibold', getTextClasses('primary'))}
                >
                  AniDB Settings
                </h2>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      for="anidb-client"
                      class={cn(
                        'block text-sm font-medium mb-2',
                        getTextClasses('secondary')
                      )}
                    >
                      Client Name
                    </label>
                    <input
                      id="anidb-client"
                      type="text"
                      value={tempSettings().anidbClient}
                      onChange={(e) =>
                        updateTempSetting('anidbClient', e.currentTarget.value)
                      }
                      class={cn(
                        'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring',
                        getBackgroundClasses('primary'),
                        getBorderClasses('primary'),
                        getTextClasses('primary')
                      )}
                    />
                  </div>

                  <div>
                    <label
                      for="anidb-port"
                      class={cn(
                        'block text-sm font-medium mb-2',
                        getTextClasses('secondary')
                      )}
                    >
                      Port
                    </label>
                    <input
                      id="anidb-port"
                      type="number"
                      value={tempSettings().anidbPort}
                      onChange={(e) =>
                        updateTempSetting(
                          'anidbPort',
                          parseInt(e.currentTarget.value, 10)
                        )
                      }
                      class={cn(
                        'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring',
                        getBackgroundClasses('primary'),
                        getBorderClasses('primary'),
                        getTextClasses('primary')
                      )}
                    />
                  </div>

                  <div>
                    <label
                      for="anidb-username"
                      class={cn(
                        'block text-sm font-medium mb-2',
                        getTextClasses('secondary')
                      )}
                    >
                      Username (Optional)
                    </label>
                    <input
                      id="anidb-username"
                      type="text"
                      value={tempSettings().anidbUsername || ''}
                      onChange={(e) =>
                        updateTempSetting(
                          'anidbUsername',
                          e.currentTarget.value || undefined
                        )
                      }
                      placeholder="Leave empty for anonymous access"
                      class={cn(
                        'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring',
                        getBackgroundClasses('primary'),
                        getBorderClasses('primary'),
                        getTextClasses('primary')
                      )}
                    />
                  </div>

                  <div>
                    <label
                      for="anidb-password"
                      class={cn(
                        'block text-sm font-medium mb-2',
                        getTextClasses('secondary')
                      )}
                    >
                      Password (Optional)
                    </label>
                    <input
                      id="anidb-password"
                      type="password"
                      value={tempSettings().anidbPassword || ''}
                      onChange={(e) =>
                        updateTempSetting(
                          'anidbPassword',
                          e.currentTarget.value || undefined
                        )
                      }
                      placeholder="Leave empty for anonymous access"
                      class={cn(
                        'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring',
                        getBackgroundClasses('primary'),
                        getBorderClasses('primary'),
                        getTextClasses('primary')
                      )}
                    />
                  </div>
                </div>
              </div>
            </Show>

            {/* File Naming Tab */}
            <Show when={activeTab() === 'naming'}>
              <div class="p-6 space-y-6">
                <h2
                  class={cn('text-lg font-semibold', getTextClasses('primary'))}
                >
                  File Naming Settings
                </h2>

                <div>
                  <label
                    for="filename-format"
                    class={cn(
                      'block text-sm font-medium mb-2',
                      getTextClasses('secondary')
                    )}
                  >
                    File Name Format
                  </label>
                  <select
                    id="filename-format"
                    value={tempSettings().fileNameFormat}
                    onChange={(e) =>
                      updateTempSetting('fileNameFormat', e.target.value)
                    }
                    class={cn(
                      'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring mb-3',
                      getBackgroundClasses('primary'),
                      getBorderClasses('primary'),
                      getTextClasses('primary')
                    )}
                  >
                    <For each={Object.entries(FILE_NAMING_PATTERNS)}>
                      {([key, value]) => (
                        <option value={value}>
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </option>
                      )}
                    </For>
                  </select>

                  <div
                    class={cn(
                      'p-3 rounded-lg',
                      getBackgroundClasses('secondary')
                    )}
                  >
                    <p class={cn('text-sm mb-2', getTextClasses('secondary'))}>
                      Available variables:
                    </p>
                    <div
                      class={cn(
                        'text-xs space-y-1 font-mono',
                        getTextClasses('tertiary')
                      )}
                    >
                      <div>{'{title}'} - Anime title</div>
                      <div>{'{season}'} - Season number</div>
                      <div>{'{episode}'} - Episode number</div>
                      <div>{'{name}'} - Episode name</div>
                      <div>{'{date}'} - Release date</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label class="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={tempSettings().createSeasonFolders}
                      onChange={(e) =>
                        updateTempSetting(
                          'createSeasonFolders',
                          e.currentTarget.checked
                        )
                      }
                      class={cn(
                        'w-4 h-4 rounded focus-ring focus-ring-inset',
                        'accent'
                      )}
                    />
                    <span class={cn('text-sm', getTextClasses('secondary'))}>
                      Create season folders
                    </span>
                  </label>
                </div>
              </div>
            </Show>

            {/* Advanced Tab */}
            <Show when={activeTab() === 'advanced'}>
              <div class="p-6 space-y-6">
                <h2
                  class={cn('text-lg font-semibold', getTextClasses('primary'))}
                >
                  Advanced Settings
                </h2>

                <div class="space-y-4">
                  <label class="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={tempSettings().includeSubtitles}
                      onChange={(e) =>
                        updateTempSetting(
                          'includeSubtitles',
                          e.currentTarget.checked
                        )
                      }
                      class={cn(
                        'w-4 h-4 rounded focus-ring focus-ring-inset',
                        'accent'
                      )}
                    />
                    <span class={cn('text-sm', getTextClasses('secondary'))}>
                      Include subtitles in scans
                    </span>
                  </label>

                  <label class="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={tempSettings().generateThumbnails}
                      onChange={(e) =>
                        updateTempSetting(
                          'generateThumbnails',
                          e.currentTarget.checked
                        )
                      }
                      class={cn(
                        'w-4 h-4 rounded focus-ring focus-ring-inset',
                        'accent'
                      )}
                    />
                    <span class={cn('text-sm', getTextClasses('secondary'))}>
                      Generate video thumbnails
                    </span>
                  </label>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
