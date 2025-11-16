import type { Component } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { ThemeProvider } from './contexts/ThemeContext'
import {
  ErrorBoundary,
  ThemeErrorBoundary,
  Layout,
  Dashboard,
  Collection,
  Scanner,
  Search,
  Settings,
} from './components'
import { appState, storeActions } from './lib/store'

const App: Component = () => {
  const handleSearch = (query: string) => {
    storeActions.setSearchQuery(query)
  }

  return (
    <ErrorBoundary>
      <ThemeErrorBoundary
        onError={(error) => {
          console.error('Theme provider error:', error)
        }}
      >
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
      </ThemeErrorBoundary>
    </ErrorBoundary>
  )
}

export default App
