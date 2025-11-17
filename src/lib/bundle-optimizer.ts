/**
 * Bundle size optimization utilities for Motion features
 * Provides tree-shaking friendly exports and chunk splitting
 * Analyzes and optimizes bundle impact
 */

import type { MotionFeature } from './lazy-motion'

// ============================================================================
// BUNDLE ANALYSIS
// ============================================================================

export interface BundleChunk {
  name: string
  size: number
  gzippedSize: number
  modules: string[]
  features: MotionFeature[]
}

export interface BundleAnalysis {
  totalSize: number
  gzippedSize: number
  chunks: BundleChunk[]
  motionImpact: {
    size: number
    gzippedSize: number
    percentage: number
    features: MotionFeature[]
  }
  recommendations: BundleOptimization[]
}

export interface BundleOptimization {
  type: 'treeshaking' | 'codesplitting' | 'lazyloading' | 'minification'
  impact: 'low' | 'medium' | 'high'
  description: string
  action: string
  estimatedSavings: number
}

// ============================================================================
// FEATURE SIZES (estimated)
// ============================================================================

const FEATURE_SIZES: Record<MotionFeature, { size: number; gzipped: number }> =
  {
    animations: { size: 15000, gzipped: 4500 },
    variants: { size: 20000, gzipped: 6000 },
    transitions: { size: 7000, gzipped: 2100 },
    performance: { size: 8000, gzipped: 2400 },
  }

// ============================================================================
// BUNDLE ANALYZER
// ============================================================================

export class BundleAnalyzer {
  private chunks: BundleChunk[] = []
  private loadedFeatures: Set<MotionFeature> = new Set()

  constructor(initialFeatures: MotionFeature[] = []) {
    this.loadedFeatures = new Set(initialFeatures)
    this.initializeChunks()
  }

  private initializeChunks() {
    // Simulate chunk analysis based on loaded features
    this.chunks = [
      {
        name: 'motion-core',
        size: 25000,
        gzippedSize: 7500,
        modules: ['motion', 'utils', 'types'],
        features: ['animations'],
      },
      {
        name: 'motion-variants',
        size: 20000,
        gzippedSize: 6000,
        modules: ['motion-variants', 'presets'],
        features: ['variants'],
      },
      {
        name: 'motion-transitions',
        size: 7000,
        gzippedSize: 2100,
        modules: ['motion-theme', 'transitions'],
        features: ['transitions'],
      },
      {
        name: 'motion-performance',
        size: 8000,
        gzippedSize: 2400,
        modules: ['performance-monitor', 'benchmark'],
        features: ['performance'],
      },
    ]
  }

  /**
   * Analyze current bundle state
   */
  analyze(): BundleAnalysis {
    const totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.size, 0)
    const gzippedSize = this.chunks.reduce(
      (sum, chunk) => sum + chunk.gzippedSize,
      0
    )

    const motionChunks = this.chunks.filter((chunk) =>
      chunk.features.some((feature) => this.loadedFeatures.has(feature))
    )

    const motionSize = motionChunks.reduce((sum, chunk) => sum + chunk.size, 0)
    const motionGzipped = motionChunks.reduce(
      (sum, chunk) => sum + chunk.gzippedSize,
      0
    )

    return {
      totalSize,
      gzippedSize,
      chunks: this.chunks,
      motionImpact: {
        size: motionSize,
        gzippedSize: motionGzipped,
        percentage: totalSize > 0 ? (motionSize / totalSize) * 100 : 0,
        features: Array.from(this.loadedFeatures),
      },
      recommendations: this.generateRecommendations(),
    }
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): BundleOptimization[] {
    const recommendations: BundleOptimization[] = []
    const analysis = this.analyze()

    // Tree shaking recommendations
    if (analysis.motionImpact.percentage > 30) {
      recommendations.push({
        type: 'treeshaking',
        impact: 'high',
        description:
          'Motion features constitute a large portion of your bundle',
        action:
          'Use specific imports instead of importing entire motion library',
        estimatedSavings: Math.floor(analysis.motionImpact.size * 0.4),
      })
    }

    // Code splitting recommendations
    if (this.loadedFeatures.size > 2) {
      recommendations.push({
        type: 'codesplitting',
        impact: 'medium',
        description: 'Multiple motion features detected in main bundle',
        action: 'Implement code splitting for motion features',
        estimatedSavings: Math.floor(analysis.motionImpact.size * 0.3),
      })
    }

    // Lazy loading recommendations
    if (
      this.loadedFeatures.has('variants') &&
      this.loadedFeatures.has('transitions')
    ) {
      recommendations.push({
        type: 'lazyloading',
        impact: 'medium',
        description: 'Heavy motion features loaded eagerly',
        action: 'Lazy load variants and transitions on user interaction',
        estimatedSavings: Math.floor(analysis.motionImpact.size * 0.5),
      })
    }

    return recommendations
  }

  /**
   * Add feature to analysis
   */
  addFeature(feature: MotionFeature) {
    this.loadedFeatures.add(feature)
  }

  /**
   * Remove feature from analysis
   */
  removeFeature(feature: MotionFeature) {
    this.loadedFeatures.delete(feature)
  }

  /**
   * Get estimated size for features
   */
  getEstimatedSize(features: MotionFeature[]): {
    size: number
    gzipped: number
  } {
    return features.reduce(
      (total, feature) => {
        const featureSize = FEATURE_SIZES[feature]
        return {
          size: total.size + featureSize.size,
          gzipped: total.gzipped + featureSize.gzipped,
        }
      },
      { size: 0, gzipped: 0 }
    )
  }
}

