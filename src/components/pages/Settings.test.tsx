import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
import { Settings } from './Settings'
import type { JSX } from 'solid-js'

// Mock component prop types
interface MockMotionCardProps {
  variant?: string
  animateOnScroll?: boolean
  children?: JSX.Element
  class?: string
  [key: string]: unknown
}

interface MockMotionListProps {
  items?: unknown[]
  renderItem?: (item: unknown, index: number) => JSX.Element
  children?: JSX.Element
  class?: string
  [key: string]: unknown
}

// Mock the store
vi.mock('../../lib/store', () => ({
  appState: {
    settings: {
      theme: 'light',
      language: 'en',
      autoRefresh: true,
      autoScan: false,
      animeDirectories: ['/path/to/anime1', '/path/to/anime2'],
      downloadDirectory: '/path/to/downloads',
      anidbClient: 'kogoro',
      anidbPort: 9000,
      anidbUsername: '',
      anidbPassword: '',
      fileNameFormat: '{title} - S{season}E{episode} - {name}',
      createSeasonFolders: true,
      includeSubtitles: true,
      generateThumbnails: false,
    },
  },
  storeActions: {
    updateSettings: vi.fn(),
  },
  defaultSettings: {
    theme: 'light',
    language: 'en',
    autoRefresh: true,
    autoScan: false,
    animeDirectories: [],
    downloadDirectory: '',
    anidbClient: 'kogoro',
    anidbPort: 9000,
    anidbUsername: '',
    anidbPassword: '',
    fileNameFormat: '{title} - S{season}E{episode} - {name}',
    createSeasonFolders: true,
    includeSubtitles: true,
    generateThumbnails: false,
  },
}))

// Mock config
vi.mock('../../lib/config', () => ({
  FILE_NAMING_PATTERNS: {
    standard: '{title} - S{season}E{episode} - {name}',
    simple: '{title} - {episode}',
    detailed: '{title} - Season {season} Episode {episode} - {name} ({date})',
  },
  UI_CONFIG: {
    animationDuration: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
  },
}))

// Mock the motion hooks
vi.mock('../../hooks/useMotionAnimations', () => ({
  useScrollAnimation: () => ({
    elementRef: vi.fn(),
    getAnimationStyles: () => ({}),
  }),
  useInteractionAnimation: () => ({
    eventHandlers: {},
    getAnimationStyles: () => ({}),
  }),
  usePageTransition: () => ({
    getPageProps: () => ({}),
  }),
  useModalAnimation: () => ({
    isOpen: () => false,
    open: vi.fn(),
    close: vi.fn(),
    getModalProps: () => ({}),
    getOverlayProps: () => ({}),
  }),
}))

// Mock the motion components
vi.mock('../ui/MotionCard', () => ({
  MotionCard: (props: MockMotionCardProps) => (
    <div data-testid="motion-card" {...props}>
      {props.children}
    </div>
  ),
}))

