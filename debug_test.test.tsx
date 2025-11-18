import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@solidjs/testing-library'
import { MotionList } from './src/components/ui/MotionList'

// Mock the useReducedMotion hook
vi.mock('./src/hooks/useMotionAnimations', () => ({
  useReducedMotion: () => ({
    shouldAnimate: () => true,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('MotionList Debug', () => {
  it('should debug basic functionality', () => {
    const items = ['Item 1', 'Item 2', 'Item 3']
    
    console.log('=== Starting test ===')
    console.log('Items:', items)
    
    render(() => <MotionList items={items} staggerDelay={50} />)
    
    console.log('After render, DOM:', document.body.innerHTML)
    
    // Initially no items should be visible
    const item1Initial = screen.queryByText('Item 1')
    console.log('Item 1 initial:', item1Initial)
    expect(item1Initial).toBeNull()
    
    console.log('All setTimeout calls:', (setTimeout as typeof global.setTimeout & { mock?: { calls: unknown[] } }).mock?.calls || 'no mock')
    
    // Advance time for first item
    console.log('Advancing timers by 0ms')
    vi.advanceTimersByTime(0)
    
    console.log('After advance, DOM:', document.body.innerHTML)
    
    const item1 = screen.queryByText('Item 1')
    console.log('Item 1 after advance:', item1)
    expect(item1).toBeTruthy()
  })
})