// ============================================================================
// TREE-SHAKING UTILITIES
// ============================================================================

/**
 * Create tree-shaking friendly motion exports
 */
export function createTreeShakableMotion(features: MotionFeature[]) {
  const featureSet = new Set(features)

  return {
    // Only export requested features
    animations: featureSet.has('animations')
      ? () =>
          import('./motion').then((m) => ({
            presets: m.MOTION_PRESETS,
            css: m.MOTION_CSS,
          }))
      : null,

    variants: featureSet.has('variants')
      ? () => import('./motion-variants').then((m) => m.MOTION_VARIANTS)
      : null,

    transitions: featureSet.has('transitions')
      ? () =>
          import('./motion-theme').then((m) => ({
            createThemeTransition: m.createThemeTransition,
          }))
      : null,

    performance: featureSet.has('performance')
      ? () =>
          import('./performance-monitor').then((m) => ({
            usePerformanceMonitor: m.usePerformanceMonitor,
          }))
      : null,
  }
}

/**
 * Minimal motion exports for essential use cases
 */
export const minimalMotion = {
  // Core animation utilities only
  fadeIn: () => import('./motion').then((m) => m.MOTION_PRESETS.fadeIn),
  slideUp: () => import('./motion').then((m) => m.MOTION_PRESETS.slideInUp),
  scaleIn: () => import('./motion').then((m) => m.MOTION_PRESETS.scaleIn),

  // Essential CSS utilities
  transition: (properties: string[], duration = 'normal', easing = 'easeOut') =>
    import('./motion').then((m) =>
      m.MOTION_CSS.transition(properties, duration, easing)
    ),
}

/**
 * Advanced motion exports for power users
 */
export const advancedMotion = {
  // All features
  ...createTreeShakableMotion([
    'animations',
    'variants',
    'transitions',
    'performance',
  ]),

  // Advanced utilities
  bundleAnalyzer: () => new BundleAnalyzer(),
  lazyLoader: (features: MotionFeature[]) =>
    import('./lazy-motion').then((m) => m.useLazyMotion({ features })),
}

// ============================================================================
// CHUNK SPLITTING CONFIGURATION
// ============================================================================

export interface ChunkConfig {
  name: string
  features: MotionFeature[]
  priority: 'high' | 'medium' | 'low'
  preload: boolean
  prefetch: boolean
}

/**
 * Recommended chunk splitting configuration
 */
export const recommendedChunks: ChunkConfig[] = [
  {
    name: 'motion-core',
    features: ['animations'],
    priority: 'high',
    preload: true,
    prefetch: false,
  },
  {
    name: 'motion-variants',
    features: ['variants'],
    priority: 'medium',
    preload: false,
    prefetch: true,
  },
  {
    name: 'motion-advanced',
    features: ['transitions', 'performance'],
    priority: 'low',
    preload: false,
    prefetch: false,
  },
]

/**
 * Generate chunk splitting configuration for build tools
 */
export function generateChunkConfig(features: MotionFeature[]): ChunkConfig[] {
  const featureSet = new Set(features)

  return recommendedChunks
    .filter((chunk) =>
      chunk.features.some((feature) => featureSet.has(feature))
    )
    .map((chunk) => ({
      ...chunk,
      // Auto-adjust priority based on usage
      priority: features.includes('animations') ? 'high' : chunk.priority,
    }))
}

// ============================================================================
// BUNDLE SIZE MONITORING
// ============================================================================

/**
 * Monitor bundle size during development
 */
export class BundleSizeMonitor {
  private analyzer: BundleAnalyzer
  private onSizeChange?: (analysis: BundleAnalysis) => void

  constructor(
    features: MotionFeature[],
    onSizeChange?: (analysis: BundleAnalysis) => void
  ) {
    this.analyzer = new BundleAnalyzer(features)
    this.onSizeChange = onSizeChange
  }

  /**
   * Update features and notify of changes
   */
  updateFeatures(features: MotionFeature[]) {
    // Clear existing features
    this.analyzer = new BundleAnalyzer(features)

    // Notify of size change
    if (this.onSizeChange) {
      this.onSizeChange(this.analyzer.analyze())
    }
  }

  /**
   * Get current analysis
   */
  getCurrentAnalysis(): BundleAnalysis {
    return this.analyzer.analyze()
  }

  /**
   * Log bundle information in development
   */
  logBundleInfo() {
    if (!import.meta.env.DEV) return

    const analysis = this.getCurrentAnalysis()

    console.group('📦 Motion Bundle Analysis')
    console.log(`Total Size: ${(analysis.totalSize / 1024).toFixed(1)} KB`)
    console.log(`Gzipped: ${(analysis.gzippedSize / 1024).toFixed(1)} KB`)
    console.log(
      `Motion Impact: ${analysis.motionImpact.percentage.toFixed(1)}%`
    )
    console.log(`Features: ${analysis.motionImpact.features.join(', ')}`)

    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      analysis.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.description}`)
        console.log(`   Action: ${rec.action}`)
        console.log(
          `   Savings: ~${(rec.estimatedSavings / 1024).toFixed(1)} KB`
        )
      })
    }

    console.groupEnd()
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { BundleAnalyzer as default }
export { FEATURE_SIZES }
