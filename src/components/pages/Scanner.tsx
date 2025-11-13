import { type Component, createSignal, Show } from 'solid-js'
import {
  FolderOpen,
  Play,
  Pause,
  RefreshCw,
  Settings,
  Video as FileVideo,
  AlertTriangle as AlertCircle,
  CheckCircle2 as CheckCircle,
  Clock,
} from 'lucide-solid'
import { appState, storeActions } from '../../lib/store'

export const Scanner: Component = () => {
  const [isScanning, setIsScanning] = createSignal(false)
  const [scanProgress, setScanProgress] = createSignal(0)
  const [scanStatus, setScanStatus] = createSignal<
    'idle' | 'scanning' | 'completed' | 'error'
  >('idle')
  const [selectedDirectory, setSelectedDirectory] = createSignal('')
  const [scanResults, setScanResults] = createSignal<{
    total: number
    processed: number
    added: number
    updated: number
    errors: string[]
  }>({
    total: 0,
    processed: 0,
    added: 0,
    updated: 0,
    errors: [],
  })

  const startScan = async () => {
    if (!selectedDirectory()) {
      alert('Please select a directory to scan')
      return
    }

    setIsScanning(true)
    setScanStatus('scanning')
    setScanProgress(0)
    storeActions.setScanning(true, 0)

    // Simulate scanning process
    const totalFiles = 150 // Simulated total
    let processed = 0

    const scanInterval = setInterval(() => {
      processed += Math.floor(Math.random() * 5) + 1
      const progress = Math.min((processed / totalFiles) * 100, 100)

      setScanProgress(progress)
      storeActions.setScanning(true, progress)

      setScanResults({
        total: totalFiles,
        processed,
        added: Math.floor(processed * 0.3),
        updated: Math.floor(processed * 0.1),
        errors: [],
      })

      if (progress >= 100) {
        clearInterval(scanInterval)
        setIsScanning(false)
        setScanStatus('completed')
        storeActions.setScanning(false, 100)
      }
    }, 200)
  }

  const stopScan = () => {
    setIsScanning(false)
    setScanStatus('idle')
    storeActions.setScanning(false, 0)
  }

  const selectDirectory = () => {
    // In a real app, this would open a directory picker
    const directory = prompt('Enter directory path:', '/path/to/anime')
    if (directory) {
      setSelectedDirectory(directory)
    }
  }

  const getStatusIcon = () => {
    switch (scanStatus()) {
      case 'scanning':
        return RefreshCw
      case 'completed':
        return CheckCircle
      case 'error':
        return AlertCircle
      default:
        return Clock
    }
  }

  const getStatusColor = () => {
    switch (scanStatus()) {
      case 'scanning':
        return 'text-blue-600 dark:text-blue-400'
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const StatusIcon = getStatusIcon()

  return (
    <div class="space-y-6">
      {/* Header */}
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Scanner
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          Scan your directories for anime files and automatically add them to
          your collection
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Controls */}
        <div class="lg:col-span-2 space-y-6">
          {/* Directory Selection */}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Directory Selection
            </h2>

            <div class="space-y-4">
              <div>
                <label
                  for="scan-directory"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Scan Directory
                </label>
                <div class="flex space-x-2">
                  <input
                    id="scan-directory"
                    type="text"
                    value={selectedDirectory()}
                    onInput={(e) => setSelectedDirectory(e.currentTarget.value)}
                    placeholder="Select a directory containing anime files..."
                    class="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={selectDirectory}
                    class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <FolderOpen class="w-4 h-4" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>

              {/* Scan Options */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={true}
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    Include subdirectories
                  </span>
                </label>

                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={true}
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    Auto-match with AniDB
                  </span>
                </label>

                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={true}
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    Generate thumbnails
                  </span>
                </label>

                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={false}
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    Rename files automatically
                  </span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div class="flex space-x-3 mt-6">
              <Show
                when={!isScanning()}
                fallback={
                  <button
                    type="button"
                    onClick={stopScan}
                    class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Pause class="w-4 h-4" />
                    <span>Stop Scan</span>
                  </button>
                }
              >
                <button
                  type="button"
                  onClick={startScan}
                  disabled={!selectedDirectory()}
                  class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Play class="w-4 h-4" />
                  <span>Start Scan</span>
                </button>
              </Show>

              <button
                type="button"
                class="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Settings class="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* Progress */}
          <Show when={isScanning() || scanStatus() === 'completed'}>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  Scan Progress
                </h2>
                <div class={`flex items-center space-x-2 ${getStatusColor()}`}>
                  <StatusIcon class="w-5 h-5" />
                  <span class="capitalize">{scanStatus()}</span>
                </div>
              </div>

              <div class="space-y-4">
                <div>
                  <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-600 dark:text-gray-400">
                      Progress
                    </span>
                    <span class="text-gray-900 dark:text-white">
                      {Math.round(scanProgress())}%
                    </span>
                  </div>
                  <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress()}%` }}
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">
                      {scanResults().total}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      Total Files
                    </p>
                  </div>
                  <div>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white">
                      {scanResults().processed}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      Processed
                    </p>
                  </div>
                  <div>
                    <p class="text-2xl font-bold text-green-600 dark:text-green-400">
                      {scanResults().added}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      Added
                    </p>
                  </div>
                  <div>
                    <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {scanResults().updated}
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      Updated
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Sidebar */}
        <div class="space-y-6">
          {/* Quick Stats */}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Stats
            </h2>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  Anime in collection
                </span>
                <span class="font-medium text-gray-900 dark:text-white">
                  {appState.animeList.length}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  Total episodes
                </span>
                <span class="font-medium text-gray-900 dark:text-white">
                  {appState.episodes.length}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  Media files
                </span>
                <span class="font-medium text-gray-900 dark:text-white">
                  {appState.mediaFiles.length}
                </span>
              </div>
            </div>
          </div>

          {/* Supported Formats */}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Supported Formats
            </h2>
            <div class="space-y-3">
              <div>
                <div class="flex items-center space-x-2 mb-2">
                  <FileVideo class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">
                    Video
                  </span>
                </div>
                <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div>MP4, MKV, AVI, MOV</div>
                  <div>WMV, FLV, WebM, M4V</div>
                </div>
              </div>

              <div>
                <div class="flex items-center space-x-2 mb-2">
                  <div class="w-4 h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">
                    Subtitles
                  </span>
                </div>
                <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div>SRT, ASS, SSA, VTT</div>
                  <div>SUB, IDX</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