vi.mock('../ui/MotionList', () => ({
  MotionList: (props: MockMotionListProps) => (
    <div data-testid="motion-list" {...props}>
      {props.items?.map((item: unknown, index: number) =>
        props.renderItem(item, index)
      )}
    </div>
  ),
}))

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderSettings = () => {
    return render(() => <Settings />)
  }

  describe('Rendering', () => {
    it('should render settings header', () => {
      renderSettings()

      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(
        screen.getByText('Configure your Kogoro application preferences')
      ).toBeInTheDocument()
    })

    it('should render action buttons', () => {
      renderSettings()

      // Use getAllByText since there might be multiple instances
      expect(screen.getAllByText('Reset').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Save Changes').length).toBeGreaterThan(0)
    })

    it('should render sidebar tabs', () => {
      renderSettings()

      // Use getAllByText since tabs might appear multiple times
      expect(screen.getAllByText('General').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Directories').length).toBeGreaterThan(0)
      expect(screen.getAllByText('AniDB').length).toBeGreaterThan(0)
      expect(screen.getAllByText('File Naming').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Advanced').length).toBeGreaterThan(0)
    })

    it('should show General tab by default', () => {
      renderSettings()

      expect(screen.getAllByText('General Settings').length).toBeGreaterThan(0)
    })
  })

  describe('Tab Navigation', () => {
    it('should switch to Directories tab when clicked', () => {
      renderSettings()

      const directoriesTab = screen.getAllByText('Directories')[0] // Get first instance (sidebar)
      fireEvent.click(directoriesTab)

      expect(screen.getAllByText('Directory Settings').length).toBeGreaterThan(
        0
      )
    })

    it('should switch to AniDB tab when clicked', () => {
      renderSettings()

      const anidbTab = screen.getAllByText('AniDB')[0] // Get first instance (sidebar)
      fireEvent.click(anidbTab)

      expect(screen.getAllByText('AniDB Settings').length).toBeGreaterThan(0)
    })

    it('should switch to File Naming tab when clicked', () => {
      renderSettings()

      const namingTab = screen.getAllByText('File Naming')[0] // Get first instance (sidebar)
      fireEvent.click(namingTab)

      expect(
        screen.getAllByText('File Naming Settings').length
      ).toBeGreaterThan(0)
    })

    it('should switch to Advanced tab when clicked', () => {
      renderSettings()

      const advancedTab = screen.getAllByText('Advanced')[0] // Get first instance (sidebar)
      fireEvent.click(advancedTab)

      expect(screen.getAllByText('Advanced Settings').length).toBeGreaterThan(0)
    })

    it('should highlight active tab', () => {
      renderSettings()

      const generalTab = screen.getAllByText('General')[0] // Get first instance (sidebar)
      const directoriesTab = screen.getAllByText('Directories')[0] // Get first instance (sidebar)

      // General should be active by default
      expect(generalTab.closest('button')).toHaveClass(/bg-accent/)
      expect(directoriesTab.closest('button')).not.toHaveClass(/bg-accent/)

      // Switch to Directories
      fireEvent.click(directoriesTab)
      expect(directoriesTab.closest('button')).toHaveClass(/bg-accent/)
      expect(generalTab.closest('button')).not.toHaveClass(/bg-accent/)
    })
  })

  describe('General Settings', () => {
    it('should render theme selector', () => {
      renderSettings()

      expect(screen.getByDisplayValue('light')).toBeInTheDocument()

      const themeOptions = screen.getAllByRole('option')
      expect(
        themeOptions.some((option) => option.textContent === 'Light')
      ).toBe(true)
      expect(themeOptions.some((option) => option.textContent === 'Dark')).toBe(
        true
      )
      expect(themeOptions.some((option) => option.textContent === 'Auto')).toBe(
        true
      )
    })

    it('should render language selector', () => {
      renderSettings()

      expect(screen.getByDisplayValue('en')).toBeInTheDocument()

      const languageOptions = screen.getAllByRole('option')
      expect(
        languageOptions.some((option) => option.textContent === 'English')
      ).toBe(true)
      expect(
        languageOptions.some((option) => option.textContent === 'Japanese')
      ).toBe(true)
    })

    it('should render auto-refresh checkbox', () => {
      renderSettings()

      const autoRefreshCheckbox = screen.getByLabelText(
        'Auto-refresh collection'
      )
      expect(autoRefreshCheckbox).toBeChecked()
    })

    it('should render auto-scan checkbox', () => {
      renderSettings()

      const autoScanCheckbox = screen.getByLabelText('Auto-scan directories')
      expect(autoScanCheckbox).not.toBeChecked()
    })

    it('should handle theme change', () => {
      renderSettings()

      const themeSelect = screen.getByDisplayValue('light')
      fireEvent.change(themeSelect, { target: { value: 'dark' } })

      expect(themeSelect).toHaveValue('dark')
    })

    it('should handle language change', () => {
      renderSettings()

      const languageSelect = screen.getByDisplayValue('en')
      fireEvent.change(languageSelect, { target: { value: 'ja' } })

      expect(languageSelect).toHaveValue('ja')
    })

    it('should handle checkbox changes', () => {
      renderSettings()

      const autoScanCheckbox = screen.getByLabelText('Auto-scan directories')
      fireEvent.click(autoScanCheckbox)

      expect(autoScanCheckbox).toBeChecked()
    })
  })

  describe('Directory Settings', () => {
    beforeEach(() => {
      renderSettings()
      const directoriesTab = screen.getByText('Directories')
      fireEvent.click(directoriesTab)
    })

    it('should render anime directories list', () => {
      expect(screen.getByText('/path/to/anime1')).toBeInTheDocument()
      expect(screen.getByText('/path/to/anime2')).toBeInTheDocument()
    })

    it('should render download directory', () => {
      expect(screen.getByText('/path/to/downloads')).toBeInTheDocument()
    })

    it('should render add directory button', () => {
      expect(screen.getByText('Add Directory')).toBeInTheDocument()
      expect(screen.getByText('Browse')).toBeInTheDocument()
    })

    it('should render remove buttons for anime directories', () => {
      const removeButtons = screen.getAllByText('Remove')
      expect(removeButtons.length).toBe(2) // Two anime directories
    })

    it('should handle directory removal', () => {
      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])

      // Should remove the first directory
      expect(screen.queryByText('/path/to/anime1')).not.toBeInTheDocument()
      expect(screen.getByText('/path/to/anime2')).toBeInTheDocument()
    })
  })

  describe('AniDB Settings', () => {
    beforeEach(() => {
      renderSettings()
      const anidbTab = screen.getByText('AniDB')
      fireEvent.click(anidbTab)
    })

    it('should render AniDB configuration fields', () => {
      expect(screen.getByDisplayValue('kogoro')).toBeInTheDocument()
      expect(screen.getByDisplayValue('9000')).toBeInTheDocument()
    })

    it('should render username and password fields', () => {
      expect(
        screen.getByPlaceholderText('Leave empty for anonymous access')
      ).toBeInTheDocument()
    })

    it('should handle client name change', () => {
      const clientInput = screen.getByDisplayValue('kogoro')
      fireEvent.change(clientInput, { target: { value: 'test-client' } })

      expect(clientInput).toHaveValue('test-client')
    })

    it('should handle port change', () => {
      const portInput = screen.getByDisplayValue('9000')
      fireEvent.change(portInput, { target: { value: '9001' } })

      expect(portInput).toHaveValue(9001)
    })
  })

  describe('File Naming Settings', () => {
    beforeEach(() => {
      renderSettings()
      const namingTab = screen.getByText('File Naming')
      fireEvent.click(namingTab)
    })

    it('should render file name format selector', () => {
      expect(
        screen.getByDisplayValue('{title} - S{season}E{episode} - {name}')
      ).toBeInTheDocument()
    })

    it('should render available variables', () => {
      expect(screen.getByText('{title} - Anime title')).toBeInTheDocument()
      expect(screen.getByText('{season} - Season number')).toBeInTheDocument()
      expect(screen.getByText('{episode} - Episode number')).toBeInTheDocument()
    })

    it('should render season folders checkbox', () => {
      const seasonFoldersCheckbox = screen.getByLabelText(
        'Create season folders'
      )
      expect(seasonFoldersCheckbox).toBeChecked()
    })

    it('should handle file format change', () => {
      const formatSelect = screen.getByDisplayValue(
        '{title} - S{season}E{episode} - {name}'
      )
      fireEvent.change(formatSelect, {
        target: { value: '{title} - {episode}' },
      })

      expect(formatSelect).toHaveValue('{title} - {episode}')
    })
  })

  describe('Advanced Settings', () => {
    beforeEach(() => {
      renderSettings()
      const advancedTab = screen.getByText('Advanced')
      fireEvent.click(advancedTab)
    })

    it('should render advanced options', () => {
      expect(
        screen.getByLabelText('Include subtitles in scans')
      ).toBeInTheDocument()
      expect(
        screen.getByLabelText('Generate video thumbnails')
      ).toBeInTheDocument()
    })

    it('should handle subtitle checkbox', () => {
      const subtitlesCheckbox = screen.getByLabelText(
        'Include subtitles in scans'
      )
      expect(subtitlesCheckbox).toBeChecked()

      fireEvent.click(subtitlesCheckbox)
      expect(subtitlesCheckbox).not.toBeChecked()
    })

    it('should handle thumbnails checkbox', () => {
      const thumbnailsCheckbox = screen.getByLabelText(
        'Generate video thumbnails'
      )
      expect(thumbnailsCheckbox).not.toBeChecked()

      fireEvent.click(thumbnailsCheckbox)
      expect(thumbnailsCheckbox).toBeChecked()
    })
  })

  describe('Settings Management', () => {
    it('should enable save button when changes are made', () => {
      renderSettings()

      const saveButton = screen.getByText('Save Changes')
      expect(saveButton).toBeDisabled()

      // Make a change
      const autoScanCheckbox = screen.getByLabelText('Auto-scan directories')
      fireEvent.click(autoScanCheckbox)

      expect(saveButton).not.toBeDisabled()
    })

    it('should handle reset button click', () => {
      renderSettings()

      const resetButton = screen.getByText('Reset')
      fireEvent.click(resetButton)

      // Should reset to default settings
      expect(screen.getByText('Save Changes')).not.toBeDisabled()
    })

    it('should handle save button click', () => {
      const mockUpdateSettings = vi.mocked(
        require('../../lib/store').storeActions.updateSettings
      )

      renderSettings()

      // Make a change first
      const autoScanCheckbox = screen.getByLabelText('Auto-scan directories')
      fireEvent.click(autoScanCheckbox)

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)

      expect(mockUpdateSettings).toHaveBeenCalled()
    })
  })

  describe('Directory Management', () => {
    beforeEach(() => {
      renderSettings()
      const directoriesTab = screen.getByText('Directories')
      fireEvent.click(directoriesTab)
    })

    it('should handle add anime directory', () => {
      const promptSpy = vi
        .spyOn(window, 'prompt')
        .mockReturnValue('/new/anime/path')

      const addButton = screen.getByText('Add Directory')
      fireEvent.click(addButton)

      expect(promptSpy).toHaveBeenCalledWith('Enter anime directory path:')
      expect(screen.getByText('/new/anime/path')).toBeInTheDocument()

      promptSpy.mockRestore()
    })

    it('should handle add download directory', () => {
      const promptSpy = vi
        .spyOn(window, 'prompt')
        .mockReturnValue('/new/download/path')

      const browseButton = screen.getByText('Browse')
      fireEvent.click(browseButton)

      expect(promptSpy).toHaveBeenCalledWith('Enter download directory path:')
      expect(screen.getByText('/new/download/path')).toBeInTheDocument()

      promptSpy.mockRestore()
    })

    it('should show empty state when no anime directories', () => {
      // Remove existing directories
      const removeButtons = screen.getAllByText('Remove')
      removeButtons.forEach((button) => {
        fireEvent.click(button)
      })

      expect(
        screen.getByText('No anime directories configured')
      ).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      renderSettings()

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should have proper labels for form controls', () => {
      renderSettings()

      expect(screen.getByLabelText('Theme')).toBeInTheDocument()
      expect(screen.getByLabelText('Language')).toBeInTheDocument()
      expect(
        screen.getByLabelText('Auto-refresh collection')
      ).toBeInTheDocument()
    })

    it('should have proper field associations', () => {
      renderSettings()

      const themeSelect = screen.getByDisplayValue('light')
      expect(themeSelect).toHaveAttribute('id', 'theme-select')

      const themeLabel = screen.getByLabelText('Theme')
      expect(themeLabel).toHaveAttribute('for', 'theme-select')
    })
  })

  describe('Theme Integration', () => {
    it('should apply theme classes correctly', () => {
      renderSettings()

      const header = screen.getByText('Settings')
      expect(header).toHaveClass('text-3xl', 'font-bold')
    })

    it('should handle theme changes gracefully', () => {
      renderSettings()

      // Simulate theme change
      document.documentElement.classList.add('dark')

      // Component should still render without errors
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid port values gracefully', () => {
      renderSettings()
      const anidbTab = screen.getByText('AniDB')
      fireEvent.click(anidbTab)

      const portInput = screen.getByDisplayValue('9000')
      fireEvent.change(portInput, { target: { value: 'invalid' } })

      // Should not crash
      expect(portInput).toHaveValue('invalid')
    })

    it('should handle empty directory paths gracefully', () => {
      renderSettings()
      const directoriesTab = screen.getByText('Directories')
      fireEvent.click(directoriesTab)

      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('')

      const addButton = screen.getByText('Add Directory')
      fireEvent.click(addButton)

      // Should not add empty directory
      expect(screen.queryByText('')).not.toBeInTheDocument()

      promptSpy.mockRestore()
    })
  })

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const { rerender } = renderSettings()

      // Rerender
      rerender(() => <Settings />)

      // Should still render correctly
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should handle rapid tab changes', () => {
      renderSettings()

      const tabs = [
        'General',
        'Directories',
        'AniDB',
        'File Naming',
        'Advanced',
      ]

      // Rapid tab changes
      tabs.forEach((tabName) => {
        fireEvent.click(screen.getByText(tabName))
      })

      // Should end on Advanced tab
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument()
    })
  })
})
