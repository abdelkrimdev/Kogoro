import { render, screen } from '@solidjs/testing-library';
import { MotionList } from './src/components/ui/MotionList';

// Mock the useReducedMotion hook
const mockUseReducedMotion = () => ({
  shouldAnimate: () => true,
});

// Simple test
const items = ['Item 1', 'Item 2'];
console.log('Rendering MotionList...');
render(() => <MotionList items={items} />);

console.log('DOM:', document.body.innerHTML);

// Check if list exists
const list = screen.getByRole('list');
console.log('List found:', !!list);

// Check if items exist
const item1 = screen.queryByText('Item 1');
console.log('Item 1 found:', !!item1);
