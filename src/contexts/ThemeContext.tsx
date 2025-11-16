import {
  createContext,
  createEffect,
  createSignal,
  useContext,
  type JSX,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { STORAGE_CONFIG, UI_CONFIG } from '../lib/config'
import {
  createSmoothThemeTransition,
  getTransitionDuration,
  watchReducedMotion,
} from '../lib/theme-transitions'

export type Theme = 'light' | 'dark' | 'auto'

/**
 * Validation result for theme data
 */
interface ValidationResult {
  isValid: boolean
  theme?: Theme
  error?: string
}

/**
 * Storage error types
 */
enum StorageErrorType {
  ACCESS_DENIED = 'ACCESS_DENIED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  INVALID_DATA = 'INVALID_DATA',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error for storage operations
 */
class ThemeStorageError extends Error {
  constructor(
    public type: StorageErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'ThemeStorageError'
  }
}

interface ThemeState {
  theme: Theme
  systemTheme: 'light' | 'dark'
  effectiveTheme: 'light' | 'dark'
}

interface ThemeContextType {
  state: ThemeState
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  error: ThemeStorageError | null
  clearError: () => void
}

const ThemeContext = createContext<ThemeContextType>()

/**
 * Validates if a value is a valid theme
 */
function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && UI_CONFIG.themes.includes(value as Theme)
}

/**
 * Sanitizes and validates theme data from localStorage
 */
function validateThemeData(data: unknown): ValidationResult {
  // Check for null/undefined
  if (data === null || data === undefined) {
    return { isValid: false, error: 'No data provided' }
  }

  // Check for string type
  if (typeof data !== 'string') {
    return { isValid: false, error: 'Data is not a string' }
  }

  // Check for empty string
  if (data.trim() === '') {
    return { isValid: false, error: 'Empty string provided' }
  }

  // Check for valid theme values
  if (!isValidTheme(data)) {
    return {
      isValid: false,
      error: `Invalid theme value: "${data}". Valid values: ${UI_CONFIG.themes.join(', ')}`,
    }
  }

  // Check for suspicious content (potential XSS)
  if (
    data.includes('<script') ||
    data.includes('javascript:') ||
    data.includes('data:')
  ) {
    return { isValid: false, error: 'Suspicious content detected' }
  }

  return { isValid: true, theme: data as Theme }
}

/**
 * Checks if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

/**
 * Removes corrupted theme data from localStorage
 */
function removeCorruptedThemeData(): void {
  try {
    localStorage.removeItem(STORAGE_CONFIG.keys.theme)
  } catch (removeError) {
    console.warn('Failed to remove corrupted theme data:', removeError)
  }
}

/**
 * Logs storage errors in development mode
 */
function logStorageError(error: Error | ThemeStorageError): void {
  if (!import.meta.env.DEV) return

  if (error instanceof ThemeStorageError) {
    console.warn(`Storage error (${error.type}): ${error.message}`)
  } else if (error.name === 'QuotaExceededError') {
    console.warn('localStorage quota exceeded, using default theme')
  } else {
    console.warn('Unexpected error reading theme from storage:', error)
  }
}

/**
 * Safely retrieves theme from localStorage with validation and error handling
 */
function safeGetThemeFromStorage(): Theme {
  try {
    // Check if localStorage is available
    if (!isLocalStorageAvailable()) {
      throw new ThemeStorageError(
        StorageErrorType.ACCESS_DENIED,
        'localStorage is not available'
      )
    }

    // Get raw data
    const rawData = localStorage.getItem(STORAGE_CONFIG.keys.theme)

    // Validate the data
    const validation = validateThemeData(rawData)

    if (!validation.isValid) {
      logStorageError(new Error(validation.error || 'Invalid theme data'))
      removeCorruptedThemeData()
      return UI_CONFIG.defaultTheme
    }

    return validation.theme!
  } catch (error) {
    logStorageError(error as Error)
    return UI_CONFIG.defaultTheme
  }
}

/**
 * Creates a storage error from a generic error
 */
function createStorageError(error: unknown): ThemeStorageError {
  if (error instanceof ThemeStorageError) {
    return error
  }

  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') {
      return new ThemeStorageError(
        StorageErrorType.QUOTA_EXCEEDED,
        'localStorage quota exceeded, theme preference not saved'
      )
    }

    return new ThemeStorageError(
      StorageErrorType.UNKNOWN,
      'Unexpected error saving theme to storage',
      error
    )
  }

  return new ThemeStorageError(
    StorageErrorType.UNKNOWN,
    'Unknown error occurred while saving theme'
  )
}

