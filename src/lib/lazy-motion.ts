/**
 * Lazy loading system for Motion features
 * Implements code splitting and dynamic imports for optimal bundle size
 */

import { createSignal, onMount, onCleanup } from 'solid-js'
import { isMotionEnabled } from './motion'

// ============================================================================
// LAZY LOADING TYPES
// ============================================================================

export interface LazyMotionConfig {
  features: MotionFeature[]
  preloadStrategy: 'none' | 'hover' | 'visible' | 'idle'
  timeout?: number
  fallback?: () => void
}

export type MotionFeature =
  | 'animations'
  | 'variants'
  | 'transitions'
  | 'performance'

export interface LoadedFeatures {
  [key: string]: unknown
}

export interface LazyMotionState {
  isLoading: boolean
  isLoaded: boolean
  error: Error | null
  loadedFeatures: Set<MotionFeature>
  progress: number
}

// ============================================================================
// FEATURE REGISTRY
// ============================================================================

interface FeatureModule {
  name: MotionFeature
  size: number // Estimated bundle size in bytes
  dependencies?: MotionFeature[]
  loader: () => Promise<unknown>
}

class MotionFeatureRegistry {
  private features = new Map<MotionFeature, FeatureModule>()
  private loadedModules = new Map<MotionFeature, unknown>()

  register(feature: FeatureModule) {
    this.features.set(feature.name, feature)
  }

  async load(feature: MotionFeature): Promise<unknown> {
    // Return cached module if already loaded
    if (this.loadedModules.has(feature)) {
      return this.loadedModules.get(feature)
    }

    const featureModule = this.features.get(feature)
    if (!featureModule) {
      throw new Error(`Motion feature "${feature}" not found`)
    }

    // Load dependencies first
    if (featureModule.dependencies) {
      await Promise.all(featureModule.dependencies.map((dep) => this.load(dep)))
    }

    // Load the feature
    try {
      const module = await featureModule.loader()
      this.loadedModules.set(feature, module)
      return module
    } catch (error) {
      console.error(`Failed to load motion feature "${feature}":`, error)
      throw error
    }
  }

  isLoaded(feature: MotionFeature): boolean {
    return this.loadedModules.has(feature)
  }

  getLoadedFeatures(): MotionFeature[] {
    return Array.from(this.loadedModules.keys())
  }

  getFeatureSize(feature: MotionFeature): number {
    return this.features.get(feature)?.size || 0
  }

  getTotalLoadedSize(): number {
    return this.getLoadedFeatures().reduce(
      (total, feature) => total + this.getFeatureSize(feature),
      0
    )
  }
}

// ============================================================================
// MOTION FEATURE DEFINITIONS
// ============================================================================

const registry = new MotionFeatureRegistry()

// Register core motion features with their loaders
registry.register({
  name: 'animations',
  size: 15000, // ~15KB
  loader: () =>
    import('./motion').then((m) => ({
      presets: m.MOTION_PRESETS,
      css: m.MOTION_CSS,
    })),
})

registry.register({
  name: 'variants',
  size: 20000, // ~20KB
  loader: () => import('./motion-variants').then((m) => m.MOTION_VARIANTS),
})

registry.register({
  name: 'transitions',
  size: 7000, // ~7KB
  dependencies: ['animations'],
  loader: () =>
    import('./motion-theme').then((m) => ({
      createThemeTransition: m.createThemeTransition,
    })),
})

registry.register({
  name: 'performance',
  size: 8000, // ~8KB
  loader: () =>
    import('./performance-monitor').then((m) => ({
      usePerformanceMonitor: m.usePerformanceMonitor,
    })),
})

// ============================================================================
// LAZY MOTION HOOK
// ============================================================================

