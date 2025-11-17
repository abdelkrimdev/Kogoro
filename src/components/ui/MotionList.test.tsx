import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { MotionList } from './MotionList'

// Mock the useReducedMotion hook
vi.mock('../../hooks/useMotionAnimations', () => ({
  useReducedMotion: () => ({
    shouldAnimate: () => true,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.spyOn(global, 'setTimeout') as ReturnType<typeof vi.spyOn>
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('MotionList', () => {
  describe('Basic Rendering', () => {
    it('should render empty list without errors', () => {
      render(() => <MotionList items={[]} />)
      const list = screen.getByRole('list')
      expect(list).toBeTruthy()
    })

    it('should render list with basic items', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      render(() => <MotionList items={items} />)

      const list = screen.getByRole('list')
      expect(list).toBeTruthy()
    })

    it('should render ordered list when ordered prop is true', () => {
      const items = ['Item 1', 'Item 2']
      render(() => <MotionList items={items} ordered={true} />)

      const list = screen.getByRole('list')
      expect(list.classList.contains('list-decimal')).toBe(true)
    })

    it('should render unordered list by default', () => {
      const items = ['Item 1', 'Item 2']
      render(() => <MotionList items={items} />)

      const list = screen.getByRole('list')
      expect(list.classList.contains('list-disc')).toBe(true)
    })

    it('should apply custom CSS classes', () => {
      const items = ['Item 1']
      render(() => (
        <MotionList items={items} class="custom-list" itemClass="custom-item" />
      ))

      const list = screen.getByRole('list')
      expect(list.classList.contains('custom-list')).toBe(true)
    })
  })

  describe('Staggered Animations', () => {
    it('should handle stagger delay correctly', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      render(() => <MotionList items={items} staggerDelay={100} />)

      // Initially no items should be visible
      expect(screen.queryByText('Item 1')).toBeNull()
      expect(screen.queryByText('Item 2')).toBeNull()
      expect(screen.queryByText('Item 3')).toBeNull()

      // Advance time for first item (0ms delay)
      vi.advanceTimersByTime(0)
      expect(screen.queryByText('Item 1')).toBeTruthy()
      expect(screen.queryByText('Item 2')).toBeNull()
      expect(screen.queryByText('Item 3')).toBeNull()

      // Advance time for second item (100ms delay)
      vi.advanceTimersByTime(100)
      expect(screen.queryByText('Item 2')).toBeTruthy()
      expect(screen.queryByText('Item 3')).toBeNull()

      // Advance time for third item (100ms more delay)
      vi.advanceTimersByTime(100)
      expect(screen.queryByText('Item 3')).toBeTruthy()
    })

    it('should use default stagger delay when not specified', () => {
      const items = ['Item 1', 'Item 2']
      render(() => <MotionList items={items} />)

      // Initially no items should be visible
      expect(screen.queryByText('Item 1')).toBeNull()
      expect(screen.queryByText('Item 2')).toBeNull()

      // Advance time for first item (0ms delay)
      vi.advanceTimersByTime(0)
      expect(screen.queryByText('Item 1')).toBeTruthy()
      expect(screen.queryByText('Item 2')).toBeNull()

      // Advance time for second item (50ms default delay)
      vi.advanceTimersByTime(50)
      expect(screen.queryByText('Item 2')).toBeTruthy()
    })

    it('should show items after stagger timeouts complete', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      render(() => <MotionList items={items} staggerDelay={50} />)

      // Initially no items should be visible
      expect(screen.queryByText('Item 1')).toBeNull()

      // Advance time for first item
      vi.advanceTimersByTime(0)
      const item1 = screen.queryByText('Item 1')
      expect(item1).toBeTruthy()

      // Advance time for second item
      vi.advanceTimersByTime(50)
      const item2 = screen.queryByText('Item 2')
      expect(item2).toBeTruthy()

      // Advance time for third item
      vi.advanceTimersByTime(50)
      const item3 = screen.queryByText('Item 3')
      expect(item3).toBeTruthy()
    })
  })

  describe('Animation Variants', () => {
    it('should apply fade animation classes', () => {
      const items = ['Item 1']
      render(() => <MotionList items={items} animation="fade" />)

      vi.advanceTimersByTime(0)
      const item = screen.getByText('Item 1')
      // Find the parent li element that should have the animation classes
      const liElement = item.closest('li')
      expect(liElement?.classList.contains('animate-fade-in')).toBe(true)
    })

    it('should apply slide animation classes with default direction', () => {
      const items = ['Item 1']
      render(() => <MotionList items={items} animation="slide" />)

      // Trigger animation
      vi.advanceTimersByTime(0)

      const item = screen.getByText('Item 1')
      const liElement = item.closest('li')
      expect(liElement?.classList.contains('animate-slide-in-up')).toBe(true)
    })

    it('should apply slide animation classes with custom direction', () => {
      const items = ['Item 1']
      render(() => (
        <MotionList items={items} animation="slide" direction="left" />
      ))

      // Trigger animation
      vi.advanceTimersByTime(0)

      const item = screen.getByText('Item 1')
      const liElement = item.closest('li')
      expect(liElement?.classList.contains('animate-slide-in-left')).toBe(true)
    })

    it('should apply scale animation classes', () => {
      const items = ['Item 1']
      render(() => <MotionList items={items} animation="scale" />)

      // Trigger animation
      vi.advanceTimersByTime(0)

      const item = screen.getByText('Item 1')
      const liElement = item.closest('li')
      expect(liElement?.classList.contains('animate-scale-in')).toBe(true)
    })

    it('should apply animation duration styles', () => {
      const items = ['Item 1']
      render(() => <MotionList items={items} duration="fast" />)

      // Trigger animation
      vi.advanceTimersByTime(0)

      const item = screen.getByText('Item 1')
      const liElement = item.closest('li')
      expect(liElement?.style.getPropertyValue('animation-duration')).toBe(
        '200ms'
      )
      expect(liElement?.style.getPropertyValue('animation-fill-mode')).toBe(
        'both'
      )
    })
  })

  describe('Dynamic Items', () => {
    it('should handle adding new items', () => {
      const [items, setItems] = createSignal(['Item 1'])

      render(() => <MotionList items={items()} staggerDelay={50} />)

      // Trigger initial animation
      vi.advanceTimersByTime(0)
      const initialItem1 = screen.queryByText('Item 1')
      expect(initialItem1).toBeTruthy()

      // Add new items
      setItems(['Item 1', 'Item 2', 'Item 3'])

      // When items change, all animations reset - initially no items should be visible
      expect(screen.queryByText('Item 1')).toBeNull()
      expect(screen.queryByText('Item 2')).toBeNull()
      expect(screen.queryByText('Item 3')).toBeNull()

      // Trigger new animations
      vi.advanceTimersByTime(0)
      const item1 = screen.queryByText('Item 1')
      expect(item1).toBeTruthy()
      expect(screen.queryByText('Item 2')).toBeNull()
      expect(screen.queryByText('Item 3')).toBeNull()

      // Advance for second item (50ms stagger)
      vi.advanceTimersByTime(50)
      const item2 = screen.queryByText('Item 2')
      expect(item2).toBeTruthy()
      expect(screen.queryByText('Item 3')).toBeNull()

      // Advance for third item (another 50ms)
      vi.advanceTimersByTime(50)
      expect(screen.queryByText('Item 3')).toBeTruthy()
    })

    it('should handle removing items', () => {
      const [items, setItems] = createSignal(['Item 1', 'Item 2', 'Item 3'])

      render(() => <MotionList items={items()} staggerDelay={50} />)

      // Trigger initial animations
      vi.advanceTimersByTime(100)
      const item1 = screen.queryByText('Item 1')
      const item2 = screen.queryByText('Item 2')
      const item3 = screen.queryByText('Item 3')
      expect(item1).toBeTruthy()
      expect(item2).toBeTruthy()
      expect(item3).toBeTruthy()

      // Remove items
      setItems(['Item 1'])

      // Should reset and show remaining items
      vi.advanceTimersByTime(0)
      const remainingItem1 = screen.queryByText('Item 1')
      const removedItem2 = screen.queryByText('Item 2')
      const removedItem3 = screen.queryByText('Item 3')
      expect(remainingItem1).toBeTruthy()
      expect(removedItem2).toBeNull()
      expect(removedItem3).toBeNull()
    })

    it('should handle replacing all items', () => {
      const [items, setItems] = createSignal(['Old 1', 'Old 2'])

      render(() => <MotionList items={items()} staggerDelay={50} />)

      // Trigger initial animations
      vi.advanceTimersByTime(50)
      const oldItem1 = screen.queryByText('Old 1')
      const oldItem2 = screen.queryByText('Old 2')
      expect(oldItem1).toBeTruthy()
      expect(oldItem2).toBeTruthy()

      // Replace all items
      setItems(['New 1', 'New 2', 'New 3'])

      // Initially no new items should be visible
      expect(screen.queryByText('New 1')).toBeNull()
      expect(screen.queryByText('New 2')).toBeNull()
      expect(screen.queryByText('New 3')).toBeNull()

      // Should reset and show new items progressively
      vi.advanceTimersByTime(0)
      const newItem1 = screen.queryByText('New 1')
      const newItem2 = screen.queryByText('New 2')
      const newItem3 = screen.queryByText('New 3')
      const removedOld1 = screen.queryByText('Old 1')
      const removedOld2 = screen.queryByText('Old 2')
      expect(newItem1).toBeTruthy()
      expect(newItem2).toBeNull()
      expect(newItem3).toBeNull()
      expect(removedOld1).toBeNull()
      expect(removedOld2).toBeNull()

      // Advance for second and third items
      vi.advanceTimersByTime(50)
      expect(screen.queryByText('New 2')).toBeTruthy()
      expect(screen.queryByText('New 3')).toBeNull()

      vi.advanceTimersByTime(50)
      expect(screen.queryByText('New 3')).toBeTruthy()
    })
  })

  describe('Custom Render Item', () => {
    it('should use custom render function', () => {
      const items = [{ id: 1, name: 'Custom Item 1' }]
      const renderItem = (item: unknown) => {
        const typedItem = item as { id: number; name: string }
        return <div data-testid="custom">{typedItem.name}</div>
      }

      render(() => <MotionList items={items} renderItem={renderItem} />)

      // Trigger animation
      vi.advanceTimersByTime(0)

      const customElement = screen.getByTestId('custom')
      expect(customElement).toBeTruthy()
      expect(screen.getByText('Custom Item 1')).toBeTruthy()
    })

    it('should handle null items with default renderer', () => {
      const items = [null, undefined, 'valid']

      render(() => <MotionList items={items} />)

      // Trigger animations
      vi.advanceTimersByTime(100)

      const nullElement = screen.queryByText('null')
      const undefinedElement = screen.queryByText('undefined')
      const validElement = screen.queryByText('valid')
      expect(nullElement).toBeTruthy()
      expect(undefinedElement).toBeTruthy()
      expect(validElement).toBeTruthy()
    })

    it('should handle object items with default renderer', () => {
      const items = [{ toString: () => 'Object Item' }]

      render(() => <MotionList items={items} />)

      // Trigger animation
      vi.advanceTimersByTime(0)

      const objectItem = screen.queryByText('Object Item')
      expect(objectItem).toBeTruthy()
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large lists without infinite loops', () => {
      const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`)

      // Should not cause infinite loop or stack overflow
      expect(() => {
        render(() => <MotionList items={items} staggerDelay={10} />)
      }).not.toThrow()

      // Should be able to advance timers without issues
      expect(() => {
        vi.advanceTimersByTime(0)
      }).not.toThrow()

      // First few items should be visible
      expect(screen.queryByText('Item 0')).toBeTruthy()
      expect(screen.queryByText('Item 1')).toBeNull() // Not yet visible (needs 10ms)
      expect(screen.queryByText('Item 2')).toBeNull() // Not yet visible (needs 20ms)

      // Advance more to see second and third items
      vi.advanceTimersByTime(20)
      expect(screen.queryByText('Item 1')).toBeTruthy()
      expect(screen.queryByText('Item 2')).toBeTruthy()
    })

    it('should handle rapid item changes without infinite loops', () => {
      const [items, setItems] = createSignal(['Item 1'])

      render(() => <MotionList items={items()} staggerDelay={0} />)

      // Rapidly change items
      for (let i = 2; i <= 10; i++) {
        setItems((prev) => [...prev, `Item ${i}`])
      }

      // Should not cause infinite loop and should be able to advance timers
      expect(() => {
        vi.advanceTimersByTime(0)
      }).not.toThrow()

      // Should show all items
      for (let i = 1; i <= 10; i++) {
        expect(screen.queryByText(`Item ${i}`)).toBeTruthy()
      }
    })

    it('should handle empty items array gracefully', () => {
      expect(() => {
        render(() => <MotionList items={[]} />)
      }).not.toThrow()

      const list = screen.getByRole('list')
      expect(list).toBeTruthy()
    })

    it('should handle undefined items gracefully', () => {
      expect(() => {
        render(() => <MotionList items={undefined} />)
      }).not.toThrow()

      const list = screen.getByRole('list')
      expect(list).toBeTruthy()
    })

    it('should prevent duplicate visible items', () => {
      const items = ['Item 1', 'Item 2']

      render(() => <MotionList items={items} staggerDelay={0} />)

      // Initially no items should be visible
      expect(screen.queryByText('Item 1')).toBeNull()
      expect(screen.queryByText('Item 2')).toBeNull()

      // Trigger all animations
      vi.advanceTimersByTime(0)

      const item1Elements = screen.queryAllByText('Item 1')
      const item2Elements = screen.queryAllByText('Item 2')

      // Should only have one of each item
      expect(item1Elements).toHaveLength(1)
      expect(item2Elements).toHaveLength(1)
    })
  })

  describe('Animation Duration', () => {
    it('should use correct duration for fast setting', () => {
      const items = ['Item 1']
      render(() => <MotionList items={items} duration="fast" />)

      vi.advanceTimersByTime(0)

      const item = screen.getByText('Item 1')
      const liElement = item.closest('li')
      expect(liElement?.style.getPropertyValue('animation-duration')).toBe(
        '200ms'
      )
    })

    it('should use correct duration for normal setting', () => {
      const items = ['Item 1']
      render(() => <MotionList items={items} duration="normal" />)

      vi.advanceTimersByTime(0)

      const item = screen.getByText('Item 1')
      const liElement = item.closest('li')
      expect(liElement?.style.getPropertyValue('animation-duration')).toBe(
        '300ms'
      )
    })

    it('should use correct duration for slow setting', () => {
      const items = ['Item 1']
      render(() => <MotionList items={items} duration="slow" />)

      vi.advanceTimersByTime(0)

      const item = screen.getByText('Item 1')
      const liElement = item.closest('li')
      expect(liElement?.style.getPropertyValue('animation-duration')).toBe(
        '500ms'
      )
    })

    it('should use default duration when not specified', () => {
      const items = ['Item 1']
      render(() => <MotionList items={items} />)

      vi.advanceTimersByTime(0)

      const item = screen.getByText('Item 1')
      const liElement = item.closest('li')
      expect(liElement?.style.getPropertyValue('animation-duration')).toBe(
        '300ms'
      )
    })
  })

  describe('Infinite Loop Prevention', () => {
    it('should not create infinite loops when items change rapidly', () => {
      const [items, setItems] = createSignal(['Item 1'])

      render(() => <MotionList items={items()} staggerDelay={10} />)

      let callCount = 0
      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = vi.fn((fn, delay) => {
        callCount++
        return originalSetTimeout(fn, delay)
      })
      global.setTimeout = mockSetTimeout as unknown as typeof global.setTimeout

      try {
        // Rapidly change items multiple times
        for (let i = 0; i < 5; i++) {
          setItems([`Item ${i}`])
        }

        // Should not create excessive timeouts
        expect(callCount).toBeLessThan(20)
      } finally {
        global.setTimeout = originalSetTimeout
      }
    })

    it('should handle effect cleanup properly', () => {
      const [items, setItems] = createSignal(['Item 1'])
      const { unmount } = render(() => <MotionList items={items()} />)

      // Unmount component
      unmount()

      // Should not cause errors when changing items after unmount
      expect(() => {
        setItems(['Item 2'])
      }).not.toThrow()
    })
  })
})
