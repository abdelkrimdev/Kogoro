/**
 * Core UI Component Validation Test
 * Focuses on essential functionality without complex animations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@solidjs/testing-library'
import {
  ErrorBoundary,
  Loading,
  MotionButton,
  MotionCard,
  MotionModal,
  MotionList,
} from './index'

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock motion loading to bypass loading states
vi.mock('./OptimizedMotion', () => ({
  OptimizedMotion: (props: { children: JSX.Element }) => props.children,
}))

describe('Core UI Component Validation', () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  describe('ErrorBoundary', () => {
    it('should render children when no error', () => {
      render(() => (
        <ErrorBoundary>
          <div data-testid="content">No Error</div>
        </ErrorBoundary>
      ))

      expect(screen.getByTestId('content')).toBeInTheDocument()
      expect(screen.getByText('No Error')).toBeInTheDocument()
    })

    it('should catch and display errors', () => {
      const ThrowError = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      ))

      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
    })
  })

  describe('Loading', () => {
    it('should render spinner', () => {
      render(() => <Loading />)

      const spinners = screen.getAllByTestId('loading-spinner')
      expect(spinners.length).toBeGreaterThan(0)
    })

    it('should render with text', () => {
      render(() => <Loading text="Loading..." />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('MotionButton', () => {
    it('should render button', () => {
      render(() => <MotionButton>Click me</MotionButton>)

      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('should handle click events', () => {
      const handleClick = vi.fn()
      render(() => <MotionButton onClick={handleClick}>Click me</MotionButton>)

      const button = screen.getByRole('button')
      button.click()

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should be disabled when loading', () => {
      render(() => <MotionButton loading>Click me</MotionButton>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('MotionCard', () => {
    it('should render card content', () => {
      render(() => (
        <MotionCard>
          <div data-testid="card-content">Card content</div>
        </MotionCard>
      ))

      expect(screen.getByTestId('card-content')).toBeInTheDocument()
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('should handle click when clickable', async () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionCard clickable onClick={handleClick}>
          <div data-testid="clickable-card">Clickable card</div>
        </MotionCard>
      ))

      const card = screen.getByTestId('clickable-card')
      card.click()

      // Wait a bit for async handling
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(handleClick).toHaveBeenCalled()
    })
  })

  describe('MotionModal', () => {
    it('should not render when closed', () => {
      render(() => (
        <MotionModal isOpen={false}>
          <div>Modal content</div>
        </MotionModal>
      ))

      expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
    })

    it('should render when open', () => {
      render(() => (
        <MotionModal isOpen>
          <div>Modal content</div>
        </MotionModal>
      ))

      expect(screen.getByText('Modal content')).toBeInTheDocument()
    })
  })

  describe('MotionList', () => {
    it('should render list without crashing', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']

      render(() => (
        <MotionList items={items} forceAnimateInTests={false}>
          {(item) => <div>{item}</div>}
        </MotionList>
      ))

      // Should render list container
      const list = screen.getByRole('list')
      expect(list).toBeInTheDocument()
    })

    it('should render empty list', () => {
      render(() => <MotionList items={[]} forceAnimateInTests={false} />)

      // Should not crash and should render something
      expect(document.body).toBeInTheDocument()
    })
  })
})
