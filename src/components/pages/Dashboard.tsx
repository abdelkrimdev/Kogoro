import { type Component, For, Show } from 'solid-js'
import {
  Play as PlayCircle,
  Star,
  FolderOpen,
  Video as FileVideo,
  Download,
  Activity,
} from 'lucide-solid'
import { appState } from '../../lib/store'
import {
  cn,
  getThemeComponentClasses,
  getStatusClasses,
  getTextClasses,
  getBackgroundClasses,
  getBorderClasses,
} from '../../lib/utils'

export const Dashboard: Component = () => {
  // Mock data for demonstration
  const stats = [
    {
      label: 'Total Anime',
      value: appState.animeList.length.toString(),
      icon: FolderOpen,
      color: 'blue',
      change: '+2 this week',
    },
    {
      label: 'Episodes',
      value: appState.episodes.length.toString(),
      icon: FileVideo,
      color: 'green',
      change: '+12 this week',
    },
    {
      label: 'Watched',
      value: appState.episodes.filter((e) => e.watched).length.toString(),
      icon: PlayCircle,
      color: 'purple',
      change: '+5 this week',
    },
    {
      label: 'Favorites',
      value: appState.animeList.filter((a) => a.favorite).length.toString(),
      icon: Star,
      color: 'yellow',
      change: '+1 this week',
    },
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'watched',
      title: 'Attack on Titan - Episode 87',
      time: '2 hours ago',
      icon: PlayCircle,
    },
    {
      id: 2,
      type: 'added',
      title: 'Demon Slayer Season 3',
      time: '5 hours ago',
      icon: Download,
    },
    {
      id: 3,
      type: 'scanned',
      title: 'My Hero Academia',
      time: '1 day ago',
      icon: Activity,
    },
  ]

  const continueWatching = [
    {
      id: 1,
      title: 'Attack on Titan',
      episode: 'Episode 87',
      progress: 85,
      image: '/api/placeholder/300/169',
    },
    {
      id: 2,
      title: 'Demon Slayer',
      episode: 'Episode 11',
      progress: 60,
      image: '/api/placeholder/300/169',
    },
    {
      id: 3,
      title: 'My Hero Academia',
      episode: 'Episode 24',
      progress: 30,
      image: '/api/placeholder/300/169',
    },
  ]

  const getStatColor = (color: string) => {
    const colorMap = {
      blue: 'info',
      green: 'success',
      purple: 'info',
      yellow: 'warning',
    }
    const semanticColor = colorMap[color as keyof typeof colorMap] || 'info'
    return getStatusClasses(semanticColor, 'bg')
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div>
        <h1 class={cn('text-3xl font-bold', getTextClasses('primary'))}>
          Dashboard
        </h1>
        <p class={cn('mt-2', getTextClasses('secondary'))}>
          Welcome back! Here's what's happening with your anime collection.
        </p>
      </div>

      {/* Stats Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <For each={stats}>
          {(stat) => {
            const Icon = stat.icon
            return (
              <div
                class={getThemeComponentClasses({
                  variant: 'default',
                  interactive: false,
                })}
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p
                      class={cn(
                        'text-sm font-medium',
                        getTextClasses('secondary')
                      )}
                    >
                      {stat.label}
                    </p>
                    <p
                      class={cn(
                        'text-2xl font-bold mt-1',
                        getTextClasses('primary')
                      )}
                    >
                      {stat.value}
                    </p>
                    <p class={cn('text-xs mt-2', getTextClasses('tertiary'))}>
                      {stat.change}
                    </p>
                  </div>
                  <div class={cn('p-3 rounded-lg', getStatColor(stat.color))}>
                    <Icon class="w-6 h-6" />
                  </div>
                </div>
              </div>
            )
          }}
        </For>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continue Watching */}
        <div class="lg:col-span-2">
          <div
            class={getThemeComponentClasses({
              variant: 'default',
              interactive: false,
            })}
          >
            <div class={cn('p-6 border-b', getBorderClasses('primary'))}>
              <h2
                class={cn('text-lg font-semibold', getTextClasses('primary'))}
              >
                Continue Watching
              </h2>
            </div>
            <div class="p-6">
              <Show
                when={continueWatching.length > 0}
                fallback={
                  <div class="text-center py-12">
                    <PlayCircle
                      class={cn(
                        'w-12 h-12 mx-auto mb-4',
                        getTextClasses('tertiary')
                      )}
                    />
                    <p class={getTextClasses('secondary')}>
                      Nothing to continue watching yet
                    </p>
                  </div>
                }
              >
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <For each={continueWatching}>
                    {(item) => (
                      <div class="group cursor-pointer">
                        <div class="relative rounded-lg overflow-hidden mb-3">
                          <img
                            src={item.image}
                            alt={item.title}
                            class="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-300 flex items-center justify-center">
                            <PlayCircle class="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                          <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75">
                            <div
                              class={cn('h-1', getBorderClasses('secondary'))}
                            >
                              <div
                                class="h-full bg-accent transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <h3
                          class={cn(
                            'font-medium group-hover:text-accent transition-colors',
                            getTextClasses('primary')
                          )}
                        >
                          {item.title}
                        </h3>
                        <p class={cn('text-sm', getTextClasses('secondary'))}>
                          {item.episode}
                        </p>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div class="lg:col-span-1">
          <div
            class={getThemeComponentClasses({
              variant: 'default',
              interactive: false,
            })}
          >
            <div class={cn('p-6 border-b', getBorderClasses('primary'))}>
              <h2
                class={cn('text-lg font-semibold', getTextClasses('primary'))}
              >
                Recent Activity
              </h2>
            </div>
            <div class="p-6">
              <div class="space-y-4">
                <For each={recentActivity}>
                  {(activity) => {
                    const Icon = activity.icon
                    return (
                      <div class="flex items-start space-x-3">
                        <div
                          class={cn(
                            'p-2 rounded-lg',
                            getBackgroundClasses('secondary')
                          )}
                        >
                          <Icon
                            class={cn('w-4 h-4', getTextClasses('secondary'))}
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <p
                            class={cn(
                              'text-sm font-medium truncate',
                              getTextClasses('primary')
                            )}
                          >
                            {activity.title}
                          </p>
                          <p class={cn('text-xs', getTextClasses('tertiary'))}>
                            {activity.time}
                          </p>
                        </div>
                      </div>
                    )
                  }}
                </For>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
