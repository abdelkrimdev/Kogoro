import { type Component, Show } from 'solid-js'
import { Loader } from 'lucide-solid'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  overlay?: boolean
}

export const Loading: Component<LoadingProps> = (props) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  return (
    <Show
      when={props.overlay}
      fallback={
        <div class="flex flex-col items-center justify-center space-y-2">
          <Loader
            class={`${sizeClasses[props.size || 'md']} animate-spin text-blue-600 dark:text-blue-400`}
          />
          <Show when={props.text}>
            <span
              class={`${textSizeClasses[props.size || 'md']} text-gray-600 dark:text-gray-400`}
            >
              {props.text}
            </span>
          </Show>
        </div>
      }
    >
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex flex-col items-center space-y-3">
          <Loader
            class={`${sizeClasses[props.size || 'md']} animate-spin text-blue-600 dark:text-blue-400`}
          />
          <Show when={props.text}>
            <span
              class={`${textSizeClasses[props.size || 'md']} text-gray-900 dark:text-white`}
            >
              {props.text}
            </span>
          </Show>
        </div>
      </div>
    </Show>
  )
}
