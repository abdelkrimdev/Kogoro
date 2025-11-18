/**
 * Standardized interface patterns and types for UI components
 * Provides consistent prop patterns, documentation, and type safety across all components
 */

import type { JSX } from 'solid-js'
import type { MotionDuration } from '../../types/motion'

// ============================================================================
// BASE INTERFACE PATTERNS
// ============================================================================

/**
 * Base interface for all UI components
 * Provides common props and documentation patterns
 */
export interface BaseComponentProps {
  /** Custom CSS classes to apply to the component */
  class?: string
  /** Children elements to render */
  children?: JSX.Element
}

/**
 * Base interface for components that support animations
 */
export interface AnimatedComponentProps extends BaseComponentProps {
  /** Whether animations are enabled */
  animate?: boolean
  /** Animation duration preset */
  duration?: MotionDuration
  /** Animation delay in milliseconds */
  delay?: number
  /** Whether to respect user's reduced motion preferences */
  respectReducedMotion?: boolean
}

/**
 * Base interface for components that support different sizes
 */
export interface SizeComponentProps extends BaseComponentProps {
  /** Component size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Base interface for components that support different visual variants
 */
export interface VariantComponentProps extends BaseComponentProps {
  /** Visual variant of the component */
  variant?: string
}

/**
 * Base interface for interactive components
 */
export interface InteractiveComponentProps extends BaseComponentProps {
  /** Whether the component is disabled */
  disabled?: boolean
  /** Click event handler */
  onClick?: (event: Event | MouseEvent | KeyboardEvent) => void
  /** Keyboard event handler */
  onKeyDown?: (event: KeyboardEvent) => void
  /** Focus event handler */
  onFocus?: () => void
  /** Blur event handler */
  onBlur?: () => void
}

/**
 * Base interface for components that can be in a loading state
 */
export interface LoadingComponentProps extends BaseComponentProps {
  /** Whether the component is in a loading state */
  loading?: boolean
  /** Text to display during loading */
  loadingText?: string
}

// ============================================================================
// SPECIALIZED INTERFACES
// ============================================================================

/**
 * Interface for components with error handling
 */
export interface ErrorHandlingProps {
  /** Custom error fallback renderer */
  fallback?: (error: Error, reset: () => void) => JSX.Element
  /** Error handler callback */
  onError?: (error: Error, errorInfo?: { componentStack: string }) => void
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Delay between retry attempts in milliseconds */
  retryDelay?: number
}

/**
 * Interface for modal-like components
 */
export interface ModalLikeProps extends InteractiveComponentProps {
  /** Whether the modal is open */
  isOpen?: boolean
  /** Modal title */
  title?: string
  /** Close handler */
  onClose?: () => void
  /** Whether clicking overlay closes the modal */
  closeOnOverlayClick?: boolean
  /** Whether ESC key closes the modal */
  closeOnEscape?: boolean
  /** Whether to show close button */
  showCloseButton?: boolean
}

/**
 * Interface for sidebar-like components
 */
export interface SidebarLikeProps extends InteractiveComponentProps {
  /** Whether sidebar is open */
  isOpen?: boolean
  /** Sidebar position */
  position?: 'left' | 'right'
  /** Sidebar width variant */
  width?: 'sm' | 'md' | 'lg' | 'xl'
  /** Whether to show backdrop */
  showBackdrop?: boolean
  /** Whether clicking backdrop closes sidebar */
  closeOnBackdropClick?: boolean
  /** Close handler */
  onClose?: () => void
}

/**
 * Interface for list components
 */
export interface ListComponentProps<T = unknown> extends BaseComponentProps {
  /** Array of items to render */
  items?: T[]
  /** Custom item renderer */
  renderItem?: (item: T, index: number) => JSX.Element
  /** Stagger delay between items in milliseconds */
  staggerDelay?: number
  /** Animation variant for list items */
  animation?: 'fade' | 'slide' | 'scale'
  /** Direction for slide animations */
  direction?: 'up' | 'down' | 'left' | 'right'
  /** Whether to render as ordered list */
  ordered?: boolean
  /** CSS classes for list items */
  itemClass?: string
}

/**
 * Interface for search components
 */
export interface SearchComponentProps extends InteractiveComponentProps {
  /** Input placeholder text */
  placeholder?: string
  /** Current input value */
  value?: string
  /** Input change handler */
  onInput?: (value: string) => void
  /** Clear button handler */
  onClear?: () => void
  /** Search results */
  results?: SearchResult[]
  /** Result selection handler */
  onSelectResult?: (result: SearchResult) => void
  /** Whether to show results dropdown */
  showResults?: boolean
}

/**
 * Interface for card components
 */
export interface CardComponentProps extends InteractiveComponentProps {
  /** Card title */
  title?: string
  /** Card image URL */
  image?: string
  /** Card description */
  description?: string
  /** Additional metadata */
  metadata?: CardMetadata
  /** Whether card is clickable */
  clickable?: boolean
  /** Whether to animate on scroll */
  animateOnScroll?: boolean
}

/**
 * Interface for grid components
 */
export interface GridComponentProps extends BaseComponentProps {
  /** Number of columns */
  columns?: number | string
  /** Gap between grid items */
  gap?: string
  /** Stagger delay between items */
  stagger?: number
  /** Animation variant */
  variant?: 'fade' | 'slide' | 'scale' | 'flip'
  /** Animation direction */
  direction?: 'up' | 'down' | 'left' | 'right'
  /** Animation duration in seconds */
  duration?: number
  /** Animation delay in seconds */
  delay?: number
  /** Animation start callback */
  onAnimationStart?: () => void
  /** Animation complete callback */
  onAnimationComplete?: () => void
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Search result item interface
 */
export interface SearchResult {
  /** Unique identifier */
  id: string
  /** Result title */
  title: string
  /** Optional description */
  description?: string
}

/**
 * Card metadata interface
 */
export interface CardMetadata {
  /** Release year */
  year?: number
  /** Number of episodes */
  episodes?: number
  /** Rating out of 10 */
  rating?: number
  /** Watch status */
  status?: 'watching' | 'completed' | 'planned' | 'dropped'
  /** Genre tags */
  genres?: string[]
}

/**
 * Button variant type
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

/**
 * Animation variant type
 */
export type AnimationVariant = 'fade' | 'slide' | 'scale' | 'flip' | 'bounce'

/**
 * Size variant type
 */
export type SizeVariant = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Position variant type
 */
export type PositionVariant = 'left' | 'right' | 'top' | 'bottom'

/**
 * Status variant type
 */
export type StatusVariant = 'watching' | 'completed' | 'planned' | 'dropped'

/**
 * Duration preset type
 */
export type DurationPreset = 'fast' | 'normal' | 'slow'

/**
 * Preload strategy type
 */
export type PreloadStrategy = 'none' | 'hover' | 'visible' | 'idle'

/**
 * Motion feature type
 */
export type MotionFeature =
  | 'animations'
  | 'variants'
  | 'transitions'
  | 'performance'

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Extract component props from a component type
 */
export type ComponentProps<T> = T extends (props: infer P) => JSX.Element
  ? P
  : never

/**
 * Omit common props from interface
 */
export type OmitCommonProps<T> = Omit<T, 'class' | 'children'>

/**
 * Create a strict version of an interface (no optional properties)
 */
export type Strict<T> = {
  [P in keyof T]-?: T[P]
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Type guard for search results
 */
export function isValidSearchResult(obj: unknown): obj is SearchResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof obj.id === 'string' &&
    'title' in obj &&
    typeof obj.title === 'string'
  )
}

/**
 * Validate year field in metadata
 */
function isValidYear(year: unknown): boolean {
  if (typeof year !== 'number') return false
  const currentYear = new Date().getFullYear() + 5
  return year >= 1900 && year <= currentYear
}

/**
 * Validate rating field in metadata
 */
function isValidRating(rating: unknown): boolean {
  return typeof rating === 'number' && rating >= 0 && rating <= 10
}

/**
 * Validate status field in metadata
 */
function isValidStatus(status: unknown): boolean {
  const validStatuses: StatusVariant[] = [
    'watching',
    'completed',
    'planned',
    'dropped',
  ]
  return (
    typeof status === 'string' &&
    validStatuses.includes(status as StatusVariant)
  )
}

/**
 * Validate genres field in metadata
 */
function isValidGenres(genres: unknown): boolean {
  return Array.isArray(genres) && genres.every((g) => typeof g === 'string')
}

/**
 * Type guard for card metadata
 */
export function isValidCardMetadata(obj: unknown): obj is CardMetadata {
  if (!obj || typeof obj !== 'object') return false

  const metadata = obj as Record<string, unknown>

  if (metadata.year !== undefined && !isValidYear(metadata.year)) {
    return false
  }

  if (metadata.rating !== undefined && !isValidRating(metadata.rating)) {
    return false
  }

  if (metadata.status !== undefined && !isValidStatus(metadata.status)) {
    return false
  }

  if (metadata.genres !== undefined && !isValidGenres(metadata.genres)) {
    return false
  }

  return true
}

/**
 * Type guard for motion features
 */
export function isValidMotionFeature(obj: unknown): obj is MotionFeature {
  const validFeatures: MotionFeature[] = [
    'animations',
    'variants',
    'transitions',
    'performance',
  ]
  return typeof obj === 'string' && validFeatures.includes(obj as MotionFeature)
}

/**
 * Type guard for button variants
 */
export function isValidButtonVariant(obj: unknown): obj is ButtonVariant {
  const validVariants: ButtonVariant[] = [
    'primary',
    'secondary',
    'ghost',
    'danger',
  ]
  return typeof obj === 'string' && validVariants.includes(obj as ButtonVariant)
}

/**
 * Type guard for animation variants
 */
export function isValidAnimationVariant(obj: unknown): obj is AnimationVariant {
  const validVariants: AnimationVariant[] = [
    'fade',
    'slide',
    'scale',
    'flip',
    'bounce',
  ]
  return (
    typeof obj === 'string' && validVariants.includes(obj as AnimationVariant)
  )
}

/**
 * Type guard for size variants
 */
export function isValidSizeVariant(obj: unknown): obj is SizeVariant {
  const validVariants: SizeVariant[] = ['sm', 'md', 'lg', 'xl']
  return typeof obj === 'string' && validVariants.includes(obj as SizeVariant)
}

/**
 * Type guard for duration presets
 */
export function isValidDurationPreset(obj: unknown): obj is DurationPreset {
  const validPresets: DurationPreset[] = ['fast', 'normal', 'slow']
  return typeof obj === 'string' && validPresets.includes(obj as DurationPreset)
}

/**
 * Type guard for preload strategies
 */
export function isValidPreloadStrategy(obj: unknown): obj is PreloadStrategy {
  const validStrategies: PreloadStrategy[] = [
    'none',
    'hover',
    'visible',
    'idle',
  ]
  return (
    typeof obj === 'string' && validStrategies.includes(obj as PreloadStrategy)
  )
}
