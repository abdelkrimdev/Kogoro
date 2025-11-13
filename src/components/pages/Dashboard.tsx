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
    const colors = {
      blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
      green:
        'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
      purple:
        'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
      yellow:
        'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    }
    return colors[color as keyof typeof colors] || colors.blue
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          Welcome back! Here's what's happening with your anime collection.
        </p>
      </div>

      {/* Stats Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <For each={stats}>
          {(stat) => {
            const Icon = stat.icon
            return (
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {stat.label}
                    </p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {stat.value}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {stat.change}
                    </p>
                  </div>
                  <div class={`p-3 rounded-lg ${getStatColor(stat.color)}`}>
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
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                Continue Watching
              </h2>
            </div>
            <div class="p-6">
              <Show
                when={continueWatching.length > 0}
                fallback={
                  <div class="text-center py-12">
                    <PlayCircle class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p class="text-gray-500 dark:text-gray-400">
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
                            <div class="h-1 bg-gray-700">
                              <div
                                class="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <h3 class="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
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
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
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
                        <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <Icon class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {activity.title}
                          </p>
                          <p class="text-xs text-gray-500 dark:text-gray-400">
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
