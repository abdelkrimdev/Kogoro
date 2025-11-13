import type { Component } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { ThemeProvider } from './contexts/ThemeContext'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './components/pages/Dashboard'
import { Collection } from './components/pages/Collection'
import { Scanner } from './components/pages/Scanner'
import { Search } from './components/pages/Search'
import { Settings } from './components/pages/Settings'
import { appState, storeActions } from './lib/store'

const App: Component = () => {
  const handleSearch = (query: string) => {
    storeActions.setSearchQuery(query)
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <Layout searchQuery={appState.searchQuery} onSearch={handleSearch}>
            <Route path="/" component={Dashboard} />
            <Route path="/collection" component={Collection} />
            <Route path="/scanner" component={Scanner} />
            <Route path="/search" component={Search} />
            <Route path="/settings" component={Settings} />
          </Layout>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
