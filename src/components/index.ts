// ============================================================================
// COMPONENT BARREL EXPORTS
// ============================================================================

// Layout Components
export { Header } from './layout/Header'
export { Layout } from './layout/Layout'
export { Sidebar } from './layout/Sidebar'

// Page Components
export { Collection } from './pages/Collection'
export { Dashboard } from './pages/Dashboard'
export { Scanner } from './pages/Scanner'
export { Search } from './pages/Search'
export { Settings } from './pages/Settings'

// UI Components
export { ErrorBoundary } from './ui/ErrorBoundary'
export { ThemeErrorBoundary } from './ui/ThemeErrorBoundary'
export { Loading } from './ui/Loading'

// ============================================================================
// NAMESPACE EXPORTS (for better organization)
// ============================================================================

export * as LayoutComponents from './layout/index'
export * as PageComponents from './pages/index'
export * as UIComponents from './ui/index'
