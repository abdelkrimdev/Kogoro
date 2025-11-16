import { type Component, Show } from 'solid-js'
import { Loader } from 'lucide-solid'
import { cn } from '../../lib/class-utils'
import { getStatusClasses } from '../../lib/theme-helpers'
import { getBackgroundClasses, getTextClasses } from '../../lib/theme-classes'

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
            data-testid="loading-spinner"
            class={cn(
              sizeClasses[props.size || 'md'],
              'animate-spin',
              getStatusClasses('info', 'text')
            )}
          />
          <Show when={props.text}>
            <span
              class={cn(
                textSizeClasses[props.size || 'md'],
                getTextClasses('secondary')
              )}
            >
              {props.text}
            </span>
          </Show>
        </div>
      }
    >
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div
          class={cn(
            'rounded-lg p-6 flex flex-col items-center space-y-3',
            getBackgroundClasses('primary')
          )}
        >
          <Loader
            class={cn(
              sizeClasses[props.size || 'md'],
              'animate-spin',
              getStatusClasses('info', 'text')
            )}
          />
          <Show when={props.text}>
            <span
              class={cn(
                textSizeClasses[props.size || 'md'],
                getTextClasses('primary')
              )}
            >
              {props.text}
            </span>
          </Show>
        </div>
      </div>
    </Show>
  )
}
