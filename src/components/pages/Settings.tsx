import { type Component, createSignal, For, Show } from 'solid-js'
import {
  FolderOpen,
  Save,
  RotateCcw,
  Database,
  Globe,
  Shield,
} from 'lucide-solid'
import { appState, storeActions, defaultSettings } from '../../lib/store'
import { FILE_NAMING_PATTERNS } from '../../lib/config'

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

  const updateTempSetting = (key: string, value: any) => {
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
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2">
            Configure your Kogoro application preferences
          </p>
        </div>

        <div class="flex space-x-3">
          <button
            onClick={resetSettings}
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center space-x-2"
          >
            <RotateCcw class="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            onClick={saveSettings}
            disabled={!hasChanges()}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Save class="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div class="lg:col-span-1">
          <nav class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2">
            <For each={tabs}>
              {(tab) => {
                const Icon = tab.icon
                return (
                  <button
                    onClick={() => setActiveTab(tab.id as any)}
                    class={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab() === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon class="w-4 h-4" />
                    <span class="text-sm font-medium">{tab.label}</span>
                  </button>
                )
              }}
            </For>
          </nav>
        </div>

        {/* Content */}
        <div class="lg:col-span-3">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* General Tab */}
            <Show when={activeTab() === 'general'}>
              <div class="p-6 space-y-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  General Settings
                </h2>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Theme
                    </label>
                    <select
                      value={tempSettings().theme}
                      onChange={(e) =>
                        updateTempSetting('theme', e.target.value)
                      }
                      class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Language
                    </label>
                    <select
                      value={tempSettings().language}
                      onChange={(e) =>
                        updateTempSetting('language', e.target.value)
                      }
                      class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
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
                      class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
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
                      class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                      Auto-scan directories
                    </span>
                  </label>
                </div>
              </div>
            </Show>

            {/* Directories Tab */}
            <Show when={activeTab() === 'directories'}>
              <div class="p-6 space-y-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  Directory Settings
                </h2>

                {/* Anime Directories */}
                <div>
                  <div class="flex items-center justify-between mb-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Anime Directories
                    </label>
                    <button
                      onClick={() => addDirectory('anime')}
                      class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Add Directory
                    </button>
                  </div>

                  <div class="space-y-2">
                    <For each={tempSettings().animeDirectories}>
                      {(dir, index) => (
                        <div class="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <FolderOpen class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <span class="flex-1 text-sm text-gray-900 dark:text-white">
                            {dir}
                          </span>
                          <button
                            onClick={() => removeDirectory(index())}
                            class="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </For>

                    <Show when={tempSettings().animeDirectories.length === 0}>
                      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                        No anime directories configured
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Download Directory */}
                <div>
                  <div class="flex items-center justify-between mb-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Download Directory
                    </label>
                    <button
                      onClick={() => addDirectory('download')}
                      class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Browse
                    </button>
                  </div>

                  <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Show
                      when={tempSettings().downloadDirectory}
                      fallback={
                        <span class="text-gray-500 dark:text-gray-400">
                          No download directory set
                        </span>
                      }
                    >
                      <div class="flex items-center space-x-2">
                        <FolderOpen class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span class="text-sm text-gray-900 dark:text-white">
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
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  AniDB Settings
                </h2>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Client Name
                    </label>
                    <input
                      type="text"
                      value={tempSettings().anidbClient}
                      onChange={(e) =>
                        updateTempSetting('anidbClient', e.currentTarget.value)
                      }
                      class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Port
                    </label>
                    <input
                      type="number"
                      value={tempSettings().anidbPort}
                      onChange={(e) =>
                        updateTempSetting(
                          'anidbPort',
                          parseInt(e.currentTarget.value)
                        )
                      }
                      class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username (Optional)
                    </label>
                    <input
                      type="text"
                      value={tempSettings().anidbUsername || ''}
                      onChange={(e) =>
                        updateTempSetting(
                          'anidbUsername',
                          e.currentTarget.value || undefined
                        )
                      }
                      placeholder="Leave empty for anonymous access"
                      class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password (Optional)
                    </label>
                    <input
                      type="password"
                      value={tempSettings().anidbPassword || ''}
                      onChange={(e) =>
                        updateTempSetting(
                          'anidbPassword',
                          e.currentTarget.value || undefined
                        )
                      }
                      placeholder="Leave empty for anonymous access"
                      class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </Show>

            {/* File Naming Tab */}
            <Show when={activeTab() === 'naming'}>
              <div class="p-6 space-y-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  File Naming Settings
                </h2>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    File Name Format
                  </label>
                  <select
                    value={tempSettings().fileNameFormat}
                    onChange={(e) =>
                      updateTempSetting('fileNameFormat', e.target.value)
                    }
                    class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white mb-3"
                  >
                    <For each={Object.entries(FILE_NAMING_PATTERNS)}>
                      {([key, value]) => (
                        <option value={value}>
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </option>
                      )}
                    </For>
                  </select>

                  <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Available variables:
                    </p>
                    <div class="text-xs text-gray-500 dark:text-gray-500 space-y-1 font-mono">
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
                      class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                      Create season folders
                    </span>
                  </label>
                </div>
              </div>
            </Show>

            {/* Advanced Tab */}
            <Show when={activeTab() === 'advanced'}>
              <div class="p-6 space-y-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
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
                      class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
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
                      class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
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
