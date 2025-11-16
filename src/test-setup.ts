import { vi, expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Make types available globally
declare global {
  namespace Vi {
    interface JestAssertion<T = unknown> extends jest.Matchers<void, T> {}
  }
}

// Mock localStorage globally for all tests
const createLocalStorageMock = () => ({
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
})

Object.defineProperty(window, 'localStorage', {
  value: createLocalStorageMock(),
  writable: true,
  configurable: true,
})

// Mock matchMedia globally for all tests
const createMatchMediaMock = () =>
  vi.fn().mockImplementation((query) => ({
    matches: false, // Default to light mode (prefers-color-scheme: dark returns false)
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

Object.defineProperty(window, 'matchMedia', {
  value: createMatchMediaMock(),
  writable: true,
  configurable: true,
})
