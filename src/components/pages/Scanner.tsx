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
import {
  cn,
  getStatusClasses,
  getThemeComponentClasses,
  getTextClasses,
} from '../../lib/utils'
import { MotionCard } from '../ui/MotionCard'
import { MotionGrid } from '../ui/MotionGrid'
import {
  useScrollAnimation,
  useInteractionAnimation,
  useLoadingAnimation,
  usePageTransition,
  useAnimationState,
} from '../../hooks/useMotionAnimations'
import { MOTION_VARIANTS } from '../../lib/motion-variants'

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

  // Setup page transition animation
  const { getPageProps } = usePageTransition({
    variant: MOTION_VARIANTS.page.fade,
    duration: 'normal',
  })

  // Setup scroll animations
  const { elementRef: headerRef, getAnimationStyles: getHeaderStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
    })

  const { elementRef: controlsRef, getAnimationStyles: getControlsStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
      delay: 100,
    })

  const { elementRef: progressRef, getAnimationStyles: getProgressStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
      delay: 200,
    })

  const { elementRef: sidebarRef, getAnimationStyles: getSidebarStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
      delay: 300,
    })

  // Setup interaction animation for buttons
  const { eventHandlers: buttonHandlers, getAnimationStyles: getButtonStyles } =
    useInteractionAnimation({
      hoverVariant: MOTION_VARIANTS.hover.lift,
      tapVariant: MOTION_VARIANTS.tap.press,
    })

  // Setup loading animation for scanning
  const { startLoading, stopLoading } = useLoadingAnimation({
    type: 'spinner',
    size: 'medium',
  })

  // Setup animation state for scan progress
  const {
    startAnimation: startScanAnimation,
    stopAnimation: stopScanAnimation,
  } = useAnimationState({
    duration: 'slow',
    onStart: () => console.log('Scan animation started'),
    onEnd: () => console.log('Scan animation completed'),
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
    startLoading()
    startScanAnimation()

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
        stopLoading()
        stopScanAnimation()
      }
    }, 200)
  }

  const stopScan = () => {
    setIsScanning(false)
    setScanStatus('idle')
    storeActions.setScanning(false, 0)
    stopLoading()
    stopScanAnimation()
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
        return getStatusClasses('info', 'text')
      case 'completed':
        return getStatusClasses('success', 'text')
      case 'error':
        return getStatusClasses('error', 'text')
      default:
        return getTextClasses('tertiary')
    }
  }

  const StatusIcon = getStatusIcon()

  return (
    <div {...getPageProps()} class="space-y-6">
      {/* Header */}
      <div ref={headerRef} style={getHeaderStyles()}>
        <h1 class={cn('text-3xl font-bold', getTextClasses('primary'))}>
          Scanner
        </h1>
        <p class={cn('mt-2', getTextClasses('tertiary'))}>
          Scan your directories for anime files and automatically add them to
          your collection
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Controls */}
        <div
          ref={controlsRef}
          style={getControlsStyles()}
          class="lg:col-span-2 space-y-6"
        >
          {/* Directory Selection */}
          <MotionCard variant="standard" animateOnScroll={true}>
            <h2
              class={cn(
                'text-lg font-semibold mb-4',
                getTextClasses('primary')
              )}
            >
              Directory Selection
            </h2>

            <div class="space-y-4">
              <div>
                <label
                  for="scan-directory"
                  class={cn(
                    'block text-sm font-medium mb-2',
                    getTextClasses('secondary')
                  )}
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
                    class={cn(
                      'flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 transition-colors',
                      'bg-background text-foreground border',
                      'focus:ring-accent focus:border-accent'
                    )}
                  />
                  <button
                    type="button"
                    onClick={selectDirectory}
                    class={cn(
                      'px-4 py-2 rounded-lg transition-colors flex items-center space-x-2',
                      getThemeComponentClasses({
                        variant: 'muted',
                        interactive: true,
                      })
                    )}
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
                    class={cn(
                      'w-4 h-4 rounded focus:ring-2 focus:ring-accent',
                      'bg-muted border text-accent'
                    )}
                  />
                  <span class={cn('text-sm', getTextClasses('secondary'))}>
                    Include subdirectories
                  </span>
                </label>

                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={true}
                    class={cn(
                      'w-4 h-4 rounded focus:ring-2 focus:ring-accent',
                      'bg-muted border text-accent'
                    )}
                  />
                  <span class={cn('text-sm', getTextClasses('secondary'))}>
                    Auto-match with AniDB
                  </span>
                </label>

                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={true}
                    class={cn(
                      'w-4 h-4 rounded focus:ring-2 focus:ring-accent',
                      'bg-muted border text-accent'
                    )}
                  />
                  <span class={cn('text-sm', getTextClasses('secondary'))}>
                    Generate thumbnails
                  </span>
                </label>

                <label class="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={false}
                    class={cn(
                      'w-4 h-4 rounded focus:ring-2 focus:ring-accent',
                      'bg-muted border text-accent'
                    )}
                  />
                  <span class={cn('text-sm', getTextClasses('secondary'))}>
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
                  <MotionCard
                    variant="compact"
                    clickable={true}
                    onClick={stopScan}
                    animateOnScroll={false}
                    {...buttonHandlers}
                    style={getButtonStyles()}
                    class={cn(
                      'px-6 py-2 flex items-center space-x-2',
                      getStatusClasses('error', 'bg'),
                      getStatusClasses('error', 'text'),
                      'hover:opacity-80'
                    )}
                  >
                    <Pause class="w-4 h-4" />
                    <span>Stop Scan</span>
                  </MotionCard>
                }
              >
                <MotionCard
                  variant="compact"
                  clickable={true}
                  onClick={startScan}
                  disabled={!selectedDirectory()}
                  animateOnScroll={false}
                  {...buttonHandlers}
                  style={getButtonStyles()}
                  class={cn(
                    'px-6 py-2 flex items-center space-x-2',
                    'bg-accent text-accent-foreground hover:bg-accent-hover',
                    'disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed'
                  )}
                >
                  <Play class="w-4 h-4" />
                  <span>Start Scan</span>
                </MotionCard>
              </Show>

              <MotionCard
                variant="compact"
                clickable={true}
                onClick={() => console.log('Open settings')}
                animateOnScroll={false}
                {...buttonHandlers}
                style={getButtonStyles()}
                class={cn(
                  'px-6 py-2 flex items-center space-x-2',
                  getThemeComponentClasses({
                    variant: 'muted',
                    interactive: true,
                  })
                )}
              >
                <Settings class="w-4 h-4" />
                <span>Settings</span>
              </MotionCard>
            </div>
          </MotionCard>
        </div>

        {/* Progress */}
        <Show when={isScanning() || scanStatus() === 'completed'}>
          <MotionCard
            ref={progressRef}
            style={getProgressStyles()}
            variant="standard"
            animateOnScroll={false}
          >
            <div class="flex items-center justify-between mb-4">
              <h2
                class={cn(
                  'text-lg font-semibold mb-4',
                  getTextClasses('primary')
                )}
              >
                Scan Progress
              </h2>
              <div class={cn('flex items-center space-x-2', getStatusColor())}>
                <StatusIcon class="w-5 h-5" />
                <span class="capitalize">{scanStatus()}</span>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <div class="flex justify-between text-sm mb-2">
                  <span class={getTextClasses('tertiary')}>Progress</span>
                  <span class={getTextClasses('primary')}>
                    {Math.round(scanProgress())}%
                  </span>
                </div>
                <div class={cn('w-full rounded-full h-2', 'bg-muted')}>
                  <div
                    class={cn(
                      'h-2 rounded-full transition-all duration-300',
                      'bg-accent'
                    )}
                    style={{ width: `${scanProgress()}%` }}
                  />
                </div>
              </div>

              <MotionGrid
                columns="grid-cols-2 md:grid-cols-4"
                gap="1rem"
                stagger={100}
                variant="scale"
                direction="up"
              >
                <MotionCard
                  variant="compact"
                  animateOnScroll={false}
                  class="text-center p-4"
                >
                  <p
                    class={cn('text-2xl font-bold', getTextClasses('primary'))}
                  >
                    {scanResults().total}
                  </p>
                  <p class={cn('text-sm', getTextClasses('tertiary'))}>
                    Total Files
                  </p>
                </MotionCard>
                <MotionCard
                  variant="compact"
                  animateOnScroll={false}
                  class="text-center p-4"
                >
                  <p
                    class={cn('text-2xl font-bold', getTextClasses('primary'))}
                  >
                    {scanResults().processed}
                  </p>
                  <p class={cn('text-sm', getTextClasses('tertiary'))}>
                    Processed
                  </p>
                </MotionCard>
                <MotionCard
                  variant="compact"
                  animateOnScroll={false}
                  class="text-center p-4"
                >
                  <p
                    class={cn(
                      'text-2xl font-bold',
                      getStatusClasses('success', 'text')
                    )}
                  >
                    {scanResults().added}
                  </p>
                  <p class={cn('text-sm', getTextClasses('tertiary'))}>Added</p>
                </MotionCard>
                <MotionCard
                  variant="compact"
                  animateOnScroll={false}
                  class="text-center p-4"
                >
                  <p
                    class={cn(
                      'text-2xl font-bold',
                      getStatusClasses('info', 'text')
                    )}
                  >
                    {scanResults().updated}
                  </p>
                  <p class={cn('text-sm', getTextClasses('tertiary'))}>
                    Updated
                  </p>
                </MotionCard>
              </MotionGrid>
            </div>
          </MotionCard>
        </Show>
      </div>

      {/* Sidebar */}
      <div ref={sidebarRef} style={getSidebarStyles()} class="space-y-6">
        {/* Quick Stats */}
        <MotionCard variant="standard" animateOnScroll={true}>
          <h2
            class={cn('text-lg font-semibold mb-4', getTextClasses('primary'))}
          >
            Quick Stats
          </h2>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class={cn('text-sm', getTextClasses('tertiary'))}>
                Anime in collection
              </span>
              <span class={cn('font-medium', getTextClasses('primary'))}>
                {appState.animeList.length}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class={cn('text-sm', getTextClasses('tertiary'))}>
                Total episodes
              </span>
              <span class={cn('font-medium', getTextClasses('primary'))}>
                {appState.episodes.length}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class={cn('text-sm', getTextClasses('tertiary'))}>
                Media files
              </span>
              <span class={cn('font-medium', getTextClasses('primary'))}>
                {appState.mediaFiles.length}
              </span>
            </div>
          </div>
        </MotionCard>

        {/* Supported Formats */}
        <MotionCard variant="standard" animateOnScroll={true}>
          <h2
            class={cn('text-lg font-semibold mb-4', getTextClasses('primary'))}
          >
            Supported Formats
          </h2>
          <div class="space-y-3">
            <div>
              <div class="flex items-center space-x-2 mb-2">
                <FileVideo class={cn('w-4 h-4', getTextClasses('tertiary'))} />
                <span
                  class={cn('text-sm font-medium', getTextClasses('primary'))}
                >
                  Video
                </span>
              </div>
              <div class={cn('text-xs space-y-1', getTextClasses('tertiary'))}>
                <div>MP4, MKV, AVI, MOV</div>
                <div>WMV, FLV, WebM, M4V</div>
              </div>
            </div>

            <div>
              <div class="flex items-center space-x-2 mb-2">
                <div class={cn('w-4 h-4 rounded', 'bg-muted')}></div>
                <span
                  class={cn('text-sm font-medium', getTextClasses('primary'))}
                >
                  Subtitles
                </span>
              </div>
              <div class={cn('text-xs space-y-1', getTextClasses('tertiary'))}>
                <div>SRT, ASS, SSA, VTT</div>
                <div>SUB, IDX</div>
              </div>
            </div>
          </div>
        </MotionCard>
      </div>
    </div>
  )
}
