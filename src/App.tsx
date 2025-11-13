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
          <Route
            path="/"
            component={() => (
              <Layout
                searchQuery={appState.searchQuery}
                onSearch={handleSearch}
              >
                <Dashboard />
              </Layout>
            )}
          />
          <Route
            path="/collection"
            component={() => (
              <Layout
                searchQuery={appState.searchQuery}
                onSearch={handleSearch}
              >
                <Collection />
              </Layout>
            )}
          />
          <Route
            path="/scanner"
            component={() => (
              <Layout
                searchQuery={appState.searchQuery}
                onSearch={handleSearch}
              >
                <Scanner />
              </Layout>
            )}
          />
          <Route
            path="/search"
            component={() => (
              <Layout
                searchQuery={appState.searchQuery}
                onSearch={handleSearch}
              >
                <Search />
              </Layout>
            )}
          />
          <Route
            path="/settings"
            component={() => (
              <Layout
                searchQuery={appState.searchQuery}
                onSearch={handleSearch}
              >
                <Settings />
              </Layout>
            )}
          />
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
