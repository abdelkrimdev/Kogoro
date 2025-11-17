// Simple debug script to understand the issue
const { render } = require('@solidjs/testing-library');
const { createSignal } = require('solid-js');
const { MotionList } = require('./src/components/ui/MotionList.tsx');

// Mock the useReducedMotion hook
jest.mock('./src/hooks/useMotionAnimations', () => ({
  useReducedMotion: () => ({
    shouldAnimate: () => true,
  }),
}));

// Test basic rendering
const items = ['Item 1', 'Item 2', 'Item 3'];
const { container } = render(() => <MotionList items={items} />);

console.log('Container HTML:', container.innerHTML);