export function useLazyMotion(_config: LazyMotionConfig) {
  const [state, setState] = createSignal<LazyMotionState>({
    isLoading: false,
    isLoaded: false,
    error: null,
    loadedFeatures: new Set(),
    progress: 0,
  })

  const [loadedModules, setLoadedModules] = createSignal<LoadedFeatures>({})

  let loadPromise: Promise<void> | null = null
  let abortController: AbortController | null = null

  const calculateProgress = (features: Set<MotionFeature>): number => {
    const totalSize = config.features.reduce(
      (total, feature) => total + registry.getFeatureSize(feature),
      0
    )
    const loadedSize = Array.from(features).reduce(
      (total, feature) => total + registry.getFeatureSize(feature),
      0
    )
    return totalSize > 0 ? (loadedSize / totalSize) * 100 : 0
  }

  const loadFeatures = async (signal?: AbortSignal): Promise<void> => {
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))

        const modules: LoadedFeatures = {}
        const loadedFeatures = new Set<MotionFeature>()

        // Load features in parallel where possible
        const loadPromises = config.features.map(async (feature) => {
          if (signal?.aborted) throw new Error('Load aborted')

          try {
            const module = await registry.load(feature)
            loadedFeatures.add(feature)
            modules[feature] = module

            // Update progress
            setState((prev) => ({
              ...prev,
              loadedFeatures: new Set([...prev.loadedFeatures, feature]),
              progress: calculateProgress(loadedFeatures),
            }))
          } catch (error) {
            console.error(`Failed to load feature "${feature}":`, error)
            // Continue loading other features even if one fails
          }
        })

        await Promise.all(loadPromises)

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isLoaded: true,
          loadedFeatures,
          progress: 100,
        }))

        setLoadedModules(modules)

        // Call fallback if provided and no features loaded
        if (loadedFeatures.size === 0 && config.fallback) {
          config.fallback()
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error as Error,
        }))
        throw error
      }
    })()

    return loadPromise
  }

  const preload = () => {
    if (!isMotionEnabled()) return

    abortController = new AbortController()
    return loadFeatures(abortController.signal)
  }

  const loadOnDemand = (feature: MotionFeature) => {
    if (!isMotionEnabled()) return Promise.resolve()

    if (registry.isLoaded(feature)) {
      return Promise.resolve(registry.load(feature))
    }

    return registry.load(feature).then((module) => {
      setState((prev) => ({
        ...prev,
        loadedFeatures: new Set([...prev.loadedFeatures, feature]),
        progress: calculateProgress(new Set([...prev.loadedFeatures, feature])),
      }))

      setLoadedModules((prev) => ({
        ...prev,
        [feature]: module,
      }))

      return module
    })
  }

  // Setup preload strategy
  onMount(() => {
    if (!isMotionEnabled()) return

    switch (config.preloadStrategy) {
      case 'idle':
        // Load when browser is idle
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => preload(), {
            timeout: config.timeout || 2000,
          })
        } else {
          setTimeout(preload, config.timeout || 2000)
        }
        break

      case 'visible': {
        // Load when page becomes visible
        const handleVisibilityChange = () => {
          if (!document.hidden) {
            preload()
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        onCleanup(() => {
          document.removeEventListener(
            'visibilitychange',
            handleVisibilityChange
          )
        })
        break
      }

      case 'hover': {
        // Load on first user interaction
        const handleUserInteraction = () => {
          preload()
          // Remove listeners after first interaction
          document.removeEventListener('mouseover', handleUserInteraction)
          document.removeEventListener('touchstart', handleUserInteraction)
        }
        document.addEventListener('mouseover', handleUserInteraction, {
          once: true,
        })
        document.addEventListener('touchstart', handleUserInteraction, {
          once: true,
        })
        break
      }

      default:
        // Only load when explicitly requested
        break
    }
  })

  onCleanup(() => {
    if (abortController) {
      abortController.abort()
    }
  })

  return {
    // State
    state,
    loadedModules,

    // Actions
    preload,
    loadOnDemand,

    // Utilities
    isFeatureLoaded: (feature: MotionFeature) =>
      state().loadedFeatures.has(feature),
    getFeature: (feature: MotionFeature) => loadedModules()[feature],
    getTotalSize: () => registry.getTotalLoadedSize(),
  }
}

// ============================================================================
// MOTION FEATURE PLACEHOLDER MODULES
// ============================================================================

