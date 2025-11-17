/**
 * TypeScript types for Motion animations in Kogoro
 * Provides comprehensive type safety for animation variants, configurations, and utilities
 */

import type { ThemeColor, SemanticColorType } from '../lib/theme-constants'
import type { Accessor } from 'solid-js'
import type { JSX } from 'solid-js'

/**
 * Animation duration presets
 */
export type MotionDuration = 'fast' | 'normal' | 'slow' | 'instant'

/**
 * Animation easing functions
 */
export type MotionEasing =
  | 'ease'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounce'
  | 'linear'

/**
 * Animation delay presets
 */
export type MotionDelay = 'none' | 'short' | 'normal' | 'long'

/**
 * Animation direction options
 */
export type AnimationDirection = 'normal' | 'reverse' | 'alternate'

/**
 * Animation fill mode options
 */
export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both'

/**
 * Animation play state
 */
export type AnimationPlayState = 'running' | 'paused'

/**
 * Animation iteration count
 */
export type AnimationIterationCount = number | 'infinite'

/**
 * Transform property types
 */
export interface TransformProperties {
  /** X-axis translation */
  translateX?: string | number
  /** Y-axis translation */
  translateY?: string | number
  /** Z-axis translation */
  translateZ?: string | number
  /** Scale transformation */
  scale?: string | number
  /** X-axis scale */
  scaleX?: string | number
  /** Y-axis scale */
  scaleY?: string | number
  /** Z-axis scale */
  scaleZ?: string | number
  /** Rotation around X-axis */
  rotateX?: string | number
  /** Rotation around Y-axis */
  rotateY?: string | number
  /** Rotation around Z-axis */
  rotateZ?: string | number
  /** Skew X-axis */
  skewX?: string | number
  /** Skew Y-axis */
  skewY?: string | number
}

/**
 * CSS properties that can be animated
 */
export interface AnimatableProperties {
  /** Opacity */
  opacity?: number
  /** Visibility */
  visibility?: 'visible' | 'hidden'
  /** Display */
  display?: string
  /** Transform properties */
  transform?: string
  /** Filter effects */
  filter?: string
  /** Brightness */
  brightness?: string | number
  /** Contrast */
  contrast?: string | number
  /** Blur */
  blur?: string | number
  /** Background color */
  backgroundColor?: string
  /** Color */
  color?: string
  /** Border color */
  borderColor?: string
  /** Width */
  width?: string | number
  /** Height */
  height?: string | number
  /** Margin */
  margin?: string | number
  /** Margin top */
  marginTop?: string | number
  /** Margin right */
  marginRight?: string | number
  /** Margin bottom */
  marginBottom?: string | number
  /** Margin left */
  marginLeft?: string | number
  /** Padding */
  padding?: string | number
  /** Padding top */
  paddingTop?: string | number
  /** Padding right */
  paddingRight?: string | number
  /** Padding bottom */
  paddingBottom?: string | number
  /** Padding left */
  paddingLeft?: string | number
  /** Border radius */
  borderRadius?: string | number
  /** Box shadow */
  boxShadow?: string
  /** Flex grow */
  flexGrow?: number
  /** Flex shrink */
  flexShrink?: number
  /** Flex basis */
  flexBasis?: string | number
  /** Grid column */
  gridColumn?: string
  /** Grid row */
  gridRow?: string
  /** Z-index */
  zIndex?: number
  /** Position */
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'
  /** Top */
  top?: string | number
  /** Right */
  right?: string | number
  /** Bottom */
  bottom?: string | number
  /** Left */
  left?: string | number
}

/**
 * Animation variant definition
 */
export interface AnimationVariant {
  /** Initial state properties */
  initial?: Partial<AnimatableProperties & TransformProperties>
  /** Animated state properties */
  animate?: Partial<AnimatableProperties & TransformProperties>
  /** Exit state properties */
  exit?: Partial<AnimatableProperties & TransformProperties>
  /** Hover state properties */
  hover?: Partial<AnimatableProperties & TransformProperties>
  /** Focus state properties */
  focus?: Partial<AnimatableProperties & TransformProperties>
  /** Active state properties */
  active?: Partial<AnimatableProperties & TransformProperties>
  /** Disabled state properties */
  disabled?: Partial<AnimatableProperties & TransformProperties>
}

/**
 * Animation transition configuration
 */
