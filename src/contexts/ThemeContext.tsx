import { createContext, createEffect, useContext, type JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import { STORAGE_CONFIG } from '../lib/config'

export type Theme = 'light' | 'dark' | 'auto'

interface ThemeState {
  theme: Theme
  systemTheme: 'light' | 'dark'
  effectiveTheme: 'light' | 'dark'
}

interface ThemeContextType {
  state: ThemeState
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>()

export function ThemeProvider(props: { children: JSX.Element }) {
  const [state, setState] = createStore<ThemeState>({
    theme: 'auto',
    systemTheme: 'light',
    effectiveTheme: 'light',
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

  // Load saved theme from localStorage
  const loadSavedTheme = (): Theme => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_CONFIG.keys.theme)
      return (saved as Theme) || 'auto'
    }
    return 'auto'
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

  // Apply theme to document
  createEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(state.effectiveTheme)
    }
  })

  const setTheme = (theme: Theme) => {
    const effectiveTheme = getEffectiveTheme(theme, state.systemTheme)
    setState({
      theme,
      effectiveTheme,
    })

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CONFIG.keys.theme, theme)
    }
  }

  const toggleTheme = () => {
    const newTheme = state.effectiveTheme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  const contextValue: ThemeContextType = {
    state,
    setTheme,
    toggleTheme,
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