// These would be the actual feature modules in a real implementation
// For now, they're placeholders to demonstrate the lazy loading system

export const createAnimationFeature = () => ({
  animate: (_element: HTMLElement, _config: unknown) => {
    // Animation implementation
    console.warn('Animation feature not yet implemented')
  },
  preset: (_name: string) => {
    // Preset implementation
    console.warn('Animation preset not yet implemented')
    return null
  },
})

export const createGestureFeature = () => ({
  onHover: (_element: HTMLElement, _callback: () => void) => {
    // Hover gesture implementation
    console.warn('Gesture feature not yet implemented')
  },
  onTap: (_element: HTMLElement, _callback: () => void) => {
    // Tap gesture implementation
    console.warn('Gesture feature not yet implemented')
  },
})

export const createDragFeature = () => ({
  draggable: (_element: HTMLElement, _config: unknown) => {
    // Drag implementation
    console.warn('Drag feature not yet implemented')
  },
})

export const createLayoutFeature = () => ({
  animateLayout: (_elements: HTMLElement[], _config: unknown) => {
    // Layout animation implementation
    console.warn('Layout feature not yet implemented')
  },
})

export const createScrollFeature = () => ({
  onScroll: (_element: HTMLElement, _callback: () => void) => {
    // Scroll animation implementation
    console.warn('Scroll feature not yet implemented')
  },
})

export const createTransitionFeature = () => ({
  transition: (_element: HTMLElement, _config: unknown) => {
    // Transition implementation
    console.warn('Transition feature not yet implemented')
  },
})

export const createPhysicsFeature = () => ({
  spring: (_config: unknown) => {
    // Spring physics implementation
    console.warn('Physics feature not yet implemented')
    return null
  },
})

// ============================================================================
// TREE SHAKING UTILITIES
// ============================================================================

export function createOptimizedMotion(features: MotionFeature[]) {
  const usedFeatures = new Set(features)

  return {
    // Only export what's actually used
    getAnimation: () => {
      if (usedFeatures.has('animations')) {
        return createAnimationFeature()
      }
      return null
    },

    getGestures: () => {
      if (usedFeatures.has('gestures')) {
        return createGestureFeature()
      }
      return null
    },

    getDrag: () => {
      if (usedFeatures.has('drag')) {
        return createDragFeature()
      }
      return null
    },

    getLayout: () => {
      if (usedFeatures.has('layout')) {
        return createLayoutFeature()
      }
      return null
    },

    getScroll: () => {
      if (usedFeatures.has('scroll')) {
        return createScrollFeature()
      }
      return null
    },

    getTransitions: () => {
      if (usedFeatures.has('transitions')) {
        return createTransitionFeature()
      }
      return null
    },

    getPhysics: () => {
      if (usedFeatures.has('physics')) {
        return createPhysicsFeature()
      }
      return null
    },
  }
}

// ============================================================================
// BUNDLE SIZE OPTIMIZATION
// ============================================================================

export interface BundleOptimization {
  originalSize: number
  optimizedSize: number
  savings: number
  savingsPercentage: number
  features: Array<{
    name: MotionFeature
    size: number
    loaded: boolean
    lazy: boolean
  }>
}

export function analyzeBundleOptimization(
  features: MotionFeature[]
): BundleOptimization {
  const totalSize = features.reduce(
    (total, feature) => total + registry.getFeatureSize(feature),
    0
  )

  const loadedSize = features
    .filter((feature) => registry.isLoaded(feature))
    .reduce((total, feature) => total + registry.getFeatureSize(feature), 0)

  const lazySize = totalSize - loadedSize

  return {
    originalSize: totalSize,
    optimizedSize: loadedSize,
    savings: lazySize,
    savingsPercentage: totalSize > 0 ? (lazySize / totalSize) * 100 : 0,
    features: features.map((feature) => ({
      name: feature,
      size: registry.getFeatureSize(feature),
      loaded: registry.isLoaded(feature),
      lazy: !registry.isLoaded(feature),
    })),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { registry as motionFeatureRegistry }