export interface AnimationTransition {
  /** Duration in seconds */
  duration?: number
  /** Delay in seconds */
  delay?: number
  /** Easing function */
  easing?: string | MotionEasing
  /** Animation direction */
  direction?: AnimationDirection
  /** Fill mode */
  fillMode?: AnimationFillMode
  /** Play state */
  playState?: AnimationPlayState
  /** Iteration count */
  repeat?: AnimationIterationCount
  /** Whether to reverse animation on repeat */
  reverse?: boolean
  /** Properties to transition (comma-separated) */
  properties?: string[]
}

/**
 * Complete animation preset
 */
export interface MotionPreset extends AnimationVariant {
  /** Transition configuration */
  transition?: AnimationTransition
}

/**
 * Theme-aware animation variant
 */
export interface ThemeMotionVariant {
  /** Light theme variant */
  light: MotionPreset
  /** Dark theme variant */
  dark: MotionPreset
}

/**
 * Motion state interface
 */
export interface MotionState {
  /** Whether reduced motion is preferred */
  reducedMotion: boolean
  /** Whether animations are enabled */
  enabled: boolean
}

/**
 * Motion hook return type
 */
export interface MotionHook {
  /** Current motion state */
  state: MotionState
  /** Check if motion is enabled */
  isEnabled: () => boolean
  /** Get animation duration */
  getDuration: (duration: MotionDuration) => number
  /** Get easing function */
  getEasing: (easing: MotionEasing) => string
  /** Get animation delay */
  getDelay: (delay: MotionDelay) => number
  /** Available presets */
  presets: Record<string, MotionPreset>
  /** Theme variants */
  variants: Record<string, ThemeMotionVariant>
  /** CSS utilities */
  css: MotionCSSUtils
  /** Keyframes */
  keyframes: Record<string, KeyframeDefinition>
}

/**
 * CSS-in-JS animation utilities
 */
export interface MotionCSSUtils {
  /** Generate CSS transition string */
  transition: (
    properties: string[],
    duration?: MotionDuration,
    easing?: MotionEasing
  ) => string
  /** Generate CSS animation string */
  animation: (
    name: string,
    duration?: MotionDuration,
    easing?: MotionEasing,
    delay?: MotionDelay,
    count?: AnimationIterationCount,
    direction?: AnimationDirection
  ) => string
  /** Generate CSS keyframes */
  keyframes: (frames: Record<string, Record<string, string | number>>) => string
}

/**
 * Keyframe definition
 */
export interface KeyframeDefinition {
  [offset: string]: Record<string, string | number>
}

/**
 * Component props for animated components
 */
export interface MotionComponentProps {
  /** Animation preset to use */
  preset?: string
  /** Custom animation variant */
  variant?: AnimationVariant
  /** Whether to animate on mount */
  animate?: boolean
  /** Animation duration */
  duration?: MotionDuration
  /** Animation delay */
  delay?: MotionDelay
  /** Animation easing */
  easing?: MotionEasing
  /** Whether to respect reduced motion */
  respectReducedMotion?: boolean
  /** Custom CSS classes */
  class?: string
  /** Children elements */
  children?: JSX.Element
  /** Event handlers */
  onAnimationStart?: () => void
  onAnimationEnd?: () => void
  onAnimationIteration?: () => void
}

/**
 * Theme-aware motion component props
 */
export interface ThemeMotionComponentProps extends MotionComponentProps {
  /** Theme variant to use */
  themeVariant?: 'light' | 'dark' | 'auto'
  /** Semantic color type for theme integration */
  semanticColor?: SemanticColorType
  /** Theme color integration */
  themeColor?: ThemeColor
}

/**
 * List item animation props
 */
export interface ListItemMotionProps extends MotionComponentProps {
  /** Item index in list */
  index?: number
  /** Stagger delay between items */
  staggerDelay?: number
  /** List direction */
  direction?: 'vertical' | 'horizontal'
}

/**
 * Grid item animation props
 */
export interface GridItemMotionProps extends MotionComponentProps {
  /** Item column index */
  columnIndex?: number
  /** Item row index */
  rowIndex?: number
  /** Grid columns count */
  columns?: number
  /** Stagger delay between items */
  staggerDelay?: number
}

/**
 * Modal animation props
 */
export interface ModalMotionProps {
  /** Overlay animation preset */
  overlay?: MotionPreset
  /** Content animation preset */
  content?: MotionPreset
  /** Whether modal is open */
  isOpen: boolean
  /** Close on overlay click */
  closeOnOverlayClick?: boolean
  /** Close on escape key */
  closeOnEscape?: boolean
  /** On close callback */
  onClose?: () => void
}

