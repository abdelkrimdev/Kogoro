import { render } from '@solidjs/testing-library';
import { MotionList } from './src/components/ui/MotionList';

// Simple debug test
const items = ['Item 1', 'Item 2'];
const { container } = render(() => (
  <MotionList 
    items={items} 
    animation="fade"
    duration="fast"
    class="test-list"
  />
));

console.log('Container HTML:', container.innerHTML);
console.log('First item classes:', container.querySelector('li')?.className);
console.log('First item styles:', container.querySelector('li')?.style.cssText);