/**
 * Logs storage save errors in development mode
 */
function logStorageSaveError(error: ThemeStorageError): void {
  if (import.meta.env.DEV) {
    console.warn(`Storage error (${error.type}): ${error.message}`)
  }
}

/**
 * Safely saves theme to localStorage with error handling
 */
function safeSetThemeToStorage(theme: Theme): {
  success: boolean
  error?: ThemeStorageError
} {
  try {
    // Check if localStorage is available
    if (!isLocalStorageAvailable()) {
      throw new ThemeStorageError(
        StorageErrorType.ACCESS_DENIED,
        'localStorage is not available'
      )
    }

    // Validate the theme before saving
    const validation = validateThemeData(theme)
    if (!validation.isValid) {
      throw new ThemeStorageError(
        StorageErrorType.INVALID_DATA,
        `Cannot save invalid theme: ${validation.error}`
      )
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_CONFIG.keys.theme, theme)
    return { success: true }
  } catch (error) {
    const storageError = createStorageError(error)
    logStorageSaveError(storageError)
    return { success: false, error: storageError }
  }
}

export function ThemeProvider(props: { children: JSX.Element }) {
  const [state, setState] = createStore<ThemeState>({
    theme: 'auto',
    systemTheme: 'light',
    effectiveTheme: 'light',
  })
  const [error, setError] = createSignal<ThemeStorageError | null>(null)

  // Watch for reduced motion preference changes
  createEffect(() => {
    if (typeof window !== 'undefined') {
      const cleanup = watchReducedMotion((prefersReduced) => {
        if (import.meta.env.DEV) {
          console.log(`Reduced motion preference: ${prefersReduced}`)
        }
      })
      return cleanup
    }
  })

  // Get system theme
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return 'light'
  }

  // Get effective theme based on user preference and system theme
  const getEffectiveTheme = (
    userTheme: Theme,
    systemTheme: 'light' | 'dark'
  ): 'light' | 'dark' => {
    return userTheme === 'auto' ? systemTheme : userTheme
  }

  // Load saved theme from localStorage with validation
  const loadSavedTheme = (): Theme => {
    return safeGetThemeFromStorage()
  }

  // Initialize theme
  const systemTheme = getSystemTheme()
  const savedTheme = loadSavedTheme()
  const effectiveTheme = getEffectiveTheme(savedTheme, systemTheme)

  setState({
    theme: savedTheme,
    systemTheme,
    effectiveTheme,
  })

  // Listen for system theme changes
  createEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => {
        const newSystemTheme = mediaQuery.matches ? 'dark' : 'light'
        const newEffectiveTheme = getEffectiveTheme(state.theme, newSystemTheme)
        setState({
          systemTheme: newSystemTheme,
          effectiveTheme: newEffectiveTheme,
        })
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  })

  // Apply theme to document with smooth transitions
  createEffect(() => {
    if (typeof document !== 'undefined') {
      const previousTheme = document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
      const newTheme = state.effectiveTheme

      if (previousTheme !== newTheme) {
        // Create smooth transition
        createSmoothThemeTransition(() => {
          document.documentElement.classList.remove('light', 'dark')
          document.documentElement.classList.add(newTheme)
        }, getTransitionDuration())
      }
    }
  })

  const setTheme = (theme: Theme) => {
    try {
      // Clear any previous errors
      setError(null)

      const effectiveTheme = getEffectiveTheme(theme, state.systemTheme)
      setState({
        theme,
        effectiveTheme,
      })

      // Save to localStorage with error handling
      const result = safeSetThemeToStorage(theme)

      if (!result.success && result.error) {
        // If save failed, set to error
        setError(result.error)
      }
    } catch (err) {
      // Handle any unexpected errors during theme switching
      const themeError =
        err instanceof ThemeStorageError
          ? err
          : new ThemeStorageError(
              StorageErrorType.UNKNOWN,
              'Unexpected error during theme switching',
              err instanceof Error ? err : undefined
            )

      setError(themeError)

      // Log error for debugging
      if (import.meta.env.DEV) {
        console.error('Theme switching error:', themeError)
      }
    }
  }

  const toggleTheme = () => {
    const newTheme = state.effectiveTheme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  const clearError = () => {
    setError(null)
  }

  const contextValue: ThemeContextType = {
    state,
    setTheme,
    toggleTheme,
    get error() {
      return error()
    },
    clearError,
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {props.children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