/**
 * Sidebar animation props
 */
export interface SidebarMotionProps extends MotionComponentProps {
  /** Whether sidebar is open */
  isOpen: boolean
  /** Sidebar position */
  position?: 'left' | 'right'
  /** Sidebar width */
  width?: string | number
  /** Overlay visibility */
  showOverlay?: boolean
  /** On toggle callback */
  onToggle?: (isOpen: boolean) => void
}

/**
 * Loading animation props
 */
export interface LoadingMotionProps extends MotionComponentProps {
  /** Loading state */
  isLoading: boolean
  /** Loading type */
  type?: 'spinner' | 'pulse' | 'dots' | 'skeleton'
  /** Loading size */
  size?: 'small' | 'medium' | 'large'
  /** Loading text */
  text?: string
}

/**
 * Animation event types
 */
export interface AnimationEvents {
  /** Animation start event */
  start: () => void
  /** Animation end event */
  end: () => void
  /** Animation iteration event */
  iteration: () => void
  /** Animation cancel event */
  cancel: () => void
}

/**
 * Reduced motion preference types
 */
export interface ReducedMotionPreference {
  /** Whether reduced motion is preferred */
  prefersReduced: Accessor<boolean>
  /** Media query match state */
  mediaQuery: Accessor<MediaQueryList | null>
  /** Watch callback */
  watch: (callback: (prefersReduced: boolean) => void) => () => void
  /** Whether animations should be enabled */
  shouldAnimate: () => boolean
}

/**
 * Animation configuration builder
 */
export interface AnimationConfigBuilder {
  /** Set initial properties */
  initial: (
    props: Partial<AnimatableProperties & TransformProperties>
  ) => AnimationConfigBuilder
  /** Set animate properties */
  animate: (
    props: Partial<AnimatableProperties & TransformProperties>
  ) => AnimationConfigBuilder
  /** Set exit properties */
  exit: (
    props: Partial<AnimatableProperties & TransformProperties>
  ) => AnimationConfigBuilder
  /** Set transition configuration */
  transition: (config: AnimationTransition) => AnimationConfigBuilder
  /** Build the final preset */
  build: () => MotionPreset
}

/**
 * Motion utility functions
 */
export interface MotionUtils {
  /** Create custom animation preset */
  createPreset: (config: Partial<MotionPreset>) => MotionPreset
  /** Get theme-aware animation */
  getThemeVariant: (theme: 'light' | 'dark', variant: string) => MotionPreset
  /** Check if animation is supported */
  isSupported: (property: string) => boolean
  /** Get optimal animation duration */
  getOptimalDuration: (
    complexity: 'simple' | 'medium' | 'complex'
  ) => MotionDuration
}

/**
 * Animation performance metrics
 */
export interface AnimationPerformance {
  /** Animation start timestamp */
  startTime: number
  /** Animation end timestamp */
  endTime: number
  /** Total duration */
  duration: number
  /** Frame rate */
  frameRate: number
  /** Number of frames */
  frameCount: number
  /** Whether animation was smooth */
  isSmooth: boolean
}

/**
 * Motion debug information
 */
export interface MotionDebugInfo {
  /** Current motion state */
  state: MotionState
  /** Active animations */
  activeAnimations: string[]
  /** Performance metrics */
  performance: AnimationPerformance[]
  /** Debug mode enabled */
  debugMode: boolean
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Preset names for type safety
 */
export type MotionPresetName =
  | 'fadeIn'
  | 'fadeOut'
  | 'slideInRight'
  | 'slideInLeft'
  | 'slideInUp'
  | 'slideInDown'
  | 'scaleIn'
  | 'scaleOut'
  | 'bounceIn'
  | 'themeTransition'
  | 'listItem'
  | 'gridItem'
  | 'modalOverlay'
  | 'modalContent'
  | 'sidebar'
  | 'pulse'
  | 'spin'

/**
 * Theme motion variant names
 */
export type ThemeMotionVariantName = 'subtle' | 'vibrant'

/**
 * Keyframe animation names
 */
export type KeyframeAnimationName =
  | 'fadeIn'
  | 'fadeOut'
  | 'slideInRight'
  | 'slideInLeft'
  | 'slideInUp'
  | 'slideInDown'
  | 'scaleIn'
  | 'bounce'
  | 'pulse'
  | 'spin'
