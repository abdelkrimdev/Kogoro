import { render, screen, fireEvent } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MotionSearch } from './MotionSearch'

import type { SearchResult } from './MotionSearch'

// Mock motion utilities
vi.mock('../../lib/motion', () => ({
  isMotionEnabled: vi.fn(() => true),
  getEasing: vi.fn(() => 'ease-out'),
  getDuration: vi.fn(() => 300),
}))

describe('MotionSearch', () => {
  const mockResults: SearchResult[] = [
    { id: '1', title: 'Result 1', description: 'Description 1' },
    { id: '2', title: 'Result 2', description: 'Description 2' },
    { id: '3', title: 'Result 3' },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(() => <MotionSearch />)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should render with custom placeholder', () => {
      render(() => <MotionSearch placeholder="Custom placeholder" />)

      expect(
        screen.getByPlaceholderText('Custom placeholder')
      ).toBeInTheDocument()
    })

    it('should render with initial value', () => {
      render(() => <MotionSearch value="initial value" />)

      const input = screen.getByDisplayValue('initial value')
      expect(input).toBeInTheDocument()
    })

    it('should apply custom CSS classes', () => {
      render(() => <MotionSearch class="custom-search-class" />)

      const container = document.querySelector('.motion-search-container')
      expect(container).toHaveClass('custom-search-class')
    })
  })

  describe('Input Functionality', () => {
    it('should call onInput when value changes', () => {
      const onInput = vi.fn()
      render(() => <MotionSearch onInput={onInput} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.input(input, { target: { value: 'test query' } })

      expect(onInput).toHaveBeenCalledWith('test query')
    })

    it('should update internal value when typing', () => {
      render(() => <MotionSearch />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.input(input, { target: { value: 'hello world' } })

      expect(input).toHaveValue('hello world')
    })

    it('should call onFocus when input is focused', () => {
      const onFocus = vi.fn()
      render(() => <MotionSearch onFocus={onFocus} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(onFocus).toHaveBeenCalled()
    })

    it('should call onBlur when input loses focus', () => {
      const onBlur = vi.fn()
      render(() => <MotionSearch onBlur={onBlur} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.blur(input)

      expect(onBlur).toHaveBeenCalled()
    })

    it('should be disabled when disabled prop is true', () => {
      render(() => <MotionSearch disabled />)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('opacity-50', 'cursor-not-allowed')
    })
  })

  describe('Clear Button', () => {
    it('should show clear button when value is present', () => {
      render(() => <MotionSearch value="some value" />)

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      expect(clearButton).toBeInTheDocument()
    })

    it('should not show clear button when value is empty', () => {
      render(() => <MotionSearch />)

      expect(
        screen.queryByRole('button', { name: /clear search/i })
      ).not.toBeInTheDocument()
    })

    it('should not show clear button when disabled', () => {
      render(() => <MotionSearch value="some value" disabled />)

      expect(
        screen.queryByRole('button', { name: /clear search/i })
      ).not.toBeInTheDocument()
    })

    it('should call onClear when clear button is clicked', () => {
      const onClear = vi.fn()
      const onInput = vi.fn()
      render(() => (
        <MotionSearch value="test" onClear={onClear} onInput={onInput} />
      ))

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      fireEvent.click(clearButton)

      expect(onClear).toHaveBeenCalled()
      expect(onInput).toHaveBeenCalledWith('')
    })

    it('should clear input value when clear button is clicked', () => {
      render(() => <MotionSearch value="test" />)

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      fireEvent.click(clearButton)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toHaveValue('')
    })
  })

  describe('Search Results', () => {
    it('should show results when focused and results are provided', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(screen.getByText('Result 1')).toBeInTheDocument()
      expect(screen.getByText('Result 2')).toBeInTheDocument()
      expect(screen.getByText('Result 3')).toBeInTheDocument()
    })

    it('should not show results when not focused', () => {
      render(() => <MotionSearch results={mockResults} />)

      expect(screen.queryByText('Result 1')).not.toBeInTheDocument()
    })

    it('should not show results when showResults is false', () => {
      render(() => <MotionSearch results={mockResults} showResults={false} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(screen.queryByText('Result 1')).not.toBeInTheDocument()
    })

    it('should show result descriptions when provided', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(screen.getByText('Description 1')).toBeInTheDocument()
      expect(screen.getByText('Description 2')).toBeInTheDocument()
      expect(screen.queryByText('Description 3')).not.toBeInTheDocument()
    })

    it('should call onSelectResult when result is clicked', () => {
      const onSelectResult = vi.fn()
      render(() => (
        <MotionSearch results={mockResults} onSelectResult={onSelectResult} />
      ))

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      const result1 = screen.getByText('Result 1')
      fireEvent.click(result1)

      expect(onSelectResult).toHaveBeenCalledWith(mockResults[0])
    })

    it('should update input value when result is selected', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      const result2 = screen.getByText('Result 2')
      fireEvent.click(result2)

      expect(input).toHaveValue('Result 2')
    })

    it('should hide results after result selection', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(screen.getByText('Result 1')).toBeInTheDocument()

      const result1 = screen.getByText('Result 1')
      fireEvent.click(result1)

      // Results should hide after selection
      vi.advanceTimersByTime(250) // Wait for blur timeout
      expect(screen.queryByText('Result 1')).not.toBeInTheDocument()
    })
  })

  describe('Animation Variants', () => {
    beforeEach(() => {
      vi.advanceTimersByTime(10) // Trigger initial animation
    })

    it('should apply fade animation by default', () => {
      render(() => <MotionSearch />)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toHaveStyle({
        opacity: '1',
        transition: expect.stringContaining('opacity'),
      })
    })

    it('should apply slide animation', () => {
      render(() => <MotionSearch variant="slide" />)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toHaveStyle({
        opacity: '1',
        transform: 'translateY(0)',
        transition: expect.stringContaining('all'),
      })
    })

    it('should apply scale animation', () => {
      render(() => <MotionSearch variant="scale" />)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toHaveStyle({
        opacity: '1',
        transform: 'scale(1)',
        transition: expect.stringContaining('all'),
      })
    })
  })

  describe('Animation Timing', () => {
    it('should use default duration', () => {
      render(() => <MotionSearch />)

      vi.advanceTimersByTime(10)

      const input = screen.getByPlaceholderText('Search...')
      expect(input.style.transition).toContain('0.3s')
    })

    it('should use custom duration', () => {
      render(() => <MotionSearch duration={0.5} />)

      vi.advanceTimersByTime(10)

      const input = screen.getByPlaceholderText('Search...')
      expect(input.style.transition).toContain('0.5s')
    })

    it('should apply initial delay', () => {
      render(() => <MotionSearch delay={1} />)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toHaveStyle({
        opacity: '0',
      })

      vi.advanceTimersByTime(1100)
      expect(input).toHaveStyle({
        opacity: '1',
      })
    })
  })

  describe('Results Animation', () => {
    it('should animate results with stagger', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      const results = screen
        .getAllByRole('button')
        .filter((button) => button.textContent?.includes('Result'))

      expect(results[0].style.transition).toContain('0s')
      expect(results[1].style.transition).toContain('0.05s')
      expect(results[2].style.transition).toContain('0.1s')
    })

    it('should hide results with animation when losing focus', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(screen.getByText('Result 1')).toBeInTheDocument()

      fireEvent.blur(input)
      vi.advanceTimersByTime(250) // Wait for blur timeout

      expect(screen.queryByText('Result 1')).not.toBeInTheDocument()
    })
  })

  describe('Motion Integration', () => {
    it('should not apply styles when motion is disabled', async () => {
      const { isMotionEnabled } = await import('../../lib/motion')
      vi.mocked(isMotionEnabled).mockReturnValue(false)

      render(() => <MotionSearch />)

      vi.advanceTimersByTime(10)

      const input = screen.getByPlaceholderText('Search...')
      expect(input.style.opacity).toBe('')
      expect(input.style.transform).toBe('')
    })

    it('should apply easing function', async () => {
      const { getEasing } = await import('../../lib/motion')
      vi.mocked(getEasing).mockReturnValue('custom-easing')

      render(() => <MotionSearch />)

      vi.advanceTimersByTime(10)

      const input = screen.getByPlaceholderText('Search...')
      expect(input.style.transition).toContain('custom-easing')
    })
  })

  describe('Blur Handling', () => {
    it('should delay blur to allow result selection', () => {
      const onSelectResult = vi.fn()
      render(() => (
        <MotionSearch results={mockResults} onSelectResult={onSelectResult} />
      ))

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      const result1 = screen.getByText('Result 1')

      // Blur input and immediately click result
      fireEvent.blur(input)
      fireEvent.click(result1)

      // Should still select result despite blur
      expect(onSelectResult).toHaveBeenCalledWith(mockResults[0])
    })

    it('should clear blur timeout on cleanup', () => {
      const { unmount } = render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)
      fireEvent.blur(input)

      // Unmount before blur timeout completes
      unmount()

      // Should not throw error
      vi.advanceTimersByTime(300)
    })
  })

  describe('Accessibility', () => {
    it('should have proper input attributes', () => {
      render(() => <MotionSearch />)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should have proper button attributes', () => {
      render(() => <MotionSearch value="test" />)

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      expect(clearButton).toHaveAttribute('type', 'button')
    })

    it('should have proper result button attributes', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      const resultButtons = screen
        .getAllByRole('button')
        .filter((button) => button.textContent?.includes('Result'))

      resultButtons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })

    it('should have proper ARIA labels', () => {
      render(() => <MotionSearch value="test" />)

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      expect(clearButton).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Theme Integration', () => {
    it('should apply theme classes to input', () => {
      render(() => <MotionSearch />)

      const input = screen.getByPlaceholderText('Search...')
      expect(input).toHaveClass('transition-colors')
    })

    it('should apply theme classes to clear button', () => {
      render(() => <MotionSearch value="test" />)

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      expect(clearButton).toHaveClass('transition-colors')
    })

    it('should apply theme classes to results', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      const resultsContainer = document.querySelector('.absolute.z-10')
      expect(resultsContainer).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty results array', () => {
      render(() => <MotionSearch results={[]} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(screen.queryByText('Result')).not.toBeInTheDocument()
    })

    it('should handle undefined results', () => {
      render(() => <MotionSearch />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(screen.queryByText('Result')).not.toBeInTheDocument()
    })

    it('should handle results without descriptions', () => {
      const resultsWithoutDesc: SearchResult[] = [
        { id: '1', title: 'Result 1' },
        { id: '2', title: 'Result 2' },
      ]

      render(() => <MotionSearch results={resultsWithoutDesc} />)

      const input = screen.getByPlaceholderText('Search...')
      fireEvent.focus(input)

      expect(screen.getByText('Result 1')).toBeInTheDocument()
      expect(screen.getByText('Result 2')).toBeInTheDocument()
    })

    it('should handle rapid focus/blur changes', () => {
      render(() => <MotionSearch results={mockResults} />)

      const input = screen.getByPlaceholderText('Search...')

      fireEvent.focus(input)
      fireEvent.blur(input)
      fireEvent.focus(input)
      fireEvent.blur(input)

      vi.advanceTimersByTime(300)

      expect(screen.queryByText('Result 1')).not.toBeInTheDocument()
    })

    it('should handle missing callbacks gracefully', () => {
      render(() => <MotionSearch value="test" />)

      const clearButton = screen.getByRole('button', { name: /clear search/i })
      expect(() => {
        fireEvent.click(clearButton)
      }).not.toThrow()
    })
  })
})
